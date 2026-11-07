/* Night fishing (Update Three, P3): the gates, the switch, and the away settle. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { baseValue, BIOMES } from "./content.ts";
import { fresh, type Save } from "./engine.ts";
import { catchXp } from "./keep.ts";
import {
  nightProgress,
  nightUnlocked,
  NIGHT_BOSSES_NEEDED,
  NIGHT_CAP_HOURS,
  NIGHT_CATCH_MS,
  NIGHT_LEVEL_NEEDED,
  settleNight,
  startNight,
} from "./night.ts";
import { makeRng } from "./rng.ts";

const T0 = 1_800_000_000_000;
const MIN = 60_000;

const save = (over: Partial<Save> = {}): Save => ({ ...fresh(), ...over });
/** A save that has earned night fishing. */
const unlocked = (over: Partial<Save> = {}): Save => save({ bosses: NIGHT_BOSSES_NEEDED, lv: NIGHT_LEVEL_NEEDED, ...over });
/** A save with night fishing switched on at T0. */
const nightOn = (over: Partial<Save> = {}): Save => unlocked({ night: { on: true, since: T0 }, ...over });
/** A rand that always draws the first weighted slot (species 0 of the water). */
const firstPick = () => 0;

test("the gates are the spec's: 5 bosses and level 45", () => {
  assert.equal(NIGHT_BOSSES_NEEDED, 5);
  assert.equal(NIGHT_LEVEL_NEEDED, 45);
  assert.equal(NIGHT_CAP_HOURS, 8);
  assert.equal(NIGHT_CATCH_MS, 4 * MIN, "about one fish per four minutes");
});

test("unlock truth table: bosses 4/5 by level 44/45 — both gates must pass", () => {
  assert.equal(nightUnlocked(save({ bosses: 4, lv: 44 })), false);
  assert.equal(nightUnlocked(save({ bosses: 4, lv: 45 })), false, "level alone is not enough");
  assert.equal(nightUnlocked(save({ bosses: 5, lv: 44 })), false, "bosses alone are not enough");
  assert.equal(nightUnlocked(save({ bosses: 5, lv: 45 })), true);
  assert.equal(nightUnlocked(save({ bosses: 9, lv: 80 })), true, "past both gates stays open");
});

test("nightProgress reports both goals and the unlock state for the hub card", () => {
  assert.deepEqual(nightProgress(save({ bosses: 3, lv: 31 })), {
    bosses: 3,
    bossesNeeded: 5,
    level: 31,
    levelNeeded: 45,
    unlocked: false,
  });
  assert.deepEqual(nightProgress(unlocked()), { bosses: 5, bossesNeeded: 5, level: 45, levelNeeded: 45, unlocked: true });
});

test("startNight refuses when locked, and the save comes back unchanged", () => {
  const lockedSave = save({ bosses: 5, lv: 44 });
  assert.equal(startNight(lockedSave, T0), lockedSave);
  const lockedSave2 = save({ bosses: 4, lv: 45 });
  assert.equal(startNight(lockedSave2, T0), lockedSave2);
});

test("startNight works when unlocked: night on, stamped with now, nothing else touched", () => {
  const s = unlocked({ c: 123 });
  const out = startNight(s, T0);
  assert.notEqual(out, s);
  assert.deepEqual(out.night, { on: true, since: T0 });
  assert.equal(out.c, 123);
  assert.equal(out.bosses, s.bosses);
  assert.deepEqual(s.night, { on: false, since: 0 }, "the input save is not mutated");
});

test("startNight refuses when night fishing is already on, keeping the first start time", () => {
  const s = nightOn();
  assert.equal(startNight(s, T0 + 60 * MIN), s);
  assert.equal(s.night.since, T0);
});

test("settling with night off is a no-op: same save, empty report", () => {
  const s = unlocked();
  const { s: out, report } = settleNight(s, T0 + 60 * MIN, makeRng(1));
  assert.equal(out, s);
  assert.deepEqual(report, { count: 0, gold: 0, xp: 0, names: [], hours: 0 });
});

