/* Records: your best fish of every species, with the whole story of how you got it
   (docs/architecture/04 §7). Pure, so it is unit-tested and the server can reuse it.

   A record is set when a catch is heavier than everything before it for that species,
   including the best weight the dex already held before records existed (a v5 save has
   dex weights but no context; the next fish that beats the weight starts the story). */

import { BIOMES, SPECIES_PER_BIOME, WEATHER } from "./content.ts";
import {
  DEPTH_INFO,
  FAMILIES,
  FAMILY_INFO,
  RETRIEVE_INFO,
  WINDOW_INFO,
  WINDOWS,
  isDepth,
  isRetrieve,
  type Presentation,
  type Window,
} from "./presentation.ts";
import { spotById } from "./spots.ts";

/** The spot id stored for a boss caught in its Lair, which is not a cast spot. */
export const LAIR_SPOT = "lair";

export type RecordEntry = {
  /** Weight in lb. */
  w: number;
  /** When it was caught (ms since 1970). */
  at: number;
  /** Spot id, or "lair". */
  spot: string;
  p: Presentation;
  weather: number;
  window: Window;
};

/** Keyed by species, the same "b-i" key the dex uses. */
export type Records = Record<string, RecordEntry>;

/** What the cast looked like when the fish was hooked. */
export type CatchContext = Pick<RecordEntry, "spot" | "p" | "weather" | "window">;

/** Is `w` a new best for this species? `dexBest` is the dex's best weight before this catch. */
export function beatsRecord(records: Records, key: string, w: number, dexBest = 0): boolean {
  return w > Math.max(dexBest, records[key]?.w ?? 0);
}

/** The records after a catch; unchanged (same object) when it did not set one. */
export function withRecord(
  records: Records,
  key: string,
  w: number,
  ctx: CatchContext,
  at: number,
  dexBest = 0,
): Records {
  if (!beatsRecord(records, key, w, dexBest)) return records;
  return { ...records, [key]: { w, at, ...ctx } };
}

/** "6.4 lb · The Lily Pads · worm, slow, shallow · dusk, rain" */
export function recordLine(rec: RecordEntry, biome: number): string {
  const where = rec.spot === LAIR_SPOT ? "Boss Lair" : (spotById(biome, rec.spot)?.name ?? BIOMES[biome].name);
  const how = [
    FAMILY_INFO[rec.p.family].label.toLowerCase(),
    RETRIEVE_INFO[rec.p.retrieve].label.toLowerCase(),
    DEPTH_INFO[rec.p.depth].short,
  ].join(", ");
  const when = [WINDOW_INFO[rec.window].label.toLowerCase(), (WEATHER[rec.weather]?.name ?? "").toLowerCase()]
    .filter(Boolean)
    .join(", ");
  return `${rec.w} lb · ${where} · ${how} · ${when}`;
}

/** The heaviest records first. Ties keep the older one first. */
export function topRecords(records: Records, n = 5): { key: string; rec: RecordEntry }[] {
  return Object.entries(records)
    .map(([key, rec]) => ({ key, rec }))
    .sort((a, b) => b.rec.w - a.rec.w || a.rec.at - b.rec.at)
    .slice(0, n);
}

/** The best fish you have ever landed in one water, or null. */
export function bestInWater(records: Records, biome: number): { key: string; rec: RecordEntry } | null {
  let best: { key: string; rec: RecordEntry } | null = null;
  for (const [key, rec] of Object.entries(records)) {
    if (!key.startsWith(`${biome}-`)) continue;
    if (!best || rec.w > best.rec.w) best = { key, rec };
  }
  return best;
}

export function speciesKey(key: string): { b: number; i: number } | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(key);
  if (!m) return null;
  const b = Number(m[1]);
  const i = Number(m[2]);
  return b < BIOMES.length && i < SPECIES_PER_BIOME ? { b, i } : null;
}

/** Untrusted save data → records. Unknown species, bad weights and broken context are dropped;
    a spot that no longer exists in that water falls back to the water's name when shown. */
export function readRecords(v: unknown): Records {
  const out: Records = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [key, raw] of Object.entries(v as object)) {
    if (!speciesKey(key) || !raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const w = typeof r.w === "number" && Number.isFinite(r.w) ? Math.min(1e6, Math.max(0, r.w)) : 0;
    if (w <= 0) continue;
    const p = (r.p ?? {}) as Record<string, unknown>;
    const family = FAMILIES.find((f) => f === p.family) ?? "worm";
    out[key] = {
      w,
      at: typeof r.at === "number" && Number.isFinite(r.at) ? Math.min(1e16, Math.max(0, r.at)) : 0,
      spot: typeof r.spot === "string" ? r.spot.slice(0, 40) : "",
      p: {
        family,
        depth: isDepth(p.depth) ? p.depth : 1,
        retrieve: isRetrieve(p.retrieve) ? p.retrieve : "medium",
      },
      weather: typeof r.weather === "number" && r.weather >= 0 && r.weather <= 4 ? Math.round(r.weather) : 0,
      window: WINDOWS.find((x) => x === r.window) ?? "day",
    };
  }
  return out;
}
