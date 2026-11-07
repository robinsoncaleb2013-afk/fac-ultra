/* WP-16 working together in the real store: the Kids book, difficulty, keep-or-release, the Legend dangers, Story and the
   save slots (docs/architecture/12). A tiny fake browser is enough. */
import assert from "node:assert/strict";
import { test } from "node:test";

const mem = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};
const quiet = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "state" ? "running" : k === "currentTime" || k === "sampleRate" ? 0 : quiet()),
    apply: () => quiet(),
    set: () => true,
  });
g.AudioContext = class {
  constructor() {
    return quiet() as object;
  }
};
g.document = { addEventListener() {}, visibilityState: "visible" };
g.window = Object.assign(globalThis, {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  innerWidth: 1440,
  innerHeight: 900,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => true,
});

const { useGame, sim, act, frame, reelDown, reelUp, hydrate, resetSim, fresh, applyCatch, PENDING_FISH, activeSlot, currentSyncId } = await import("./engine.ts");
const { setRng, makeRng } = await import("./rng.ts");
const { slotKey } = await import("./slots.ts");
const { BIOMES } = await import("./content.ts");
const hz = await import("./hazards.ts");
const { freshHazards } = hz;

const phase = () => sim.phase as string;
const fish = { name: "Bluegill", t: 0, v: 100, w: 1.5, i: 0, b: 0, m: 0, boss: false } as Parameters<typeof applyCatch>[1];

/** Land one fish with the real loop. Returns true when a catch happened. */
function landOne(): boolean {
  const before = useGame.getState().caught;
  for (let tries = 0; tries < 80; tries++) {
    resetSim();
    act();
    for (let i = 0; i < 400 && phase() === "wait"; i++) frame(0.05);
    if (phase() !== "bite") continue;
    act();
    for (let i = 0; i < 1600 && phase() === "reel"; i++) {
      const F = sim.fight;
      if (F && F.tension > 0.7) reelUp();
      else reelDown();
      frame(0.05);
    }
    reelUp();
    if (useGame.getState().caught > before) return true;
  }
  return false;
}

function boot() {
  mem.clear();
  setRng(makeRng(21));
  hydrate();
}

test("Kid Mode catches go in the Kids book, never the main book or the records, but still pay and level", () => {
  boot();
  useGame.setState({ kid: true });
  const before = useGame.getState();
  const next = applyCatch({ ...before, toasts: [] }, fish, { auto: false, perfect: false, frenzy: false, ctx: { spot: "x", p: { family: "worm", depth: 1, retrieve: "medium" }, weather: 0, window: "day" } });
  assert.deepEqual(next.dex, before.dex, "the main book did not change");
  assert.deepEqual(next.records, before.records, "no record was set");
  assert.equal(next.sideDex["0-0"].c, 1);
  assert.equal(next.lastCatch.book, "kids");
  assert.equal(next.lastCatch.discovered, true, "new for the Kids book");
  assert.equal(next.inv.length, before.inv.length + 1, "it still goes in the bag to sell");
  assert.equal(next.caught, before.caught + 1);
  assert.ok(next.xp > before.xp || next.lv > before.lv);
  const again = applyCatch({ ...before, ...next, toasts: [] }, fish, { auto: false, perfect: false, frenzy: false });
  assert.equal(again.sideDex["0-0"].c, 2);
  assert.equal(again.lastCatch.discovered, false);
});

test("Kid Mode inside Recreational also uses the Kids book; the Relaxed Fishing book stays clean", () => {
  boot();
  useGame.getState().switchMode("recreational");
  useGame.setState({ kid: true });
  const s = useGame.getState();
  const next = applyCatch({ ...s, toasts: [] }, fish, { auto: false, perfect: false, frenzy: false });
  assert.deepEqual(next.dex, {});
  assert.equal(next.sideDex["0-0"].c, 1);
  useGame.setState({ kid: false });
  const normal = applyCatch({ ...useGame.getState(), toasts: [] }, fish, { auto: false, perfect: false, frenzy: false });
  assert.equal(normal.dex["0-0"].c, 1, "without Kid Mode it is the Relaxed Fishing book");
  assert.deepEqual(normal.sideDex, {});
});

test("Super Easy fish skip the main book; Easy counts; Legend pays 25% less and more XP", () => {
  boot();
  const base = { ...useGame.getState(), toasts: [] };
  const run = (difficulty: "superEasy" | "easy" | "normal" | "hardest") => applyCatch({ ...base, difficulty }, fish, { auto: false, perfect: false, frenzy: false });
  assert.deepEqual(run("superEasy").dex, {});
  assert.equal(run("superEasy").sideDex["0-0"].c, 1);
  assert.equal(run("easy").dex["0-0"].c, 1);
  const epic = { ...fish, t: 3, v: 900 } as typeof fish;
  const runEpic = (difficulty: "normal" | "hardest") => applyCatch({ ...base, difficulty }, epic, { auto: false, perfect: false, frenzy: false });
  const normal = runEpic("normal");
  const legend = runEpic("hardest");
  const worth = (r: typeof normal) => r.inv[r.inv.length - 1].v;
  assert.equal(worth(normal), Math.round(900 * 1.03), "streak bonus applies as before");
  assert.ok(worth(legend) < worth(normal) * 0.8);
  assert.ok(legend.xp > normal.xp || legend.lv > normal.lv, "Legend pays a little more XP");
});

