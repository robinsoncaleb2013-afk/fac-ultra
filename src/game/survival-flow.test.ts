/* Survival working in the real store: its own save slot, the fishing loop costing game time,
   camp actions, the hand-line limit, and a run that ends and can be tried again. A tiny fake browser is enough. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
    get: (_t, k) =>
      k === "state" ? "running" : k === "currentTime" || k === "sampleRate" ? 0 : quiet(),
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

const { useGame, sim, act, frame, reelDown, reelUp, hydrate, MODE_KEYS, resetSim } =
  await import("./engine.ts");
const { setRng, makeRng } = await import("./rng.ts");
const { dailySeed, localDate, sanitizeSurvival, isForcedCamp, clockOf } =
  await import("./survival.ts");

const here = dirname(fileURLToPath(import.meta.url));
const v6 = JSON.parse(readFileSync(join(here, "__fixtures__", "save-v6.json"), "utf8"));
const slot = (k: keyof typeof MODE_KEYS) => JSON.parse(mem.get(MODE_KEYS[k]) ?? "null");
const phase = () => sim.phase as string;
const st = () => useGame.getState();

/** Cast, hook and reel one fish with the real loop. True when it landed. */
function landOne(): boolean {
  const before = st().survival?.fish ?? 0;
  for (let tries = 0; tries < 60; tries++) {
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
    if ((st().survival?.fish ?? 0) > before) return true;
  }
  return false;
}

/** The store saves 400 ms after a change (and on pagehide); wait for it. */
const flush = () => new Promise((r) => setTimeout(r, 450));

function boot() {
  mem.clear();
  setRng(makeRng(5));
  mem.set(MODE_KEYS.expedition, JSON.stringify(v6));
  hydrate();
}

test("Survival has its own slot and never touches the career", () => {
  boot();
  const careerBefore = mem.get(MODE_KEYS.expedition);
  st().switchMode("survival");
  const s = st();
  assert.equal(s.mode, "survival");
  assert.equal(s.screen, "game");
  assert.equal(s.survival, null, "no run yet: the game asks where to start");
  assert.equal(MODE_KEYS.survival, "fac-ultra-survival");
  assert.deepEqual(s.dex, {}, "its own empty dex, not the career's");
  assert.equal(s.c, 50);
  const saved = slot("survival");
  assert.equal(saved.version, 1);
  assert.equal(saved.run, null);
  assert.equal("c" in saved, false, "not a career-shaped save");
  assert.equal(
    mem.get(MODE_KEYS.expedition),
    careerBefore,
    "the career slot is byte-for-byte unchanged",
  );
  st().switchMode("expedition");
  assert.equal(st().c, v6.c);
  assert.ok(Object.keys(st().dex).length > 0);
});

test("a run: daily seed, fishing costs game time, the catch goes in the larder and the Survival dex", async () => {
  boot();
  st().switchMode("survival");
  st().beginRun(0, true);
  let run = st().survival!;
  assert.equal(run.seed, dailySeed(localDate(), 0));
  assert.equal(run.daily, true);
  assert.equal(st().biome, 0);
  assert.equal(st().weather, run.weather);
  assert.equal(run.min, 0);
  assert.ok(landOne(), "a fish landed");
  run = st().survival!;
  assert.equal(run.fish, 1);
  assert.equal(run.larder.length, 1);
  assert.ok(run.min >= 12, `the cast and fight took game time (${run.min} min)`);
  assert.ok(run.hunger < 85, "time made you hungrier");
  assert.equal(st().inv.length, 0, "no bag to sell from");
  assert.equal(Object.keys(st().dex).length, 1, "the Survival dex has it");
  assert.equal(
    JSON.parse(mem.get(MODE_KEYS.expedition)!).caught,
    v6.caught,
    "the career count did not move",
  );
  await flush();
  const saved = slot("survival");
  assert.equal(saved.run.fish, 1);
  assert.equal(Object.keys(saved.dex).length, 1);
  assert.equal(st().message.startsWith("Landed"), true);
});

test("eating, the fire and crafting at camp", () => {
  boot();
  st().switchMode("survival");
  st().beginRun(0, false);
  assert.ok(landOne());
  const wood = st().survival!.camp.driftwood;
  st().campLog();
  assert.equal(st().survival!.camp.driftwood, wood - 1);
  assert.ok(st().survival!.camp.fire > 0);
  const hungry = { ...st().survival!, hunger: 30 };
  useGame.setState({ survival: hungry });
  st().campEat(0, "cook");
  assert.equal(st().survival!.larder.length, 0);
  assert.ok(st().survival!.hunger > 30);
  assert.equal(st().survival!.eaten, 1);
  /* Not enough bone: it says so and nothing is spent. */
  useGame.setState({ survival: { ...st().survival!, camp: { ...st().survival!.camp, bone: 1 } } });
  st().campCraft("bone-hook");
  assert.equal(st().survival!.gear.hook, 0);
  assert.match(st().message, /Needs 3 bone/);
  useGame.setState({ survival: { ...st().survival!, camp: { ...st().survival!.camp, bone: 3 } } });
  st().campCraft("bone-hook");
  assert.equal(st().survival!.gear.hook, 1);
  /* Camp work waits for the fish. */
  sim.phase = "wait";
  const min = st().survival!.min;
  st().campLog();
  assert.equal(st().survival!.min, min, "nothing happens in the middle of a cast");
  sim.phase = "idle";
});

