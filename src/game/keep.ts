/* Keep or release (docs/architecture/04 §6): the conservation loop.

   Every catch is applied the moment it lands, as a Keep, so nothing ever stalls
   waiting on a button. Releasing is the undo-with-a-reward: the fish leaves the bag,
   you earn 20% more XP for it, and releases add up to Steward tags and a bigger-fish
   bonus in that water. The dex and the records are untouched either way.

   All pure; the engine calls `releaseFish` and `stewardNote` and writes the result. */

import { BIOMES, xpNeed } from "./content.ts";

/** XP from releasing is the catch's XP times this. */
export const RELEASE_XP = 1.2;
/** Release a species this many times to become its Steward. */
export const STEWARD_SPECIES = 5;
/** Release this many fish in one water to unlock its size bonus. */
export const STEWARD_WATER = 25;
/** The permanent weight bonus in a water you are steward of. */
export const WATER_SIZE = 1.05;

/** Species: how many you released ("b-i" → n). */
export type Released = Record<string, number>;
/** Species tags earned ("b-i"), and waters whose bonus is unlocked (biome index). */
export type Stewards = { species: string[]; waters: number[] };

export const noStewards = (): Stewards => ({ species: [], waters: [] });

/** The XP a landed fish is worth before any release bonus. */
export function catchXp(rarity: number, mutation: number, biome: number, boss: boolean): number {
  return 3 + rarity * 8 + mutation * 5 + biome * 2 + (boss ? 12 : 0);
}

/** The extra XP a release adds on top of the catch's own. */
export function releaseBonusXp(xp: number): number {
  return Math.round(xp * (RELEASE_XP - 1));
}

/** Fish released in one water. */
export function waterReleased(released: Released, biome: number): number {
  let n = 0;
  for (const [key, count] of Object.entries(released)) if (key.startsWith(`${biome}-`)) n += count;
  return n;
}

/** Weight multiplier for fish rolled in this water. */
export function sizeMulOf(stewards: Stewards, biome: number): number {
  return stewards.waters.includes(biome) ? WATER_SIZE : 1;
}

export type BagFish = { name: string; t: number; v: number; w: number; i: number; b: number; m: number };

export type ReleaseSlice = {
  inv: BagFish[];
  xp: number;
  lv: number;
  released: Released;
  stewards: Stewards;
};

export type ReleaseResult =
  | { ok: false; why: "not-in-bag" }
  | {
      ok: true;
      inv: BagFish[];
      xp: number;
      lv: number;
      released: Released;
      stewards: Stewards;
      /** XP added by the release bonus. */
      bonusXp: number;
      levelsGained: number;
      speciesCount: number;
      waterCount: number;
      newSpecies: boolean;
      newWater: boolean;
    };

/** Release `fish` (the one just landed). It must still be in the bag — if it was sold, it cannot be let go. */
export function releaseFish(s: ReleaseSlice, fish: BagFish, catchXpGained: number): ReleaseResult {
  let at = -1;
  for (let k = s.inv.length - 1; k >= 0; k--) {
    const x = s.inv[k];
    if (x.name === fish.name && x.w === fish.w && x.v === fish.v && x.i === fish.i && x.b === fish.b && x.m === fish.m) {
      at = k;
      break;
    }
  }
  if (at < 0) return { ok: false, why: "not-in-bag" };
  const key = `${fish.b}-${fish.i}`;
  const speciesCount = (s.released[key] ?? 0) + 1;
  const released = { ...s.released, [key]: speciesCount };
  const waterCount = waterReleased(released, fish.b);
  const newSpecies = speciesCount >= STEWARD_SPECIES && !s.stewards.species.includes(key);
  const newWater = waterCount >= STEWARD_WATER && !s.stewards.waters.includes(fish.b);
  const stewards: Stewards = {
    species: newSpecies ? [...s.stewards.species, key] : s.stewards.species,
    waters: newWater ? [...s.stewards.waters, fish.b] : s.stewards.waters,
  };
  const bonusXp = releaseBonusXp(catchXpGained);
  let xp = s.xp + bonusXp;
  let lv = s.lv;
  let levelsGained = 0;
  while (xp >= xpNeed(lv)) {
    xp -= xpNeed(lv);
    lv += 1;
    levelsGained += 1;
  }
  return {
    ok: true,
    inv: s.inv.filter((_, k) => k !== at),
    xp,
    lv,
    released,
    stewards,
    bonusXp,
    levelsGained,
    speciesCount,
    waterCount,
    newSpecies,
    newWater,
  };
}

/** The line shown after a release, in plain words. */
export function releaseNote(r: Extract<ReleaseResult, { ok: true }>, name: string, biome: number): { message: string; detail: string; toasts: string[] } {
  const toasts: string[] = [];
  if (r.newSpecies) toasts.push(`Steward of the ${name}. You let ${STEWARD_SPECIES} go.`);
  if (r.newWater) toasts.push(`Steward of ${BIOMES[biome].name}. Bigger fish from now on.`);
  const left = STEWARD_SPECIES - r.speciesCount;
  const detail = r.newSpecies
    ? "You are this fish's Steward now."
    : left > 0
      ? `${left} more ${left === 1 ? "release" : "releases"} and you are its Steward.`
      : "";
  return { message: "Released. Swim well.", detail, toasts };
}

/** Untrusted save data → release counts. */
export function readReleased(v: unknown, valid: (key: string) => boolean): Released {
  const out: Released = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [key, n] of Object.entries(v as object)) {
    if (!valid(key)) continue;
    const c = typeof n === "number" && Number.isFinite(n) ? Math.min(1e9, Math.max(0, Math.round(n))) : 0;
    if (c > 0) out[key] = c;
  }
  return out;
}

/** Untrusted save data → stewards. A species tag is kept only if its key is valid; waters must be real. */
export function readStewards(v: unknown, valid: (key: string) => boolean, waters: number): Stewards {
  if (!v || typeof v !== "object" || Array.isArray(v)) return noStewards();
  const o = v as Record<string, unknown>;
  const species = Array.isArray(o.species)
    ? [...new Set(o.species.filter((k): k is string => typeof k === "string" && valid(k)))].slice(0, 400)
    : [];
  const ws = Array.isArray(o.waters)
    ? [
        ...new Set(
          o.waters
            .map((n) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n) : -1))
            .filter((n) => n >= 0 && n < waters),
        ),
      ]
    : [];
  return { species, waters: ws };
}
