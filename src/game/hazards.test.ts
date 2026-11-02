import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boatNeeded,
  freshHazards,
  hazardLevelFor,
  happens,
  HAZARD_TABLE,
  lawsuitSplit,
  mayExhibit,
  onCast,
  onSnap,
  oddsOf,
  putBack,
  readHazards,
  salvageCost,
  tankExpectation,
  tankMeetsExpectations,
  tickTank,
  walletLoss,
  type Gear,
  type HazardState,
} from "./hazards.ts";
import { rng, setRng, makeRng } from "./rng.ts";
import { MODE_LIST } from "./modes.ts";

const gear = (o: Partial<Gear> = {}): Gear => ({ rod: 6, boat: 3, c: 10_000, lure: 4, sig: -1, box: { "4": 10 }, sigBox: [], ...o });

test("hazards are off in every mode but Expedition, and off in Kid Mode", () => {
  for (const m of MODE_LIST) {
    const level = hazardLevelFor(m, "full", false);
    assert.equal(level, m === "expedition" ? "full" : "none", m);
  }
  assert.equal(hazardLevelFor("expedition", "full", true), "none");
  assert.equal(hazardLevelFor("expedition", "taste", false), "taste");
});

test("every hazard has its own odds: Legend has them all, Hard has only a taste of the lure", () => {
  for (const id of Object.keys(HAZARD_TABLE) as (keyof typeof HAZARD_TABLE)[]) {
    assert.ok(oddsOf(id, "full") > 0, `${id} is on at Legend`);
    assert.equal(oddsOf(id, "none"), 0);
  }
  assert.ok(oddsOf("lureSnap", "taste") > 0 && oddsOf("lureSnap", "taste") < oddsOf("lureSnap", "full"));
  for (const id of ["rodSnap", "boatSink", "wallet", "tankJump", "lawsuit"] as const) assert.equal(oddsOf(id, "taste"), 0, id);
});

test("the dice are seeded: same seed and same steps give the same dangers, and they never touch the fishing stream", () => {
  const run = (seed: number) => {
    let hz = freshHazards(seed);
    const hits: boolean[] = [];
    for (let i = 0; i < 200; i++) {
      const r = happens(hz, "wallet", "full");
      hz = r.hz;
      hits.push(r.hit);
    }
    return { hits, n: hz.n };
  };
  assert.deepEqual(run(99), run(99));
  assert.notDeepEqual(run(99).hits, run(100).hits);
  setRng(makeRng(5));
  const before = [rng(), rng()];
  setRng(makeRng(5));
  run(99);
  assert.deepEqual([rng(), rng()], before, "drawing hazards did not move rng()");
});

test("odds are honoured over many draws, and a level with no odds never draws", () => {
  let hz = freshHazards(7);
  let hits = 0;
  for (let i = 0; i < 4000; i++) {
    const r = happens(hz, "lureSnap", "full");
    hz = r.hz;
    if (r.hit) hits++;
  }
  assert.ok(Math.abs(hits / 4000 - HAZARD_TABLE.lureSnap.full) < 0.04, `lureSnap rate ${hits / 4000}`);
  const calm = happens(freshHazards(7), "rodSnap", "taste");
  assert.equal(calm.hit, false);
  assert.equal(calm.hz.n, 0, "no odds, no draw");
});

test("a snapped line can take a signature lure or a few from the pack, and always says so", () => {
  let found = 0;
  for (let seed = 1; seed < 400 && found < 2; seed++) {
    const out = onSnap(freshHazards(seed), "full", gear({ sig: 2, sigBox: [2, 5] }), { rarity: 0, boss: false });
    if (out.gear.sigBox) {
      found++;
      assert.deepEqual(out.gear.sigBox, [5]);
      assert.equal(out.gear.sig, -1);
      assert.ok(out.lines.length === 1 && /gone/.test(out.lines[0]));
    }
  }
  assert.ok(found >= 1);
  let pack = 0;
  for (let seed = 1; seed < 400 && !pack; seed++) {
    const out = onSnap(freshHazards(seed), "full", gear({ box: { "4": 2 } }), { rarity: 0, boss: false });
    if (out.gear.box) {
      pack++;
      assert.equal(out.gear.box["4"], undefined, "the last two were lost, so the stack is gone");
      assert.equal(out.gear.lure, -1, "and nothing is equipped that you do not have");
      assert.ok(out.lines[0].includes("2"));
    }
  }
  assert.ok(pack);
});