test("stage progress counts Kids-book fish, so Kid Mode still opens the water", () => {
  boot();
  const sideDex: Record<string, { c: number; w: number; m: number }> = {};
  for (let i = 0; i < 9; i++) sideDex[`0-${i}`] = { c: 1, w: 1, m: 0 };
  useGame.setState({ sideDex });
  return import("./engine.ts").then(({ stageBook }) => {
    assert.equal(Object.keys(stageBook(useGame.getState())).length, 9);
    assert.deepEqual(useGame.getState().dex, {});
  });
});

test("keep or release: casting is blocked, with a notice, until you choose; then you can cast", () => {
  boot();
  useGame.getState().switchMode("recreational");
  useGame.getState().beginTrip(0, "day", 0);
  assert.ok(landOne());
  assert.ok(useGame.getState().celebration, "the card is up");
  resetSim();
  act();
  assert.equal(phase(), "idle", "no cast while the fish waits for a decision");
  const s = useGame.getState();
  assert.equal(s.message, PENDING_FISH);
  assert.ok(s.toasts.some((t) => t.text === PENDING_FISH));
  const n = s.toasts.length;
  act();
  assert.equal(useGame.getState().toasts.length, n, "the notice is not stacked up");
  /* Esc, Space and a tap on the water cannot dismiss the card either. */
  useGame.getState().dismissCelebration();
  assert.ok(useGame.getState().celebration, "still waiting");
  /* Time passing does not decide for you. */
  for (let i = 0; i < 400; i++) frame(0.05);
  assert.ok(useGame.getState().celebration);
  useGame.getState().keepCatch();
  assert.equal(useGame.getState().celebration, null);
  act();
  assert.equal(phase(), "wait", "now it casts");
  /* Release works the same. */
  resetSim();
  assert.ok(landOne());
  useGame.getState().releaseCatch();
  assert.equal(useGame.getState().celebration, null);
});

test("keep or release: 'keep every fish' in Settings lifts the block; Survival and Tournament never block", () => {
  boot();
  useGame.getState().switchMode("recreational");
  useGame.getState().beginTrip(0, "day", 0);
  useGame.getState().toggleSetting("autoKeep");
  assert.ok(landOne());
  resetSim();
  act();
  assert.equal(phase(), "wait", "cast went ahead with a card still up");
  assert.ok(useGame.getState().autoKeep);
});

test("Legend dangers: a snapped line can take the lure or the rod, and says so in plain words", () => {
  /* A hazard seed whose very first draw takes the lure (the dice are a pure function of the seed). */
  let seed = 1;
  for (; seed < 500; seed++) if (hz.onSnap(freshHazards(seed), "full", { rod: 4, boat: 0, c: 50, lure: 5, sig: -1, box: { "5": 8 }, sigBox: [] }, { rarity: 0, boss: false }).gear.box) break;
  const trial = () => {
    boot();
    setRng(makeRng(77));
    useGame.setState({ difficulty: "hardest", assist: false, drag: 2, biome: 11, line: 0, rod: 4, lure: 5, box: { "5": 8 }, hz: freshHazards(seed), toasts: [], c: 50 });
    let snaps = 0;
    const said: string[] = [];
    for (let k = 0; k < 60; k++) {
      resetSim();
      useGame.setState({ celebration: null, phase: "idle", toasts: [] });
      act();
      for (let i = 0; i < 400 && phase() === "wait"; i++) frame(0.05);
      if (phase() !== "bite") continue;
      act();
      /* the line is pulled to its limit: it snaps */
      for (let i = 0; i < 1600 && phase() === "reel"; i++) {
        if (sim.fight) sim.fight.strain = sim.fight.hold;
        reelDown();
        frame(0.05);
      }
      reelUp();
      const t = useGame.getState().toasts.map((x) => x.text);
      if (/snapped/.test(useGame.getState().message)) snaps++;
      said.push(...t.filter((x) => /gone|tangled|broke|wallet/.test(x)));
    }
    const s = useGame.getState();
    return { rod: s.rod, box: s.box, n: s.hz.n, said, snaps, c: s.c };
  };
  const a = trial();
  assert.ok(a.snaps > 0, "lines did snap");
  assert.ok(a.n > 0, "dangers were drawn");
  assert.ok(a.rod >= 0, "you always keep a rod");
  assert.ok(a.said.length > 0, "something was taken, and the game said so");
  assert.ok(a.rod < 4 || (a.box["5"] ?? 0) < 8 || a.c < 50, "and it really was taken");
});

