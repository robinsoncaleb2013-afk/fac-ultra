/* Records (04 §7): your best fish with the whole story. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES } from "./content.ts";
import {
  bestInWater,
  beatsRecord,
  LAIR_SPOT,
  readRecords,
  recordLine,
  speciesKey,
  topRecords,
  withRecord,
  type CatchContext,
  type Records,
} from "./records.ts";

const ctx = (over: Partial<CatchContext> = {}): CatchContext => ({
  spot: "pond-pads",
  p: { family: "worm", depth: 0, retrieve: "slow" },
  weather: 1,
  window: "dusk",
  ...over,
});

test("the first fish of a species sets its record", () => {
  const r = withRecord({}, "0-13", 2.2, ctx(), 1000);
  assert.equal(r["0-13"].w, 2.2);
  assert.equal(r["0-13"].at, 1000);
  assert.equal(r["0-13"].spot, "pond-pads");
});

test("only a heavier fish takes the record; a tie does not", () => {
  const a = withRecord({}, "0-13", 2.2, ctx(), 1);
  assert.equal(withRecord(a, "0-13", 2.2, ctx({ spot: "pond-dock" }), 2), a, "unchanged object");
  assert.equal(withRecord(a, "0-13", 1.1, ctx(), 2), a);
  const b = withRecord(a, "0-13", 6.4, ctx({ spot: "pond-dock", window: "dawn" }), 3);
  assert.equal(b["0-13"].w, 6.4);
  assert.equal(b["0-13"].spot, "pond-dock");
  assert.equal(b["0-13"].window, "dawn");
  assert.equal(a["0-13"].w, 2.2, "the old object is not mutated");
});

test("a v5 save's dex weight counts as the record to beat, even without a story yet", () => {
  assert.equal(beatsRecord({}, "0-4", 2.0, 2.4), false);
  assert.equal(beatsRecord({}, "0-4", 2.6, 2.4), true);
  assert.deepEqual(withRecord({}, "0-4", 2.0, ctx(), 1, 2.4), {});
  assert.equal(withRecord({}, "0-4", 2.6, ctx(), 1, 2.4)["0-4"].w, 2.6);
});

test("records are per species", () => {
  let r: Records = {};
  r = withRecord(r, "0-13", 4, ctx(), 1);
  r = withRecord(r, "0-4", 1, ctx(), 2);
  assert.deepEqual(Object.keys(r).sort(), ["0-13", "0-4"]);
});

test("the record line tells the whole story in plain words", () => {
  const line = recordLine({ w: 6.4, at: 0, ...ctx() }, 0);
  assert.equal(line, "6.4 lb · The Lily Pads · worm, slow, shallow · dusk, rain");
  const lair = recordLine({ w: 80, at: 0, ...ctx({ spot: LAIR_SPOT, weather: 0, window: "night" }) }, 0);
  assert.match(lair, /Boss Lair/);
  assert.match(lair, /night, sunny/);
  const gone = recordLine({ w: 1, at: 0, ...ctx({ spot: "no-such-spot" }) }, 2);
  assert.ok(gone.includes(BIOMES[2].name), "a spot that no longer exists falls back to the water");
});

test("top records: heaviest first, ties go to the older, capped", () => {
  let r: Records = {};
  r = withRecord(r, "0-1", 3, ctx(), 5);
  r = withRecord(r, "0-2", 9, ctx(), 6);
  r = withRecord(r, "0-3", 3, ctx(), 2);
  r = withRecord(r, "1-0", 5, ctx(), 7);
  assert.deepEqual(topRecords(r, 3).map((x) => x.key), ["0-2", "1-0", "0-3"]);
  assert.equal(topRecords(r, 99).length, 4);
  assert.deepEqual(topRecords({}), []);
});

test("best in a water ignores other waters", () => {
  let r: Records = {};
  r = withRecord(r, "0-1", 3, ctx(), 1);
  r = withRecord(r, "0-2", 9, ctx(), 2);
  r = withRecord(r, "10-2", 99, ctx(), 3);
  assert.equal(bestInWater(r, 0)?.key, "0-2");
  assert.equal(bestInWater(r, 10)?.key, "10-2");
  assert.equal(bestInWater(r, 5), null);
});

test("species keys: only real waters and slots", () => {
  assert.deepEqual(speciesKey("0-24"), { b: 0, i: 24 });
  assert.deepEqual(speciesKey("14-0"), { b: 14, i: 0 });
  for (const bad of ["20-0", "0-25", "a-b", "0-", "-1-2", "0-1-2", ""]) assert.equal(speciesKey(bad), null, bad);
});

test("saved records are cleaned", () => {
  const good = { w: 3.3, at: 5, spot: "pond-pads", p: { family: "crank", depth: 2, retrieve: "fast" }, weather: 3, window: "night" };
  const r = readRecords({ "0-1": good, "0-2": { ...good, w: 0 }, "0-3": { ...good, w: 1e12 }, "0-4": "x", "9-99": good });
  assert.deepEqual(r["0-1"], good);
  assert.equal(r["0-2"], undefined);
  assert.equal(r["0-3"].w, 1e6);
  assert.equal(r["0-4"], undefined);
  assert.equal(r["9-99"], undefined);
});