test("the first rod and the bait-only start can never be lost: you can always keep fishing", () => {
  for (let seed = 1; seed < 800; seed++) {
    const out = onSnap(freshHazards(seed), "full", gear({ rod: 0, lure: -1, box: {}, sigBox: [] }), { rarity: 4, boss: true });
    assert.equal(out.gear.rod, undefined);
    assert.equal(out.gear.lure, undefined);
    assert.equal(out.lines.length, 0, "nothing was taken, so nothing is said");
  }
  let lost = 0;
  for (let seed = 1; seed < 800; seed++) {
    const out = onSnap(freshHazards(seed), "full", gear({ rod: 3 }), { rarity: 3, boss: false });
    if (out.gear.rod !== undefined) {
      lost++;
      assert.equal(out.gear.rod, 2, "you fall back to the rod before");
      assert.ok(out.lines.some((l) => /rod/.test(l)));
    }
  }
  assert.ok(lost > 0, "a violent fish does break rods at Legend");
  for (let seed = 1; seed < 400; seed++) assert.equal(onSnap(freshHazards(seed), "full", gear({ rod: 3 }), { rarity: 1, boss: false }).gear.rod, undefined, "a gentle fish never breaks a rod");
});

test("the boat sinks only in a storm, only if it is too weak for the water, and never the first boat", () => {
  const weak = gear({ boat: 1 });
  const biome = 10;
  assert.ok(weak.boat < boatNeeded(biome));
  let sunk = 0;
  for (let seed = 1; seed < 600; seed++) {
    const calm = onCast(freshHazards(seed), "full", { ...weak, c: 0 }, { weather: 0, biome });
    assert.equal(calm.gear.boat, undefined, "clear skies never sink a boat");
    const storm = onCast(freshHazards(seed), "full", { ...weak, c: 0 }, { weather: HAZARD_TABLE.boatSink.weather, biome });
    if (storm.gear.boat === 0) {
      sunk++;
      assert.equal(storm.hz.sunk, 1);
      assert.ok(storm.lines[0].includes(String(salvageCost(1))));
    }
    assert.equal(onCast(freshHazards(seed), "full", { ...weak, boat: 0, c: 0 }, { weather: 2, biome }).gear.boat, undefined, "the starter boat is safe");
    assert.equal(onCast(freshHazards(seed), "full", { ...gear({ boat: boatNeeded(biome) }), c: 0 }, { weather: 2, biome }).gear.boat, undefined, "a strong enough boat is safe");
  }
  assert.ok(sunk > 0);
});

test("the wallet: you lose a share of your money, rounded down, and nothing when you are nearly broke", () => {
  assert.equal(walletLoss(1000), 120);
  assert.equal(walletLoss(HAZARD_TABLE.wallet.minMoney - 1), 0);
  let dropped = 0;
  for (let seed = 1; seed < 1500 && dropped < 3; seed++) {
    const out = onCast(freshHazards(seed), "full", gear({ boat: 0, c: 1001 }), { weather: 0, biome: 0 });
    if (out.gear.c !== undefined) {
      dropped++;
      assert.equal(out.gear.c, 1001 - 120);
      assert.ok(out.lines[0].includes("120"));
    }
  }
  assert.ok(dropped > 0);
  for (let seed = 1; seed < 500; seed++) assert.equal(onCast(freshHazards(seed), "full", gear({ boat: 0, c: 150 }), { weather: 0, biome: 0 }).gear.c, undefined);
});

test("a lawsuit takes half your money, and an odd amount gives the larger half to the person who sues", () => {
  assert.deepEqual(lawsuitSplit(1000), { theyGet: 500, youKeep: 500 });
  assert.deepEqual(lawsuitSplit(1001), { theyGet: 501, youKeep: 500 });
  assert.deepEqual(lawsuitSplit(7), { theyGet: 4, youKeep: 3 });
  assert.deepEqual(lawsuitSplit(1), { theyGet: 1, youKeep: 0 });
  assert.deepEqual(lawsuitSplit(0), { theyGet: 0, youKeep: 0 });
  for (const c of [2, 3, 99, 12345, 1e9 + 1]) {
    const s = lawsuitSplit(c);
    assert.equal(s.theyGet + s.youKeep, c, "no coin is lost or made");
    assert.ok(s.theyGet >= s.youKeep && s.theyGet - s.youKeep <= 1);
  }
});