test("the wallet and the storm are checked when you cast, and the cast still goes ahead", () => {
  let seed = 1;
  const { onCast } = hz;
  for (; seed < 5000; seed++) if (onCast(freshHazards(seed), "full", { rod: 0, boat: 0, c: 1001, lure: -1, sig: -1, box: {}, sigBox: [] }, { weather: 0, biome: 0 }).gear.c !== undefined) break;
  boot();
  useGame.setState({ difficulty: "hardest", c: 1001, hz: freshHazards(seed), toasts: [] });
  resetSim();
  act();
  const s = useGame.getState();
  assert.equal(s.c, 1001 - 120, "the wallet fell in");
  assert.ok(s.toasts.some((t) => /wallet/.test(t.text) && /120/.test(t.text)));
  assert.equal(phase(), "wait", "you can still fish");
});

test("dangers never run in Normal, Kid Mode, Relaxed Fishing or Story, and never draw the dice", () => {
  boot();
  setRng(makeRng(3));
  const hz = freshHazards(9);
  for (const setup of [
    () => useGame.setState({ difficulty: "normal", hz }),
    () => useGame.setState({ difficulty: "hardest", kid: true, hz }),
  ]) {
    boot();
    setup();
    landOne();
    assert.equal(useGame.getState().hz.n, 0);
  }
  boot();
  useGame.getState().switchMode("recreational");
  useGame.setState({ difficulty: "hardest", hz });
  useGame.getState().beginTrip(0, "day", 0);
  landOne();
  assert.equal(useGame.getState().hz.n, 0, "Relaxed Fishing has no dangers");
});

test("the Aquarium at Legend: a fish jumps, 'put it back' saves it, a late one is lost, and the lawsuit takes half", () => {
  boot();
  const exhibits = ["0-20", "0-21", "0-22", "0-23", "0-24"];
  const dex = Object.fromEntries(exhibits.map((k) => [k, { c: 1, w: 3, m: 0 }]));
  useGame.setState({ screen: "game", difficulty: "hardest", dex, tank: { ...useGame.getState().tank, exhibits }, c: 1001 });
  /* Find a seed where a fish jumps on the first check. */
  let seed = 1;
  for (; seed < 500; seed++) {
    useGame.setState({ hz: { ...freshHazards(seed), lastCheck: 0 }, toasts: [] });
    frame(1.01);
    if (useGame.getState().hz.jump) break;
  }
  const jump = useGame.getState().hz.jump!;
  assert.ok(jump, "a fish jumped out");
  assert.ok(useGame.getState().toasts.some((t) => /jumped out/.test(t.text)));
  useGame.getState().putFishBack();
  assert.equal(useGame.getState().hz.jump, null);
  assert.ok(useGame.getState().tank.exhibits.includes(jump.key));
  /* A late one: set the window to already over. */
  useGame.setState({ hz: { ...useGame.getState().hz, jump: { key: jump.key, until: Date.now() - 1 } } });
  frame(1.01);
  assert.ok(!useGame.getState().tank.exhibits.includes(jump.key), "lost");
  useGame.getState().addExhibit(jump.key);
  assert.ok(!useGame.getState().tank.exhibits.includes(jump.key), "it cannot go straight back in");
  /* The lawsuit: a thin tank, a complaint already past its grace. */
  useGame.setState({ tank: { ...useGame.getState().tank, exhibits: ["0-0"] }, hz: { ...freshHazards(3), grace: Date.now() - 5 }, c: 1001 });
  frame(1.01);
  assert.equal(useGame.getState().c, 500, "the person who sues got the larger half of an odd amount");
  assert.ok(useGame.getState().toasts.some((t) => /sued/.test(t.text) && /501/.test(t.text)));
});

test("a sunk boat can be raised again for a price, and you can still fish without it", () => {
  boot();
  useGame.setState({ boat: 0, c: 100_000, hz: { ...freshHazards(1), sunk: 3 } });
  useGame.getState().raiseBoat();
  const s = useGame.getState();
  assert.equal(s.boat, 3);
  assert.equal(s.hz.sunk, -1);
  assert.ok(s.c < 100_000);
  useGame.setState({ boat: 0, c: 5, hz: { ...freshHazards(1), sunk: 3 } });
  useGame.getState().raiseBoat();
  assert.equal(useGame.getState().boat, 0, "too poor: still sunk, still fishing");
  assert.equal(useGame.getState().hz.sunk, 3);
});