test("a hand line cannot land an epic fish: it snaps, tells you what to make, and costs a little time", () => {
  boot();
  st().switchMode("survival");
  st().beginRun(0, false);
  resetSim();
  const min = st().survival!.min;
  sim.fish = { b: 0, i: 20, t: 3, m: 0, name: "Big Epic", w: 9, v: 1, boss: false };
  sim.phase = "bite";
  sim.biteMax = 2;
  sim.biteLeft = 2;
  useGame.setState({ phase: "bite" });
  act();
  assert.equal(phase(), "idle");
  assert.match(st().message, /hand line/i);
  assert.match(st().detail, /carved hook/i);
  assert.ok(st().survival!.min > min, "the struggle took game time");
  /* A carved hook lands it. */
  useGame.setState({ survival: { ...st().survival!, gear: { hook: 2, line: 0 } } });
  sim.fish = { b: 0, i: 20, t: 3, m: 0, name: "Big Epic", w: 9, v: 1, boss: false };
  sim.phase = "bite";
  sim.biteMax = 2;
  sim.biteLeft = 2;
  act();
  assert.equal(phase(), "reel", "the fight begins");
  resetSim();
});

test("no cast in the dark: the game says so and opens Camp; sleeping brings the morning", () => {
  boot();
  st().switchMode("survival");
  st().beginRun(0, false);
  useGame.setState({ survival: { ...st().survival!, min: 1080, hunger: 90, warmth: 90 } });
  assert.equal(isForcedCamp(st().survival!), true);
  act();
  assert.equal(phase(), "idle");
  assert.match(st().message, /too dark/i);
  assert.equal(st().tab, "camp");
  st().campSleep();
  const run = st().survival!;
  assert.equal(clockOf(run.min).day, 2);
  assert.equal(st().tab, "cast");
  assert.equal(isForcedCamp(run), false);
});

test("the run ends, is filed in the history, saved, and can be tried again from the same seed", async () => {
  boot();
  st().switchMode("survival");
  st().beginRun(0, true);
  const first = st().survival!;
  /* Do nothing but sleep: starvation on day 2. */
  for (let i = 0; i < 6 && !st().survival!.over; i++) {
    useGame.setState({
      survival: { ...st().survival!, min: Math.max(st().survival!.min, i * 1440 + 1080) },
    });
    st().campSleep();
  }
  const over = st().survival!;
  assert.ok(over.over);
  assert.equal(over.over!.kind, "lost");
  assert.equal(st().sMeta.history.length, 1);
  assert.equal(st().sMeta.history[0].days, over.over!.day - 1);
  await flush();
  assert.equal(slot("survival").history.length, 1);
  assert.equal(slot("survival").run.over.kind, "lost");
  act();
  assert.equal(phase(), "idle", "no casting after the end");
  st().retryRun();
  const again = st().survival!;
  assert.equal(again.over, null);
  assert.equal(again.seed, first.seed, "same seed");
  assert.equal(again.min, 0);
  assert.equal(st().sMeta.history.length, 1, "the finished run stays in the history");
  /* Not over: leave and retry are no-ops. */
  st().leaveRun();
  assert.ok(st().survival);
  /* Over again, then pick a new run. */
  useGame.setState({ survival: { ...again, hunger: 0.01, min: 1080 } });
  st().campSleep();
  assert.ok(st().survival!.over);
  st().leaveRun();
  assert.equal(st().survival, null);
});

test("the run survives a reload and the career is still separate", () => {
  boot();
  st().switchMode("survival");
  st().beginRun(5, false);
  assert.ok(landOne());
  const before = st().survival!;
  const dex = Object.keys(st().dex);
  /* A reload: new page, same storage (leaving the mode flushes the debounced save, like pagehide does). */
  st().switchMode("expedition");
  setRng(makeRng(9));
  hydrate("survival");
  const after = st().survival!;
  assert.deepEqual(after, before);
  assert.deepEqual(Object.keys(st().dex), dex);
  assert.equal(st().biome, 5);
  /* Hostile storage does not crash the load. */
  mem.set(MODE_KEYS.survival, '{"run":{"water":99},"dex":7,"version":"x"');
  hydrate("survival");
  assert.equal(st().survival, null);
  mem.set(
    MODE_KEYS.survival,
    JSON.stringify({ run: { water: 9, hunger: "lots", min: -5 }, dex: { "9-1": { c: 3, w: 2 } } }),
  );
  hydrate("survival");
  assert.equal(st().survival!.water, 9);
  assert.equal(st().survival!.min, 0);
  assert.equal(st().dex["9-1"].c, 3);
  assert.deepEqual(sanitizeSurvival(slot("survival")).run, st().survival);
});

test("the same seed gives the same first fish", () => {
  const firstFish = () => {
    boot();
    st().switchMode("survival");
    st().beginRun(0, true);
    resetSim();
    act();
    for (let i = 0; i < 400 && phase() === "wait"; i++) frame(0.05);
    return `${sim.fish?.name}|${sim.fish?.w}|${st().survival!.min}`;
  };
  const a = firstFish();
  const b = firstFish();
  assert.equal(a, b);
  assert.ok(a.startsWith("undefined") === false);
});

test("Survival export and import carry the survival ledger, not a career one", () => {
  boot();
  st().switchMode("survival");
  st().beginRun(1, false);
  const code = st().exportCode();
  const json = JSON.parse(decodeURIComponent(escape(atob(code))));
  assert.equal(json.run.water, 1);
  assert.equal("c" in json, false);
  st().beginRun(2, false);
  assert.equal(st().importCode(code), true);
  assert.equal(st().survival!.water, 1);
  assert.equal(st().importCode("not a code"), false);
  st().switchMode("expedition");
  assert.equal(st().c, v6.c);
});
