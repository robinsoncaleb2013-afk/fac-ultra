/* Prestige (Update Three, P4): ready at level 100, +1 per Prestige, nothing wiped. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES } from "./content.ts";
import { fresh, type Save } from "./engine.ts";
import { canUnlockFinalBiome, doPrestige, finalBiomeIndex, PRESTIGE_LEVEL, prestigeReady } from "./prestige.ts";

const save = (over: Partial<Save> = {}): Save => ({ ...fresh(), ...over });

test("Prestige opens at level 100, not 99", () => {
  assert.equal(PRESTIGE_LEVEL, 100);
  assert.equal(prestigeReady(save({ lv: 99 })), false);
  assert.equal(prestigeReady(save({ lv: 100 })), true);
  assert.equal(prestigeReady(save({ lv: 140 })), true);
});

test("doPrestige refuses before level 100 and the save comes back unchanged", () => {
  const s = save({ lv: 99, prestige: 0 });
  assert.equal(doPrestige(s), s);
  assert.equal(s.prestige, 0);
});

test("doPrestige adds exactly one Prestige per call", () => {
  const once = doPrestige(save({ lv: 100, prestige: 0 }));
  assert.equal(once.prestige, 1);
  const twice = doPrestige(once);
  assert.equal(twice.prestige, 2, "each call is one Prestige, no more");
});

test("Prestige wipes nothing: gold, XP, level and the dex all stay", () => {
  const dex = { "0-0": { c: 5, w: 2.5, m: 1 }, "3-7": { c: 1, w: 30, m: 0 } };
  const s = save({ lv: 120, prestige: 0, c: 987_654, xp: 321, tot: 1_500_000, caught: 444, bosses: 12, dex });
  const out = doPrestige(s);
  assert.equal(out.prestige, 1);
  assert.equal(out.c, s.c, "gold kept");
  assert.equal(out.xp, s.xp, "XP kept — Prestige is not a reset");
  assert.equal(out.lv, s.lv, "level kept");
  assert.equal(out.tot, s.tot);
  assert.equal(out.caught, s.caught);
  assert.equal(out.bosses, s.bosses);
  assert.deepEqual(out.dex, dex, "the fish book is untouched");
  assert.deepEqual(out.ub, s.ub);
  assert.equal(s.prestige, 0, "the input save is not mutated");
});

test("the final-biome gate is closed at Prestige 0 and open at Prestige 1", () => {
  assert.equal(canUnlockFinalBiome(save({ prestige: 0 })), false);
  assert.equal(canUnlockFinalBiome(save({ prestige: 1 })), true);
  assert.equal(canUnlockFinalBiome(save({ prestige: 3 })), true);
  /* and the whole path in one line: level 100 → Prestige → gate open */
  assert.equal(canUnlockFinalBiome(doPrestige(save({ lv: 100, prestige: 0 }))), true);
});

test("the final biome is always the last one, never a hardcoded index", () => {
  assert.equal(finalBiomeIndex(20), 19);
  assert.equal(finalBiomeIndex(16), 15);
  assert.equal(finalBiomeIndex(1), 0);
  assert.equal(finalBiomeIndex(BIOMES.length), BIOMES.length - 1, "it tracks the live content list");
});
