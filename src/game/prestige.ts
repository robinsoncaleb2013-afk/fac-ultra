/* Prestige (Update Three, P4).

   Reach level 100 and you can Prestige. Prestiging raises the Prestige count
   by one and unlocks the final water. It resets NOTHING: the spec says
   Prestige unlocks the final biome, it does not say progress is wiped, and
   wiping a player's (a kid's) save on a guess would be wrong. Gold, XP, level,
   the dex — everything stays exactly as it was.

   Pure: no store, no browser. */

import type { Save } from "./engine.ts";

/** The level Prestige opens at. */
export const PRESTIGE_LEVEL = 100;

/** Prestige is ready once the stored level reaches `PRESTIGE_LEVEL`. */
export function prestigeReady(s: Save): boolean {
  return s.lv >= PRESTIGE_LEVEL;
}

/** Prestige once: the count goes up by one and nothing else changes. Not ready: the save comes back unchanged. */
export function doPrestige(s: Save): Save {
  if (!prestigeReady(s)) return s;
  return { ...s, prestige: s.prestige + 1 };
}

/** The final water opens at Prestige 1. */
export function canUnlockFinalBiome(s: Save): boolean {
  return s.prestige >= 1;
}

/**
 * The index of the final biome in a world of `biomeCount` waters: always the
 * last one. Never hardcode it — content is being extended in parallel, so the
 * final water is wherever the list ends (`BIOMES.length` today).
 */
export function finalBiomeIndex(biomeCount: number): number {
  return biomeCount - 1;
}
