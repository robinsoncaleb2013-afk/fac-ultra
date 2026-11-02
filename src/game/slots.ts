/* Save slots (docs/architecture/12 §5). Expedition and Story each have up to MAX_SLOTS saves; every other mode keeps
   its one slot. Slot 0 of a mode uses the key that mode has always used, so no save moves or is renamed.
   Pure: the storage is passed in, so every rule here is unit-tested without a browser. */

import { MODES, type Mode } from "./modes.ts";
import { isDifficulty, type Difficulty } from "./difficulty.ts";
import { safeName } from "./safe.ts";

/** The most save slots a mode can have. This is the one number to change if more slots are ever offered.
    (There is deliberately no "buy more slots" button anywhere yet; docs/architecture/12 §5.) */
export const MAX_SLOTS = 3;

/** The modes with slots. */
export const SLOT_MODES: readonly Mode[] = ["expedition", "story"];
export const hasSlots = (mode: Mode): boolean => SLOT_MODES.includes(mode);
export const slotCount = (mode: Mode): number => (hasSlots(mode) ? MAX_SLOTS : 1);

export const clampSlot = (mode: Mode, slot: unknown): number => {
  const n = typeof slot === "number" && Number.isInteger(slot) ? slot : 0;
  return Math.min(slotCount(mode) - 1, Math.max(0, n));
};

/** The localStorage key of a slot. Slot 0 is the mode's original key. */
export function slotKey(mode: Mode, slot: number): string {
  const base = MODES[mode].saveKey;
  const s = clampSlot(mode, slot);
  return s === 0 ? base : `${base}-s${s}`;
}

/** The id the cloud uses for a slot ("expedition", "expedition-s1", "story-s2"). It is also the `mode` column of the saves table. */
export function syncId(mode: Mode, slot: number): string {
  const s = clampSlot(mode, slot);
  return s === 0 ? mode : `${mode}-s${s}`;
}

/** The inverse of syncId, or null for anything that is not a real slot. */
export function parseSyncId(id: unknown): { mode: Mode; slot: number } | null {
  if (typeof id !== "string") return null;
  const m = /^(expedition|story|recreational|survival|coop)(?:-s([1-9]))?$/.exec(id);
  if (!m) return null;
  const mode = m[1] as Mode;
  const slot = m[2] ? Number(m[2]) : 0;
  if (slot >= slotCount(mode)) return null;
  return { mode, slot };
}

/** Every slot of every mode that the cloud may hold. Tournament is not one of them. */
export function allSyncIds(): string[] {
  const out: string[] = [];
  for (const mode of ["expedition", "story", "recreational", "survival", "coop"] as const) {
    for (let s = 0; s < slotCount(mode); s++) out.push(syncId(mode, s));
  }
  return out;
}

/** The mode a sync id belongs to ("expedition-s1" → "expedition"). */
export const modeOfSyncId = (id: string): Mode | null => parseSyncId(id)?.mode ?? null;

/* ── The slot card ───────────────────────────────────────────────────────── */

export type SlotCard = {
  mode: Mode;
  slot: number;
  empty: boolean;
  name: string;
  difficulty: Difficulty;
  lv: number;
  caught: number;
  species: number;
  c: number;
  chapter: number;
};

export const defaultSlotName = (mode: Mode, slot: number): string => (mode === "story" ? `Story ${slot + 1}` : `Adventure ${slot + 1}`);

const n = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : d);

/** A friendly slot name: letters and numbers, up to 20, and nothing rude. Falls back to the default. */
export const slotName = (v: unknown, mode: Mode, slot: number): string => safeName(v, defaultSlotName(mode, slot));

/** A card from the raw JSON of a slot (as read from storage and parsed), or an empty card. Never throws. */
export function cardFromRaw(mode: Mode, slot: number, raw: unknown): SlotCard {
  const empty: SlotCard = { mode, slot, empty: true, name: defaultSlotName(mode, slot), difficulty: "normal", lv: 1, caught: 0, species: 0, c: 0, chapter: 0 };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const o = raw as Record<string, unknown>;
  const dex = o.dex && typeof o.dex === "object" ? Object.values(o.dex as object) : [];
  const story = o.story && typeof o.story === "object" ? (o.story as Record<string, unknown>) : {};
  return {
    mode,
    slot,
    empty: !n(o.created) && !n(o.caught) && !n(o.tot) && !dex.some((e) => e && typeof e === "object" && n((e as { c?: unknown }).c) > 0),
    name: slotName(o.slotName, mode, slot),
    difficulty: isDifficulty(o.difficulty) ? o.difficulty : "normal",
    lv: Math.max(1, n(o.lv, 1)),
    caught: n(o.caught),
    species: dex.filter((e) => e && typeof e === "object" && n((e as { c?: unknown }).c) > 0).length,
    c: n(o.c),
    chapter: n(story.chapter),
  };
}

/** The cards for a mode, one per slot, from a `read(key)` that returns the stored text (or null). */
export function slotCards(mode: Mode, read: (key: string) => string | null): SlotCard[] {
  const out: SlotCard[] = [];
  for (let s = 0; s < slotCount(mode); s++) {
    let raw: unknown = null;
    try {
      const text = read(slotKey(mode, s));
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = null;
    }
    out.push(cardFromRaw(mode, s, raw));
  }
  return out;
}

/** The first empty slot, or -1 when all are used. */
export const firstFree = (cards: readonly SlotCard[]): number => cards.findIndex((c) => c.empty);

/* ── Which slot is open in each mode (a small device-level note) ─────────── */

export const ACTIVE_SLOTS_KEY = "fac-ultra-slots";
export type ActiveSlots = Partial<Record<Mode, number>>;

export function readActiveSlots(text: string | null): ActiveSlots {
  try {
    const o = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    const out: ActiveSlots = {};
    for (const mode of SLOT_MODES) out[mode] = clampSlot(mode, o?.[mode]);
    return out;
  } catch {
    return {};
  }
}
