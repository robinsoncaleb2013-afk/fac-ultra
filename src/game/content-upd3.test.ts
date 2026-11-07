/* Update Three, package P2: the world grows from 15 waters to 20.
   Five full new biomes × 25 species = 125 new fish (the spec's "75 new fish"
   would have broken the hard 25-per-biome invariant the dex keys, sanitize
   bounds and catch tables all assume, so the count over-delivers on purpose).
   NOTE: 20 × 25 = 500 total species. An early draft of the package brief said
   600; that is an arithmetic slip in the brief, flagged in INTEGRATION-P2.md. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES, BOSS_INDEX, SPECIES_PER_BIOME, TOTAL_SPECIES } from "./content.ts";
import { SPOTS } from "./spots.ts";

test("there are 20 biomes", () => {
  assert.equal(BIOMES.length, 20);
});

test("the dex holds 500 species: 20 waters of 25", () => {
  assert.equal(TOTAL_SPECIES, 500);
  assert.equal(TOTAL_SPECIES, BIOMES.length * SPECIES_PER_BIOME);
});

test("every biome has exactly 25 species", () => {
  for (const b of BIOMES) assert.equal(b.fish.length, SPECIES_PER_BIOME, b.name);
});

test("no species name repeats anywhere in the world", () => {
  const seen = new Set<string>();
  for (const b of BIOMES)
    for (const name of b.fish) {
      assert.ok(!seen.has(name), `duplicate species name: ${name}`);
      seen.add(name);
    }
  assert.equal(seen.size, TOTAL_SPECIES);
});

test("every biome has a boss at slot 24", () => {
  for (const b of BIOMES) {
    const boss = b.fish[BOSS_INDEX];
    assert.ok(typeof boss === "string" && boss.length > 0, `${b.name} boss`);
  }
});

test("biome ids are unique", () => {
  assert.equal(new Set(BIOMES.map((b) => b.id)).size, BIOMES.length);
});

test("prices climb for every purchasable biome; only the free Pond and the Prestige water are 0", () => {
  /* Index 0 (Pond) is the free starting water. Index 19 (The First Water) is
     the Prestige-gated final water and is priced 0 on purpose: the gate is
     the Prestige check the coordinator adds in the travel/buy path, not
     money (see INTEGRATION-P2.md). Every money-priced water in between must
     cost strictly more than the one before it. */
  assert.equal(BIOMES[0].price, 0);
  assert.equal(BIOMES[BIOMES.length - 1].price, 0);
  for (let i = 2; i < BIOMES.length - 1; i++)
    assert.ok(BIOMES[i].price > BIOMES[i - 1].price, `${BIOMES[i].name} should cost more than ${BIOMES[i - 1].name}`);
  assert.ok(BIOMES[1].price > 0);
});

test("the five new waters are the last five, in price order, ending at The First Water", () => {
  assert.deepEqual(
    BIOMES.slice(15).map((b) => b.id),
    ["mirror", "dream", "bones", "forge", "first"],
  );
  assert.equal(BIOMES[19].name, "The First Water");
});

test("SPOTS has five spots for each of the 20 biomes", () => {
  assert.equal(SPOTS.length, 20);
  SPOTS.forEach((list, b) => assert.equal(list.length, 5, BIOMES[b].name));
});
