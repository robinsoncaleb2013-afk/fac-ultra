/* Keep or release (04 §6): the economics. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { xpNeed } from "./content.ts";
import {
  catchXp,
  noStewards,
  readReleased,
  readStewards,
  releaseBonusXp,
  releaseFish,
  releaseNote,
  RELEASE_XP,
  sizeMulOf,
  STEWARD_SPECIES,
  STEWARD_WATER,
  waterReleased,
  WATER_SIZE,
  type BagFish,
  type ReleaseSlice,
} from "./keep.ts";

const fish = (over: Partial<BagFish> = {}): BagFish => ({ name: "Bluegill", t: 0, v: 8, w: 1.2, i: 0, b: 0, m: 0, ...over });
const slice = (over: Partial<ReleaseSlice> = {}): ReleaseSlice => ({
  inv: [fish()],
  xp: 0,
  lv: 1,
  released: {},
  stewards: noStewards(),
  ...over,
});

test("a catch's XP is what withCatch always paid, and a release adds 20% on top", () => {
  assert.equal(catchXp(0, 0, 0, false), 3);
  assert.equal(catchXp(2, 1, 3, false), 3 + 16 + 5 + 6);
  assert.equal(catchXp(4, 0, 9, true), 3 + 32 + 18 + 12);
  assert.equal(RELEASE_XP, 1.2);
  assert.equal(releaseBonusXp(100), 20);
  assert.equal(releaseBonusXp(3), 1);
});

test("releasing takes the fish out of the bag and pays the bonus XP, nothing else", () => {
  const s = slice({ inv: [fish({ name: "Perch", i: 2, w: 0.5 }), fish()] });
  const r = releaseFish(s, fish(), 30);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.inv, [fish({ name: "Perch", i: 2, w: 0.5 })], "only that fish left the bag");
  assert.equal(r.bonusXp, 6);
  assert.equal(r.xp, 6);
  assert.equal(r.speciesCount, 1);
  assert.deepEqual(r.released, { "0-0": 1 });
  assert.equal(r.newSpecies, false);
});

test("if the bag holds two identical fish, the newest one goes", () => {
  const a = fish();
  const s = slice({ inv: [a, fish({ name: "Perch" }), { ...a }] });
  const r = releaseFish(s, a, 3);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.inv.map((x) => x.name), ["Bluegill", "Perch"]);
});

test("a fish that was already sold cannot be released, and nothing changes", () => {
  const r = releaseFish(slice({ inv: [] }), fish(), 30);
  assert.deepEqual(r, { ok: false, why: "not-in-bag" });
});

test("the bonus XP can level you up", () => {
  const need = xpNeed(1);
  const r = releaseFish(slice({ xp: need - 2, lv: 1 }), fish(), 50);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.lv, 2);
  assert.equal(r.levelsGained, 1);
  assert.equal(r.xp, need - 2 + 10 - need);
});

test("the fifth release of a species makes you its Steward, once", () => {
  let s = slice({ inv: [] });
  let last: ReturnType<typeof releaseFish> = { ok: false, why: "not-in-bag" };
  for (let n = 1; n <= STEWARD_SPECIES + 2; n++) {
    s = { ...s, inv: [fish()] };
    last = releaseFish(s, fish(), 3);
    assert.ok(last.ok);
    if (!last.ok) return;
    assert.equal(last.speciesCount, n);
    assert.equal(last.newSpecies, n === STEWARD_SPECIES, `release ${n}`);
    s = { ...s, inv: last.inv, xp: last.xp, lv: last.lv, released: last.released, stewards: last.stewards };
  }
  assert.deepEqual(s.stewards.species, ["0-0"], "listed once");
});

test("25 releases in one water unlock its +5% size bonus, and the bonus is per water", () => {
  let s = slice({ inv: [] });
  let unlockedAt = 0;
  for (let n = 1; n <= STEWARD_WATER; n++) {
    /* spread over several species so no single species matters */
    const f = fish({ i: n % 5, name: `Fish ${n % 5}` });
    s = { ...s, inv: [f] };
    const r = releaseFish(s, f, 3);
    assert.ok(r.ok);
    if (!r.ok) return;
    if (r.newWater) unlockedAt = n;
    s = { ...s, inv: r.inv, xp: r.xp, lv: r.lv, released: r.released, stewards: r.stewards };
  }
  assert.equal(unlockedAt, STEWARD_WATER);
  assert.equal(waterReleased(s.released, 0), STEWARD_WATER);
  assert.equal(waterReleased(s.released, 1), 0);
  assert.equal(sizeMulOf(s.stewards, 0), WATER_SIZE);
  assert.equal(sizeMulOf(s.stewards, 1), 1);
  assert.equal(WATER_SIZE, 1.05);
});

test("releasing in another water does not count toward this one", () => {
  const s = slice({ inv: [fish({ b: 3 })], released: { "0-0": 24 } });
  const r = releaseFish(s, fish({ b: 3 }), 3);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.newWater, false);
    assert.equal(r.waterCount, 1);
  }
});

test("release notes are plain: how many more, and the Steward moments", () => {
  const first = releaseFish(slice(), fish(), 3);
  assert.ok(first.ok);
  if (!first.ok) return;
  const note = releaseNote(first, "Bluegill", 0);
  assert.equal(note.message, "Released. Swim well.");
  assert.match(note.detail, /4 more releases and you are its Steward/);
  const fifth = releaseFish(slice({ released: { "0-0": 4 } }), fish(), 3);
  assert.ok(fifth.ok);
  if (!fifth.ok) return;
  const n5 = releaseNote(fifth, "Bluegill", 0);
  assert.match(n5.detail, /Steward now/);
  assert.equal(n5.toasts.length, 1);
  const last = releaseFish(slice({ released: { "0-0": 4, "0-1": 20 } }), fish(), 3);
  assert.ok(last.ok);
  if (!last.ok) return;
  assert.equal(releaseNote(last, "Bluegill", 0).toasts.length, 2, "species and water in one go");
  const one = releaseFish(slice({ released: { "0-0": 3 } }), fish(), 3);
  if (one.ok) assert.match(releaseNote(one, "Bluegill", 0).detail, /1 more release and/);
});

test("saved release data is cleaned", () => {
  const valid = (k: string) => /^\d+-\d+$/.test(k);
  assert.deepEqual(readReleased({ "0-1": 2.4, "x": 1, "0-2": -1, "0-3": "5" }, valid), { "0-1": 2 });
  assert.deepEqual(readReleased(null, valid), {});
  assert.deepEqual(readStewards({ species: ["0-1", "0-1", "zz"], waters: [0, 0, 20, 14] }, valid, 15), {
    species: ["0-1"],
    waters: [0, 14],
  });
  assert.deepEqual(readStewards("nope", valid, 15), noStewards());
});