test("tank expectations: a tank nobody set up has no visitors; a thin or common tank disappoints", () => {
  assert.equal(tankMeetsExpectations({ tier: 0, exhibits: [] }), true);
  const e = tankExpectation(0);
  assert.equal(e.minFish, 4);
  const few = ["0-20", "0-21", "0-22"];
  assert.equal(tankMeetsExpectations({ tier: 0, exhibits: few }), false, "too few");
  const common = ["0-0", "0-1", "0-2", "0-3", "0-4"];
  assert.equal(tankMeetsExpectations({ tier: 1, exhibits: common }), false, "too common for a bigger tank");
  assert.equal(tankMeetsExpectations({ tier: 0, exhibits: [...few, "0-23", "0-5"] }), true);
});

test("a fish that jumps out is lost unless it is put back in time; it cannot come back for a while", () => {
  const tank = { tier: 0, exhibits: ["0-20", "0-21", "0-22", "0-23", "0-24"] };
  let hz: HazardState | null = null;
  const now = 1_000_000_000;
  for (let seed = 1; seed < 200 && !hz; seed++) {
    const r = tickTank(freshHazards(seed), "full", tank, 5000, now);
    if (r.hz.jump) hz = r.hz;
  }
  assert.ok(hz?.jump, "a jump happens at Legend");
  const j = hz!.jump!;
  assert.equal(j.until - now, HAZARD_TABLE.tankJump.windowMs);
  /* Put back in time: safe. */
  const saved = putBack(hz!, now + 10_000);
  assert.ok(saved.ok && saved.hz.jump === null);
  /* Too late for the button… */
  assert.equal(putBack(hz!, j.until).ok, false);
  /* …and the fish is gone when the window ends. */
  const gone = tickTank(hz!, "full", tank, 5000, j.until + 1);
  assert.ok(!gone.exhibits.includes(j.key));
  assert.ok(gone.events.some((e) => e.kind === "lost"));
  assert.equal(mayExhibit(gone.hz, j.key, j.until + 1).ok, false);
  assert.equal(mayExhibit(gone.hz, j.key, j.until + HAZARD_TABLE.tankJump.lostForMs + 5).ok, true);
});

test("an unhappy visitor warns first, forgives a fixed tank, and otherwise sues for half", () => {
  const bad = { tier: 1, exhibits: ["0-0", "0-1"] };
  let state: HazardState | null = null;
  const now = 2_000_000_000;
  for (let seed = 1; seed < 400 && !state; seed++) {
    const r = tickTank({ ...freshHazards(seed), lastSuit: 0 }, "full", bad, 1001, now);
    if (r.hz.grace) state = r.hz;
  }
  assert.ok(state?.grace, "a complaint comes");
  assert.equal(state!.grace - now, HAZARD_TABLE.lawsuit.graceMs);
  const fixed = tickTank(state!, "full", { tier: 1, exhibits: ["0-20", "0-21", "0-22", "0-23", "0-24", "0-19", "0-18", "0-17"] }, 1001, now + 1000);
  assert.equal(fixed.hz.grace, 0);
  assert.equal(fixed.c, 1001, "no lawsuit once it is fixed");
  const sued = tickTank(state!, "full", bad, 1001, state!.grace + 1);
  assert.equal(sued.c, 500, "half is gone");
  assert.ok(sued.events.some((e) => e.kind === "sued" && e.theyGet === 501 && e.youKeep === 500));
  assert.ok(/501/.test(sued.lines.join(" ")));
  assert.equal(sued.hz.grace, 0);
  /* A cooldown follows, so it cannot happen twice in a row. */
  const again = tickTank({ ...sued.hz, lastCheck: 0 }, "full", bad, 500, state!.grace + 60_000);
  assert.equal(again.hz.grace, 0);
});

test("with the dangers off, the tank is never touched and stale warnings clear", () => {
  const stale: HazardState = { ...freshHazards(1), jump: { key: "0-1", until: 5 }, grace: 9 };
  const r = tickTank(stale, "none", { tier: 0, exhibits: ["0-1"] }, 999, 100);
  assert.equal(r.hz.jump, null);
  assert.equal(r.hz.grace, 0);
  assert.deepEqual(r.exhibits, ["0-1"]);
  assert.equal(r.c, 999);
});

test("hazard state read from a hostile save is clamped", () => {
  const s = readHazards({ seed: -4, n: 1e99, sunk: 99, jump: { key: "x", until: 1 }, lostTank: { "0-1": 5, bad: 1 }, grace: "no" }, 77);
  assert.equal(s.jump, null);
  assert.equal(s.sunk, 8);
  assert.deepEqual(Object.keys(s.lostTank), ["0-1"]);
  assert.equal(s.grace, 0);
  assert.equal(readHazards("junk", 77).seed, 77);
});
