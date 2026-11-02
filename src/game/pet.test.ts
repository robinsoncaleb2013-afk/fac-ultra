import assert from "node:assert/strict";
import { test } from "node:test";
import { BOSS_INDEX, LURES } from "./content.ts";
import { habitOf } from "./habits.ts";
import {
  adopt,
  bestUncaught,
  chooseGift,
  GIFT_MS,
  GIFT_QTY,
  giftReady,
  minutesToGift,
  noPet,
  PET_KINDS,
  PET_LEVEL,
  petUnlocked,
  readPet,
  takeGift,
} from "./pet.ts";
import { defaultSpot } from "./spots.ts";

test("the pet opens at level 5 and there are three to choose from", () => {
  assert.equal(PET_LEVEL, 5);
  assert.deepEqual([...PET_KINDS], ["otter", "heron", "dog"]);
  assert.equal(petUnlocked(4), false);
  assert.equal(petUnlocked(5), true);
});

test("a new pet's first gift is ready at once, then one comes every real hour", () => {
  const t0 = 1_000_000;
  let pet = adopt(noPet(), "otter", t0);
  assert.equal(giftReady(pet, t0), true);
  pet = takeGift(pet, t0);
  assert.equal(giftReady(pet, t0 + GIFT_MS - 1), false);
  assert.equal(giftReady(pet, t0 + GIFT_MS), true);
  assert.equal(minutesToGift(pet, t0 + 30 * 60_000), 30);
  assert.equal(pet.gifts, 1);
  assert.equal(giftReady(noPet(), t0), false, "no pet, no gift");
  const swapped = adopt(pet, "dog", t0 + 10);
  assert.equal(swapped.kind, "dog");
  assert.equal(swapped.next, pet.next, "changing pets does not reset the hour");
});

test("the gift teaches the match: the lure family is one the target fish likes", () => {
  for (let biome = 0; biome < 15; biome++) {
    const spot = defaultSpot(biome);
    const g = chooseGift({ biome, spotId: spot.id, dex: {}, gifts: 0, kind: "heron" });
    assert.ok(LURES[g.lure], "a real lure");
    assert.equal(g.qty, GIFT_QTY);
    assert.ok(habitOf(biome, g.species).likes.includes(g.family), `water ${biome}: ${g.family} suits species ${g.species}`);
    assert.equal(LURES[g.lure].family, g.family);
    assert.ok(g.say.includes(LURES[g.lure].name));
    assert.ok(g.species < BOSS_INDEX);
  }
});

test("the gift aims at a fish you have not caught, and is the same for the same pet and count", () => {
  const spot = defaultSpot(0);
  const dex: Record<string, { c: number; w: number; m: number }> = {};
  const first = bestUncaught(0, spot, dex);
  dex[`0-${first}`] = { c: 1, w: 1, m: 0 };
  const second = bestUncaught(0, spot, dex);
  assert.notEqual(first, second);
  const a = chooseGift({ biome: 0, dex, gifts: 3, kind: "dog" });
  assert.deepEqual(a, chooseGift({ biome: 0, dex, gifts: 3, kind: "dog" }));
  assert.notEqual(a.species, first);
  const done: Record<string, { c: number; w: number; m: number }> = {};
  for (let i = 0; i < 24; i++) done[`0-${i}`] = { c: 1, w: 1, m: 0 };
  assert.equal(bestUncaught(0, spot, done), -1);
  assert.ok(chooseGift({ biome: 0, dex: done, gifts: 0, kind: "otter" }).lure >= 0, "a finished page still gets a gift");
});

test("saved pets are cleaned", () => {
  assert.deepEqual(readPet(null), noPet());
  assert.deepEqual(readPet({ kind: "dragon", next: 5 }), noPet());
  assert.deepEqual(readPet({ kind: "otter", next: -5, gifts: 1e12 }), { kind: "otter", next: 0, gifts: 99999 });
  assert.deepEqual(readPet({ kind: "dog", next: 12, gifts: 2.4 }), { kind: "dog", next: 12, gifts: 2 });
});
