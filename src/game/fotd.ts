/* Fish of the Day (docs/architecture/05 §6.4).

   One species per real day, chosen from the waters you have opened. Catch it today
   and your first one gives double XP and a gold frame sticker for its dex cell. The
   pick is a pure function of the date and your open waters, so it is the same all
   day and for everyone who has the same waters open.

   The pick looks only at the first 16 species of each water (slots 0 to 15), the ones a
   fresh visit to the water can always roll, so the daily fish is never out of reach. Opening
   a new water can change an unclaimed pick, which is fine: you can fish it right away. */

import { BIOMES } from "./content.ts";
import { makeRng, seedFrom } from "./rng.ts";

/** Species slots 0..15 of a water can always be rolled (the Shallows cap, content.ts `stageCap`). */
export const FOTD_SLOTS = 16;

export const FOTD_XP_MULT = 2;
export const MAX_CLAIMS = 60;

export type Fotd = { biome: number; species: number; key: string; name: string; water: string };

/** Today's date in the player's own time, YYYY-MM-DD (same rule as the Survival daily). */
export function today(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The Fish of the Day for `date`, among `unlocked` waters (biome indexes). Null only if no water is open. */
export function fotdFor(date: string, unlocked: readonly number[]): Fotd | null {
  const waters = [...new Set(unlocked)].filter((b) => b >= 0 && b < BIOMES.length).sort((a, b) => a - b);
  if (!waters.length) return null;
  const r = makeRng(seedFrom("fotd", date));
  const biome = waters[Math.floor(r() * waters.length)];
  const species = Math.floor(r() * FOTD_SLOTS);
  return { biome, species, key: `${biome}-${species}`, name: BIOMES[biome].fish[species], water: BIOMES[biome].name };
}

export const fotdClaimedToday = (claimed: readonly string[], date: string) => claimed.includes(date);

/** Does catching `key` on `date` claim the day's bonus? Only the first catch of the day counts. */
export function claimsFotd(fotd: Fotd | null, key: string, claimed: readonly string[], date: string): boolean {
  return !!fotd && fotd.key === key && !fotdClaimedToday(claimed, date);
}

/** File today's claim (newest last, the last 60 days kept). */
export function addClaim(claimed: readonly string[], date: string): string[] {
  if (claimed.includes(date)) return [...claimed];
  return [...claimed, date].slice(-MAX_CLAIMS);
}

export function readClaims(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x) || out.includes(x)) continue;
    out.push(x);
  }
  return out.slice(-MAX_CLAIMS);
}

/** How many days in a row, ending today or yesterday, you have claimed the daily fish. */
export function claimStreak(claimed: readonly string[], date: string): number {
  const set = new Set(claimed);
  const d = new Date(`${date}T12:00:00`);
  let n = 0;
  if (!set.has(date)) d.setDate(d.getDate() - 1);
  while (set.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
