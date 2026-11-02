/* A read-only look at a saved mode, for the main menu's Collections tab (WP-12).
   It reads the raw text a mode saved on this device and counts things. It never loads the save, never writes anything and
   never touches the live game, so looking at a collection from the main menu cannot change a game.
   Pure: the caller passes the storage reader, so a test can feed it any text. */

import { BIOMES, TOTAL_SPECIES } from "./content.ts";
import { MODES, type Mode } from "./modes.ts";
import { speciesKey } from "./records.ts";
import { hasSlots, slotCount, slotKey, slotName } from "./slots.ts";

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
export function peekText(mode: Mode, raw: string | null, book: "dex" | "sideDex" = "dex"): Peek {
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
  const dex = isObj(o[book]) ? (o[book] as Record<string, unknown>) : {};
  for (const [key, e] of Object.entries(dex)) {
    const sk = speciesKey(key);
    if (!sk || !isObj(e) || !(Number(e.c) > 0)) continue;
    out.found++;
    out.perWater[sk.b]++;
  }
  const records = book === "dex" && isObj(o.records) ? o.records : {};
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
export const COLLECTION_MODES: readonly Mode[] = ["expedition", "story", "recreational", "survival", "coop"];

export function peekMode(mode: Mode, read: (key: string) => string | null): Peek {
  let raw: string | null = null;
  try {
    raw = read(hasSlots(mode) ? slotKey(mode, 0) : MODES[mode].saveKey);
  } catch {
    raw = null;
  }
  return peekText(mode, raw);
}


/** One row of the Collections list (WP-16): a mode, or one save slot of a mode, or the Kids book kept inside a slot. */
export type CollectionEntry = { id: string; mode: Mode; title: string; sub: string; kids: boolean; peek: Peek };

/** Every collection worth showing, read-only: each used slot of Expedition and Story (with the Kids book beside it when it has
    fish), then the single-save modes. A mode with nothing saved still gets one row so the list never looks broken. */
export function collectionEntries(read: (key: string) => string | null): CollectionEntry[] {
  const safe = (k: string): string | null => {
    try {
      return read(k);
    } catch {
      return null;
    }
  };
  const out: CollectionEntry[] = [];
  const kinds = (n: number) => `${n} ${n === 1 ? "kind" : "kinds"} of fish`;
  for (const mode of COLLECTION_MODES) {
    if (!hasSlots(mode)) {
      const peek = peekText(mode, safe(MODES[mode].saveKey));
      out.push({ id: mode, mode, title: MODES[mode].title, sub: peek.saved ? kinds(peek.found) : "Nothing yet", kids: false, peek });
      continue;
    }
    let any = false;
    for (let slot = 0; slot < slotCount(mode); slot++) {
      const raw = safe(slotKey(mode, slot));
      const peek = peekText(mode, raw);
      if (!peek.saved) continue;
      let name = "";
      try {
        name = slotName((JSON.parse(raw as string) as { slotName?: unknown }).slotName, mode, slot);
      } catch {
        name = slotName(null, mode, slot);
      }
      any = true;
      out.push({ id: `${mode}-s${slot}`, mode, title: `${MODES[mode].title}: ${name}`, sub: kinds(peek.found), kids: false, peek });
      const kidsPeek = peekText(mode, raw, "sideDex");
      if (kidsPeek.found > 0) out.push({ id: `${mode}-s${slot}-kids`, mode, title: `Kids book: ${name}`, sub: kinds(kidsPeek.found), kids: true, peek: kidsPeek });
    }
    if (!any) {
      const peek = peekText(mode, null);
      out.push({ id: mode, mode, title: MODES[mode].title, sub: "Nothing yet", kids: false, peek });
    }
  }
  return out;
}
