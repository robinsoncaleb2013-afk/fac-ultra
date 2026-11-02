/* A read-only look at a saved mode, for the main menu's Collections tab (WP-12).
   It reads the raw text a mode saved on this device and counts things. It never loads the save, never writes anything and
   never touches the live game, so looking at a collection from the main menu cannot change a game.
   Pure: the caller passes the storage reader, so a test can feed it any text. */

import { BIOMES, TOTAL_SPECIES } from "./content.ts";
import { MODES, type Mode } from "./modes.ts";
import { speciesKey } from "./records.ts";

export type PeekBest = { b: number; i: number; name: string; w: number };

export type Peek = {
  mode: Mode;
  /** Something has been saved for this mode on this device. */
  saved: boolean;
  /** Different kinds of fish found. */
  found: number;
  total: number;
  /** Fish found in each water, in the order of BIOMES. */
  perWater: number[];
  /** The five heaviest fish. */
  best: PeekBest[];
  /** Medals in the trophy cabinet. */
  trophies: number;
  /** Player level (0 when nothing is saved). */
  level: number;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function emptyPeek(mode: Mode): Peek {
  return { mode, saved: false, found: 0, total: TOTAL_SPECIES, perWater: BIOMES.map(() => 0), best: [], trophies: 0, level: 0 };
}

/** Count what is in a saved mode's text. Anything unreadable counts as nothing saved. */
export function peekText(mode: Mode, raw: string | null): Peek {
  const out = emptyPeek(mode);
  if (!raw) return out;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!isObj(o)) return out;
  out.saved = true;
  const dex = isObj(o.dex) ? o.dex : {};
  for (const [key, e] of Object.entries(dex)) {
    const sk = speciesKey(key);
    if (!sk || !isObj(e) || !(Number(e.c) > 0)) continue;
    out.found++;
    out.perWater[sk.b]++;
  }
  const records = isObj(o.records) ? o.records : {};
  const rows: PeekBest[] = [];
  for (const [key, e] of Object.entries(records)) {
    const sk = speciesKey(key);
    if (!sk || !isObj(e) || !(Number(e.w) > 0)) continue;
    rows.push({ b: sk.b, i: sk.i, name: BIOMES[sk.b].fish[sk.i] ?? "A fish", w: Number(e.w) });
  }
  out.best = rows.sort((a, b) => b.w - a.w).slice(0, 5);
  out.trophies = Array.isArray(o.trophies) ? o.trophies.length : 0;
  out.level = Number(o.lv) > 0 ? Math.floor(Number(o.lv)) : 1;
  return out;
}

/** The modes whose collections the main menu can show: the ones that keep one. A tournament slot is a throwaway. */
export const COLLECTION_MODES: readonly Mode[] = ["expedition", "recreational", "survival", "coop"];

export function peekMode(mode: Mode, read: (key: string) => string | null): Peek {
  let raw: string | null = null;
  try {
    raw = read(MODES[mode].saveKey);
  } catch {
    raw = null;
  }
  return peekText(mode, raw);
}