test("ten minutes away settles two catches and pays gold and XP", () => {
  const s = nightOn({ c: 100, tot: 100 });
  const { s: out, report } = settleNight(s, T0 + 10 * MIN, firstPick);
  assert.equal(report.count, 2, "one fish per four minutes, rounded down");
  assert.ok(report.gold > 0 && report.xp > 0);
  /* rand () => 0 always picks species 0 (Bluegill in the Pond), so the pay is exact */
  assert.equal(report.gold, 2 * baseValue(0, 0));
  assert.equal(report.xp, 2 * catchXp(0, 0, 0, false));
  assert.deepEqual(report.names, ["Bluegill", "Bluegill"]);
  assert.equal(report.hours, 10 / 60);
  assert.equal(out.c, 100 + report.gold);
  assert.equal(out.tot, 100 + report.gold, "the night's gold counts toward the lifetime total");
  assert.equal(out.xp, s.xp + report.xp);
  assert.equal(out.caught, s.caught + 2);
  assert.equal(out.dex["0-0"]?.c, 2, "the dex count rises like a normal catch");
  assert.deepEqual(out.night, { on: false, since: 0 }, "collecting turns night fishing off");
});

test("a seeded settle after ten minutes also lands at least one catch with pay", () => {
  const { s: out, report } = settleNight(nightOn(), T0 + 10 * MIN, makeRng(42));
  assert.ok(report.count >= 1);
  assert.ok(report.gold > 0 && report.xp > 0);
  assert.equal(report.names.length, report.count);
  assert.equal(out.caught, report.count);
});

test("the settle respects the 8-hour cap: 24 hours away settles the capped count, not 360", () => {
  const { s: out, report } = settleNight(nightOn(), T0 + 24 * 60 * MIN, firstPick);
  assert.equal(report.hours, NIGHT_CAP_HOURS);
  assert.equal(report.count, (NIGHT_CAP_HOURS * 60 * MIN) / NIGHT_CATCH_MS, "120 catches");
  assert.notEqual(report.count, 360);
  assert.equal(report.gold, 120 * baseValue(0, 0));
  assert.equal(out.caught, 120);
  assert.deepEqual(out.night, { on: false, since: 0 });
});

test("settled fish come only from the save's current biome, and never the boss", () => {
  const s = nightOn({ biome: 2, ub: [0, 1, 2] });
  const { s: out, report } = settleNight(s, T0 + 40 * MIN, makeRng(7));
  assert.equal(report.count, 10);
  const lake = BIOMES[2].fish;
  for (const name of report.names) assert.ok(lake.includes(name), `${name} lives in the Lake`);
  assert.ok(!report.names.includes(lake[24]), "the boss is never a night catch");
  for (const key of Object.keys(out.dex)) assert.ok(key.startsWith("2-"), `${key} is a Lake key`);
  assert.equal(out.dex["2-24"], undefined);
});

test("a short night (under one catch interval) settles nothing but still turns off", () => {
  const { s: out, report } = settleNight(nightOn(), T0 + 3 * MIN, makeRng(3));
  assert.equal(report.count, 0);
  assert.equal(report.gold, 0);
  assert.equal(report.xp, 0);
  assert.deepEqual(out.night, { on: false, since: 0 });
});

test("settling does not mutate the save it was handed", () => {
  const s = nightOn({ dex: { "0-0": { c: 1, w: 2, m: 0 } } });
  const dexBefore = s.dex;
  const { s: out } = settleNight(s, T0 + 10 * MIN, firstPick);
  assert.equal(s.night.on, true, "the input still shows night on");
  assert.equal(s.dex["0-0"]?.c, 1, "the input dex is untouched");
  assert.equal(dexBefore, s.dex);
  assert.equal(out.dex["0-0"]?.c, 3, "the settled save carries the new count");
  assert.ok((out.dex["0-0"]?.w ?? 0) >= 2, "a better best weight is kept, never lowered");
});