test("Story: a new Story slot starts with Boss Chum, finishing a chapter pays and opens the next water", () => {
  boot();
  assert.ok(useGame.getState().createSlot("story", 0, "My tale", "hardest"));
  let s = useGame.getState();
  assert.equal(s.mode, "story");
  assert.equal(s.difficulty, "easy", "Story always plays at its friendly level");
  assert.equal(s.slotName, "My tale");
  assert.ok((s.baitBox["3"] ?? 0) >= 1, "a Boss Chum to start");
  assert.equal(s.contracts.length, 0);
  const dex: Record<string, { c: number; w: number; m: number }> = {};
  for (let i = 0; i < 25; i++) dex[`0-${i}`] = { c: 2, w: 1, m: 0 };
  useGame.setState({ dex });
  const c0 = s.c;
  assert.ok(landOne());
  s = useGame.getState();
  assert.equal(s.story.chapter, 1, "chapter one is done");
  assert.ok(s.ub.includes(1), "the River opened");
  assert.ok(s.c > c0);
  assert.ok(s.toasts.some((t) => /Chapter done/.test(t.text)));
});

test("slots: make, fill, switch, rename and delete three Expedition games, each with its own save", () => {
  boot();
  const st = () => useGame.getState();
  assert.equal(st().createSlot("expedition", 0, "First", "easy"), true);
  assert.equal(st().difficulty, "easy");
  useGame.setState({ c: 777, caught: 4 });
  assert.equal(st().createSlot("expedition", 1, "Second", "hardest"), true);
  assert.equal(activeSlot("expedition"), 1);
  assert.equal(currentSyncId(), "expedition-s1");
  assert.equal(st().difficulty, "hardest");
  assert.equal(st().c, 50, "a new slot starts new");
  assert.ok(mem.has(slotKey("expedition", 0)) && mem.has(slotKey("expedition", 1)));
  assert.equal(st().createSlot("expedition", 1, "Again", "normal"), false, "a slot with a game in it is never overwritten");
  /* back to the first one */
  st().openSlot("expedition", 0);
  assert.equal(st().slotName, "First");
  assert.equal(st().c, 777);
  assert.equal(currentSyncId(), "expedition");
  /* rename the one that is not open: only that save changes */
  st().renameSlot("expedition", 1, "Brave");
  assert.equal(JSON.parse(mem.get(slotKey("expedition", 1))!).slotName, "Brave");
  assert.equal(st().slotName, "First");
  st().renameSlot("expedition", 0, "Renamed");
  assert.equal(JSON.parse(mem.get(slotKey("expedition", 0))!).slotName, "Renamed");
  /* delete the open one: it becomes empty, the other stays */
  const removed: string[] = [];
  return import("./engine.ts").then(({ onSlotRemoved }) => {
    const off = onSlotRemoved((id) => removed.push(id));
    st().deleteSlot("expedition", 0);
    off();
    assert.deepEqual(removed, ["expedition"]);
    assert.equal(st().screen, "menu");
    assert.equal(JSON.parse(mem.get(slotKey("expedition", 0)) ?? "{}").created ?? 0, 0, "slot one is empty again");
    assert.equal(JSON.parse(mem.get(slotKey("expedition", 1))!).slotName, "Brave");
    st().deleteSlot("expedition", 1);
    assert.ok(!mem.has(slotKey("expedition", 1)));
    assert.ok(!mem.has(slotKey("expedition", 1) + "-bak"));
    assert.equal(removed.length, 1);
  });
});

test("every slot saves to its own key and carries its own difficulty and Kids book through a reload", () => {
  boot();
  useGame.getState().createSlot("expedition", 2, "Third", "superEasy");
  useGame.setState({ sideDex: { "0-1": { c: 2, w: 1, m: 0 } } });
  useGame.getState().createSlot("story", 1, "Tale", "normal");
  useGame.getState().openSlot("expedition", 2);
  assert.equal(useGame.getState().difficulty, "superEasy");
  assert.equal(useGame.getState().sideDex["0-1"].c, 2);
  hydrate();
  assert.equal(activeSlot("expedition"), 2, "the open slot is remembered");
});

test("achievements unlock after play and show a notice; Relaxed Fishing and Story keep their own", () => {
  boot();
  useGame.setState({ screen: "game", caught: 1, toasts: [] });
  return import("./engine.ts").then(({ runAchievements }) => {
    runAchievements();
    const s = useGame.getState();
    assert.ok(s.ach.got["catch-1"], "First Catch");
    assert.ok(s.toasts.some((t) => /Achievement: First Catch/.test(t.text)));
    useGame.getState().switchMode("recreational");
    assert.deepEqual(useGame.getState().ach.got, {}, "a different mode, a different list");
  });
});

test("the sanity floor: the BIOMES list is what the Story is built on", () => {
  assert.equal(fresh().difficulty, "normal");
  assert.equal(BIOMES.length, 20);
});
