/* Sticker dex and shiny fish (docs/architecture/05 §6.3).

   The dex is a book with one page per water: 25 cells, a grey silhouette until the
   species is caught, then its painted portrait. Finishing a page earns that water's
   page sticker. Every catch has a 2% chance to be shiny, a cosmetic sparkle with no
   power at all. Pure rules only; the look is in DexPanel.

   Shiny rolls use the unseeded `loose()` stream in the store (never the fishing `rng()`),
   so they cannot shift which fish bites, and nothing here is scored by a tournament. */

import { BIOMES, SPECIES_PER_BIOME, type Dex } from "./content.ts";
import type { Rng } from "./rng.ts";

/** One catch in fifty is shiny. */
export const SHINY_ODDS = 0.02;

export function rollShiny(r: Rng, odds: number = SHINY_ODDS): boolean {
  return r() < odds;
}

/** Sticker ids: `page-<water>` for a finished page, `frame-<water>-<species>` for a Fish of the Day gold frame. */
export const pageId = (biome: number) => `page-${biome}`;
export const frameId = (key: string) => `frame-${key}`;

const MAX_STICKERS = 400;
const MAX_SHINY = 375;

const SPECIES_KEY = /^\d{1,2}-\d{1,2}$/;

function validSticker(id: string): boolean {
  const page = /^page-(\d{1,2})$/.exec(id);
  if (page) return Number(page[1]) < BIOMES.length;
  const frame = /^frame-(\d{1,2})-(\d{1,2})$/.exec(id);
  return !!frame && Number(frame[1]) < BIOMES.length && Number(frame[2]) < SPECIES_PER_BIOME;
}

/** Stickers from untrusted data: known ids only, no repeats, clipped. */
export function readStickers(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string" || !validSticker(x) || out.includes(x)) continue;
    out.push(x);
    if (out.length >= MAX_STICKERS) break;
  }
  return out;
}

/** Species keys that have ever been shiny. */
export function readShiny(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string" || !SPECIES_KEY.test(x) || out.includes(x)) continue;
    const [b, i] = x.split("-").map(Number);
    if (b >= BIOMES.length || i >= SPECIES_PER_BIOME) continue;
    out.push(x);
    if (out.length >= MAX_SHINY) break;
  }
  return out;
}

/** All 25 cells of a water's page filled (the boss is the 25th). */
export function pageComplete(dex: Dex, biome: number): boolean {
  for (let i = 0; i < SPECIES_PER_BIOME; i++) if (!dex[`${biome}-${i}`]?.c) return false;
  return true;
}

/** Waters whose page is finished but whose page sticker is not yet stuck in. */
export function newPages(dex: Dex, stickers: readonly string[]): number[] {
  const out: number[] = [];
  for (let b = 0; b < BIOMES.length; b++) if (!stickers.includes(pageId(b)) && pageComplete(dex, b)) out.push(b);
  return out;
}

/** How many cells of a page are filled, 0 to 25. */
export function pageFill(dex: Dex, biome: number): number {
  let n = 0;
  for (let i = 0; i < SPECIES_PER_BIOME; i++) if (dex[`${biome}-${i}`]?.c) n++;
  return n;
}

/** A mutated fish earns a foil edge on its cell. */
export const hasFoil = (mutation: number) => mutation > 0;

/** The 25 cells in page order (5 rows of 5), by species index. */
export const PAGE_CELLS: readonly number[] = Array.from({ length: SPECIES_PER_BIOME }, (_, i) => i);

export const countStickers = (stickers: readonly string[]) => ({
  pages: stickers.filter((s) => s.startsWith("page-")).length,
  frames: stickers.filter((s) => s.startsWith("frame-")).length,
});
