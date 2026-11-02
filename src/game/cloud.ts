/* The rules of cloud saves that both the server and the browser must agree on (docs/architecture/07 §4).
   Pure: no network, no storage, no store. The server uses `summarize` to describe a stored save; the
   browser uses `decideSync` to choose between pushing, pulling and asking the player. */

import { dexCount } from "./content.ts";

/** The modes whose saves go to the cloud. Tournaments keep their truth on the tournament server; Co-op
    is a local two-player slot but is still the family's save, so it travels too. */
export const SYNC_MODES = ["expedition", "recreational", "survival", "coop"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];

export const isSyncMode = (v: unknown): v is SyncMode => typeof v === "string" && (SYNC_MODES as readonly string[]).includes(v);

/** At most this many family profiles under one account (07 §3). */
export const MAX_PROFILES = 4;
/** The largest cloud save the server will take (07 §4.3). */
export const MAX_SAVE_BYTES = 256 * 1024;
/** How long the copy you did not keep stays available in Settings (07 §4.2). */
export const BACKUP_DAYS = 7;
export const BACKUP_MS = BACKUP_DAYS * 24 * 3600_000;
/** How long the browser waits after a save before sending it (07 §4.2). */
export const PUSH_DEBOUNCE_MS = 10_000;

/** What the chooser shows about one copy of a save. Every field is a plain count. */
export type Summary = { caught: number; tot: number; c: number; lv: number; species: number };

const EMPTY: Summary = { caught: 0, tot: 0, c: 0, lv: 0, species: 0 };

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/** Describe a save that has already been through sanitize()/sanitizeSurvival(). Never throws. */
export function summarize(mode: SyncMode, data: unknown): Summary {
  if (!data || typeof data !== "object") return EMPTY;
  const o = data as Record<string, unknown>;
  const dex = (o.dex && typeof o.dex === "object" ? o.dex : {}) as Parameters<typeof dexCount>[0];
  const species = dexCount(dex);
  if (mode === "survival") {
    let caught = 0;
    for (const e of Object.values(dex as Record<string, { c?: number }>)) caught += n(e?.c);
    const history = Array.isArray(o.history) ? o.history.length : 0;
    return { caught, tot: history, c: 0, lv: 0, species };
  }
  return { caught: Math.round(n(o.caught)), tot: n(o.tot), c: n(o.c), lv: Math.round(n(o.lv)), species };
}

/** Has anything been played in this save at all? A brand-new save has nothing worth protecting. */
export const hasProgress = (s: Summary): boolean => s.caught > 0 || s.tot > 0 || s.species > 0;

export type SyncAction = "none" | "push" | "pull" | "choose";

export type SyncInput = {
  /** This device's copy, or null when the slot is empty. */
  local: Summary | null;
  /** The cloud copy, or null when there is none. */
  cloud: Summary | null;
  /** The cloud revision now (0 when none). */
  cloudRev: number;
  /** The revision this device last synced (0 when never). */
  syncedRev: number;
  /** Has this device's copy changed since it last synced? */
  localChanged: boolean;
};

/** The one rule book (07 §4.2). Local is the truth while playing; the cloud is a safe copy.
    Nothing is ever replaced when both sides hold progress the other lacks: the player chooses. */
export function decideSync(i: SyncInput): SyncAction {
  const local = i.local && hasProgress(i.local) ? i.local : null;
  if (!i.cloud) return local ? "push" : "none";
  if (!local) return "pull";
  if (i.cloudRev === i.syncedRev && i.syncedRev > 0) return i.localChanged ? "push" : "none";
  /* The cloud moved on since this device last looked (or this device has never synced). */
  const cloudHas = i.cloud.caught >= local.caught && i.cloud.tot >= local.tot;
  const localHas = local.caught >= i.cloud.caught && local.tot >= i.cloud.tot;
  if (i.syncedRev > 0 && !i.localChanged) return i.cloud.caught >= local.caught || i.cloud.tot >= local.tot ? "pull" : "choose";
  if (cloudHas && localHas) return same(local, i.cloud);
  if (cloudHas) return "pull";
  if (localHas) return "push";
  return "choose";
}

/** Two copies with the same counts are the same save for a player's purposes: nothing to ask. */
function same(a: Summary, b: Summary): SyncAction {
  return a.caught === b.caught && a.tot === b.tot && a.c === b.c && a.species === b.species ? "none" : "choose";
}

/** "212 fish, $48K" for the chooser. `money` formats the coins (content.money). */
export function describe(s: Summary, money: (v: number) => string, mode: SyncMode): string {
  if (mode === "survival") return `${s.species} kinds of fish, ${s.tot} ${s.tot === 1 ? "run" : "runs"}`;
  /* Relaxed Fishing has no money: say how many kinds of fish are in its own book instead. */
  if (mode === "recreational") return `${s.caught} fish, ${s.species} kinds of fish`;
  return `${s.caught} fish, ${money(s.c)}`;
}

/** Which copy "keep the newer one" keeps: the one saved last. A tie keeps the cloud (it is already safe). */
export function newerOf(localAt: number, cloudAt: number): "device" | "cloud" {
  return localAt > cloudAt ? "device" : "cloud";
}

/** A small, stable fingerprint of text. Not secret: it only tells "changed" from "unchanged". */
export function fingerprint(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The text a save is fingerprinted by: the save without the Aquarium clock, which ticks on every load. */
export function changeKey(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const { tank: _tank, trip: _trip, ...rest } = raw as Record<string, unknown>;
  void _tank;
  void _trip;
  return fingerprint(JSON.stringify(rest));
}
