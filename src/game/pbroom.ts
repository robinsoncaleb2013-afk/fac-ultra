/* The Trophy Room (docs/architecture/12 §8): your personal bests, one plaque per kind of fish. Pure: it reads the records
   (04 §7) and the fish book the player already has and returns plain rows for the screen. Nothing new is saved. */

import { BIOMES, rarityOf } from "./content.ts";
import { recordLine, speciesKey, type Records } from "./records.ts";

type Dex = Record<string, { c: number; w: number; m: number }>;

export type Plaque = {
  key: string;
  biome: number;
  species: number;
  name: string;
  rarity: number;
  mutation: number;
  /** The heaviest one, in lb. */
  weight: number;
  /** Roughly how long it was, in inches. Worked out from the weight: no separate record is kept. */
  length: number;
  /** When it was caught (ms), or 0 when this best came from before records kept a story. */
  at: number;
  water: string;
  /** "6.4 lb · The Lily Pads · worm, slow, shallow · dusk, rain", or just the weight when the story is missing. */
  story: string;
  caught: number;
};

/** About how long a fish of this weight is. A 1 lb fish is 10 inches, an 8 lb fish 20, a 27 lb fish 30. */
export function lengthIn(weightLb: number): number {
  return Math.max(1, Math.round(10 * Math.cbrt(Math.max(0, weightLb))));
}

/** One plaque for every species caught in this book, heaviest first. */
export function plaques(records: Records, dex: Dex): Plaque[] {
  const out: Plaque[] = [];
  for (const [key, e] of Object.entries(dex)) {
    const sp = speciesKey(key);
    if (!sp || !e?.c) continue;
    const rec = records[key];
    const weight = Math.max(rec?.w ?? 0, e.w);
    out.push({
      key,
      biome: sp.b,
      species: sp.i,
      name: BIOMES[sp.b].fish[sp.i],
      rarity: rarityOf(sp.i),
      mutation: e.m,
      weight,
      length: lengthIn(weight),
      at: rec && rec.w >= e.w ? rec.at : 0,
      water: BIOMES[sp.b].name,
      story: rec && rec.w >= e.w ? recordLine(rec, sp.b) : `${weight} lb`,
      caught: e.c,
    });
  }
  return out.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
}

/** The biggest few for the centre of the wall. */
export const wallOfFame = (list: readonly Plaque[], n = 5): Plaque[] => list.slice(0, n);

/** Plaques of one water, in the order of the book. */
export const inWater = (list: readonly Plaque[], biome: number): Plaque[] => list.filter((p) => p.biome === biome).sort((a, b) => a.species - b.species);

export function dateLine(at: number): string {
  if (!at) return "";
  const d = new Date(at);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
