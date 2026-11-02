/* The modes working together in the real store: separate save slots, Recreational trips and the
   shared career collection. A tiny fake browser (localStorage, matchMedia) is enough to run it. */
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
/* Sound is not under test: a stand-in that accepts every call. */
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

const { useGame, sim, act, frame, reelDown, reelUp, hydrate, sanitize, snapshot, MODE_KEYS, resetSim, fresh } =
  await import("./engine.ts");
const { setRng, makeRng } = await import("./rng.ts");
const { MODES } = await import("./modes.ts");

const here = dirname(fileURLToPath(import.meta.url));
const v6 = JSON.parse(readFileSync(join(here, "__fixtures__", "save-v6.json"), "utf8"));
const slot = (mode: keyof typeof MODE_KEYS) => JSON.parse(mem.get(MODE_KEYS[mode]) ?? "null");

/** Fish with the real loop until one fish lands (or give up). Returns true when a catch happened. */
const phase = () => sim.phase as string;

function landOne(): boolean {
  const before = useGame.getState().caught;
  for (let tries = 0; tries < 80; tries++) {
    resetSim();
    act();
    for (let i = 0; i < 400 && phase() === "wait"; i++) frame(0.05);
    if (phase() !== "bite") continue;
    act();
    for (let i = 0; i < 1600 && phase() === "reel"; i++) {
      /* hold while the fish is easy, let go when the line is tight */
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

test("each mode has its own save slot, and the career is not touched by Recreational money or gear", () => {
  mem.clear();
  setRng(makeRng(7));
  mem.set(MODE_KEYS.expedition, JSON.stringify(v6));
  hydrate();
  assert.equal(useGame.getState().mode, "expedition");
  assert.equal(useGame.getState().c, v6.c);

  useGame.getState().switchMode("recreational");
  let s = useGame.getState();
  assert.equal(s.mode, "recreational");
  assert.equal(s.screen, "game");
  assert.equal(s.ub.length, 15, "every water is unlocked");
  assert.equal(s.contracts.length, 0, "no contracts");
  assert.equal(s.trip, null, "no trip yet: the game asks for one");
  assert.ok(slot("recreational"), "Recreational has its own slot");
  assert.equal(slot("expedition").c, v6.c, "the career slot still has its own money");
  assert.equal(s.dex["0-4"]?.c, v6.dex["0-4"].c, "the career collection is visible in Recreational");

  useGame.getState().switchMode("coop");
  assert.equal(useGame.getState().mode, "coop");
  assert.equal(useGame.getState().ub.length, 1, "Co-op starts like a new career");
  assert.ok(slot("coop"));
  useGame.getState().switchMode("expedition");
  s = useGame.getState();
  assert.equal(s.c, v6.c);
  assert.equal(s.mode, "expedition");
});

test("a Recreational trip: pick the water, time and weather, fish, keep and release, then pack up", () => {
  mem.clear();
  setRng(makeRng(11));
  mem.set(MODE_KEYS.expedition, JSON.stringify(v6));
  hydrate();
  const careerMoney = v6.c;
  useGame.getState().switchMode("recreational");
  useGame.getState().beginTrip(1, "dusk", 2);
  let s = useGame.getState();
  assert.ok(s.trip);
  assert.equal(s.biome, 1);
  assert.equal(s.weather, 2, "the weather you picked");
  assert.equal(s.trip.window, "dusk");
  assert.equal(s.inv.length, 0);

  assert.ok(landOne(), "a fish was landed");
  s = useGame.getState();
  assert.equal(s.trip?.caught, 1);
  assert.equal(s.trip?.kept, 1);
  assert.equal(s.inv.length, 1, "the creel has it");
  assert.equal(s.c, 50, "no money in Recreational");
  assert.ok(s.celebration);

  useGame.getState().releaseCatch();
  s = useGame.getState();
  assert.equal(s.trip?.released, 1);
  assert.equal(s.trip?.kept, 0);
  assert.equal(s.inv.length, 0, "released fish leave the creel");

  assert.ok(landOne());
  useGame.getState().keepCatch();
  assert.equal(useGame.getState().inv.length, 1);

  /* Selling does nothing here and says so. */
  const money = useGame.getState().c;
  useGame.getState().sellOne(0);
  assert.equal(useGame.getState().c, money);
  assert.equal(useGame.getState().inv.length, 1);

  useGame.getState().endTrip();
  s = useGame.getState();
  assert.equal(s.trip, null);
  assert.equal(s.inv.length, 0, "the creel empties when the trip ends");
  assert.equal(s.trips.length, 1, "the trip is in the logbook");
  assert.equal(s.trips[0].caught, 2);
  assert.ok(s.tripCard && s.tripCard.lines.length === 3);
  assert.match(s.tripCard.lines[1], /^Creel today: 1 fish, /);

  /* Going to the menu saves this mode (and shows the career again). */
  useGame.getState().setScreen("menu");
  const saved = slot("recreational");
  assert.equal(saved.version, 9);
  assert.equal(saved.trips.length, 1);
  assert.equal(slot("expedition").c, careerMoney, "career money untouched");
  /* the v7 Recreational save reloads */
  const again = sanitize(saved);
  assert.deepEqual(again.trips, s.trips);
});

test("Recreational catches fill the career collection and records", () => {
  mem.clear();
  setRng(makeRng(5));
  mem.set(MODE_KEYS.expedition, JSON.stringify(v6));
  hydrate();
  useGame.getState().switchMode("recreational");
  useGame.getState().beginTrip(0, "clock", -1);
  const before = Object.values(slot("expedition").dex as Record<string, { c: number }>).reduce((n, e) => n + e.c, 0);
  assert.ok(landOne());
  useGame.getState().keepCatch();
  /* persist is debounced; the lifecycle flush writes both slots */
  useGame.getState().switchMode("expedition");
  const career = slot("expedition");
  const after = Object.values(career.dex as Record<string, { c: number }>).reduce((n, e) => n + e.c, 0);
  assert.equal(after, before + 1, "the career collection grew by the fish caught in Recreational");
  assert.equal(career.c, v6.c, "career money is exactly what it was");
  assert.equal(career.caught, v6.caught, "the career catch count is its own");
  assert.equal(useGame.getState().dex["0-4"]?.c >= v6.dex["0-4"].c, true);
  /* and coming back, Recreational sees the same collection */
  useGame.getState().switchMode("recreational");
  const rec = useGame.getState();
  assert.equal(Object.values(rec.dex).reduce((n, e) => n + e.c, 0), after);
});

test("the old Sandbox's own collection is merged into the career the first time it is opened", () => {
  mem.clear();
  setRng(makeRng(3));
  const sandbox = { ...JSON.parse(JSON.stringify(fresh())), version: 6, dex: { "2-3": { c: 4, w: 9.5, m: 1 } } };
  delete sandbox.kid;
  delete sandbox.trips;
  delete sandbox.trip;
  mem.set(MODE_KEYS.expedition, JSON.stringify(v6));
  mem.set(MODE_KEYS.recreational, JSON.stringify(sandbox));
  hydrate();
  useGame.getState().switchMode("recreational");
  const rec = useGame.getState();
  assert.ok(rec.dex["2-3"] && rec.dex["0-4"], "both collections are there");
  const career = slot("expedition");
  assert.ok(career.dex["2-3"], "the sandbox species reached the career dex");
  assert.equal(career.dex["2-3"].w, 9.5);
  assert.equal(career.c, v6.c);
});

test("a trip left open for hours is filed when the game opens", () => {
  mem.clear();
  const old = Date.now() - 5 * 3_600_000;
  const rec = {
    ...JSON.parse(JSON.stringify(fresh())),
    trip: { start: old, end: 0, last: old + 60_000, water: 0, window: "clock", weather: -1, caught: 1, kept: 1, released: 0, keptLb: 2, totalLb: 2, best: { n: "Perch", w: 2, t: 0 }, fresh: [], recs: [] },
    inv: [{ name: "Perch", t: 0, v: 3, w: 2, i: 0, b: 0, m: 0 }],
  };
  mem.set(MODE_KEYS.recreational, JSON.stringify(rec));
  hydrate();
  useGame.getState().switchMode("recreational");
  const s = useGame.getState();
  assert.equal(s.trip, null);
  assert.equal(s.trips.length, 1);
  assert.equal(s.trips[0].end, old + 60_000, "it ended when you last did something");
  assert.equal(s.inv.length, 0);
});

test("leaving the water in Recreational ends the trip and starts one on the new water", () => {
  mem.clear();
  setRng(makeRng(21));
  hydrate();
  useGame.getState().switchMode("recreational");
  useGame.getState().beginTrip(0, "dawn", 1);
  assert.ok(landOne());
  useGame.getState().keepCatch();
  useGame.getState().travel(3);
  const s = useGame.getState();
  assert.equal(s.biome, 3);
  assert.equal(s.trip?.water, 3);
  assert.equal(s.trip?.window, "dawn", "same time of day");
  assert.equal(s.trip?.weather, 1, "same weather");
  assert.equal(s.inv.length, 0, "the creel emptied");
  assert.equal(s.trips.length, 1);
  assert.equal(s.weather, 1);
});

test("the main menu always shows the career", () => {
  mem.clear();
  hydrate();
  useGame.getState().switchMode("recreational");
  useGame.getState().setScreen("menu");
  const s = useGame.getState();
  assert.equal(s.mode, "expedition");
  assert.equal(s.screen, "menu");
});

test("Kid Mode: Helping Hand is on whatever the setting, and it follows the person across modes", () => {
  mem.clear();
  hydrate();
  useGame.setState({ assist: false });
  useGame.getState().setKid(true);
  assert.equal(useGame.getState().kid, true);
  useGame.getState().switchMode("recreational");
  assert.equal(useGame.getState().kid, true, "Kid Mode is a device setting");
  assert.equal(MODES.recreational.assistAllowed, true);
  const dev = JSON.parse(mem.get("fac-ultra-device") ?? "{}");
  assert.equal(dev.kid, true);
  assert.equal(snapshot(useGame.getState()).kid, true);
});

test("Kid Mode asks 'Are you sure?' before selling a rare fish; a common one just sells", () => {
  mem.clear();
  hydrate();
  const rare = { name: "Gar", t: 2, v: 100, w: 5, i: 1, b: 0, m: 0 };
  const common = { name: "Perch", t: 0, v: 10, w: 1, i: 2, b: 0, m: 0 };
  useGame.setState({ inv: [rare, common], c: 0, kid: true });
  useGame.getState().sellOne(1);
  assert.equal(useGame.getState().inv.length, 1, "the common fish sold at once");
  useGame.getState().sellOne(0);
  assert.equal(useGame.getState().inv.length, 1, "the rare one waits for a second tap");
  assert.ok(useGame.getState().armSell);
  useGame.getState().sellOne(0);
  assert.equal(useGame.getState().inv.length, 0, "second tap sells it");
  assert.equal(useGame.getState().armSell, "");
  /* a grown-up is never asked */
  useGame.setState({ inv: [rare], kid: false });
  useGame.getState().sellOne(0);
  assert.equal(useGame.getState().inv.length, 0);
});

test("Kid Mode asks before 'Sell all' when something rare is in the bag", () => {
  mem.clear();
  hydrate();
  const rare = { name: "Gar", t: 3, v: 100, w: 5, i: 1, b: 0, m: 0 };
  const common = { name: "Perch", t: 0, v: 10, w: 1, i: 2, b: 0, m: 0 };
  useGame.setState({ inv: [rare, common], kid: true });
  useGame.getState().sellUpTo(9);
  assert.equal(useGame.getState().inv.length, 2);
  useGame.getState().sellUpTo(9);
  assert.equal(useGame.getState().inv.length, 0);
  useGame.setState({ inv: [common, common], kid: true });
  useGame.getState().sellUpTo(1);
  assert.equal(useGame.getState().inv.length, 0, "only common fish: no question");
});

test("Rebirth is switched off in Recreational and nothing in the shop costs money there", () => {
  mem.clear();
  hydrate();
  useGame.getState().switchMode("recreational");
  useGame.setState({ tot: 1e9, armRebirth: false, c: 0 });
  useGame.getState().rebirth();
  assert.equal(useGame.getState().armRebirth, false, "rebirth did not even arm");
  assert.equal(useGame.getState().rb, 0);
  useGame.setState({ sigBox: [], c: 0 });
  useGame.getState().buySig(0);
  assert.deepEqual(useGame.getState().sigBox, [0], "a signature lure is free where there is no economy");
  assert.equal(useGame.getState().c, 0);
  useGame.getState().switchMode("expedition");
  useGame.setState({ sigBox: [], c: 0 });
  useGame.getState().buySig(0);
  assert.deepEqual(useGame.getState().sigBox, [], "in the career it costs money");
});
