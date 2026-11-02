/* The tournament calendar (docs/architecture/06 §2.2).

   `schedule(nowMs)` is a pure function of the clock: the same minute gives the same
   events, on the server that writes them to the database and in any test. The server
   inserts them on demand (idempotent, keyed by id), so there is no cron job.

   Decisions the spec left open are written down in the WP-7 PR; the ones that shape this
   file: every event is fixed-gear (06 §1.4 needs the server to know the tackle, and a
   client cannot be trusted to say what it owns), weekly events carry a `series` so their
   three waters can be summed, and a "survival" event is only a seed and a date. */

import { BIOMES } from "./content.ts";
import { RULES_VERSION } from "./line-wear.ts";
import { seedFrom } from "./rng.ts";
import { CATEGORY_INFO, isCategory, type Category } from "./scoring.ts";

export type EventKind = "quick" | "daily" | "weekly" | "private" | "survival";

export type Rules = {
  category: Category;
  /** Most casts one angler may make. */
  castBudget: number;
  /** Most seconds of waiting + fighting one angler may use. */
  fishingSeconds: number;
  /** Helping Hand is never on in an event. */
  assist: false;
  /** Everyone fishes the same event tackle. */
  gear: "fixed";
  /** Most anglers (private events). */
  maxPlayers?: number;
  /** WP-8: a team event. Each angler picks a team; the board adds up Total Weight per team (06 §3.4). */
  team?: boolean;
  /** WP-14: the fight/line rules version every cast of this event is replayed with (docs/architecture/10 §1.6).
      A row written before WP-14 has none, which means version 1 (no line wear). */
  rulesVersion?: number;
};

export type EventSpec = {
  id: string;
  kind: EventKind;
  title: string;
  water: number;
  rules: Rules;
  seed: number;
  startsAt: number;
  endsAt: number;
  /** Events that add up together (the weekly's three waters). */
  series: string | null;
};

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export const QUICK_MINUTES = 10;
export const QUICK_CASTS = 40;
export const DAILY_CASTS = 150;
export const DAILY_SECONDS = 1200;
export const WEEKLY_CASTS = 150;
export const WEEKLY_SECONDS = 1500;
export const PRIVATE_MAX_PLAYERS = 16;
export const MAX_LIVE_PER_CREATOR = 3;

/** The eight waters Survival is played on (05 §5.2): Pond, River, Lake, Swamp, Mangrove, Coast, Kelp Forest, Arctic. */
export const SURVIVAL_WATERS: readonly number[] = [0, 1, 2, 3, 4, 5, 8, 9];

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** "2026-11-02" for a UTC instant. */
export function dateStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Midnight UTC at or before `ms`. */
export function dayStart(ms: number): number {
  return Math.floor(ms / DAY) * DAY;
}

/** The Monday 00:00 UTC at or before `ms` (1970-01-01 was a Thursday). */
export function weekStart(ms: number): number {
  const day = Math.floor(ms / DAY);
  const sinceMonday = (day + 3) % 7;
  return (day - sinceMonday) * DAY;
}

const DAILY_CATEGORY: Category[] = ["value", "big", "total", "sprint", "big", "total", "sprint"]; // Sun … Sat

export function eventSeed(id: string): number {
  return seedFrom("event", id);
}

function make(
  id: string,
  kind: EventKind,
  title: string,
  water: number,
  rules: Rules,
  startsAt: number,
  endsAt: number,
  series: string | null = null,
  seed = eventSeed(id),
): EventSpec {
  return { id, kind, title, water, rules, seed, startsAt, endsAt, series };
}

const rulesOf = (category: Category, castBudget: number, fishingSeconds: number): Rules => ({
  category,
  castBudget,
  fishingSeconds,
  assist: false,
  gear: "fixed",
  rulesVersion: RULES_VERSION,
});

/** The quick event that starts at the top of the hour containing `ms`. */
export function quickAt(ms: number): EventSpec {
  const h = Math.floor(ms / HOUR);
  const start = h * HOUR;
  const d = new Date(start);
  const stamp = `${dateStamp(start).replaceAll("-", "")}${pad(d.getUTCHours())}`;
  const water = h % BIOMES.length;
  const category: Category = (["big", "total", "sprint"] as const)[(h + Math.floor(h / BIOMES.length)) % 3];
  return make(
    `q-${stamp}`,
    "quick",
    `${BIOMES[water].name} Quick · ${CATEGORY_INFO[category].name}`,
    water,
    rulesOf(category, QUICK_CASTS, QUICK_MINUTES * 60),
    start,
    start + QUICK_MINUTES * MINUTE,
  );
}

/** The daily event for the UTC day containing `ms`. */
export function dailyAt(ms: number): EventSpec {
  const start = dayStart(ms);
  const day = Math.floor(start / DAY);
  const water = (day * 4 + 3) % BIOMES.length;
  const category = DAILY_CATEGORY[new Date(start).getUTCDay()];
  return make(
    `d-${dateStamp(start)}`,
    "daily",
    `${BIOMES[water].name} Daily · ${CATEGORY_INFO[category].name}`,
    water,
    rulesOf(category, DAILY_CASTS, DAILY_SECONDS),
    start,
    start + DAY,
  );
}

/** The three weekly events (one per water) for the Monday-to-Sunday week containing `ms`. */
export function weeklyAt(ms: number): EventSpec[] {
  const start = weekStart(ms);
  const week = Math.floor(start / (7 * DAY));
  const series = `w-${dateStamp(start)}`;
  return [0, 1, 2].map((k) => {
    const water = (week * 3 + k * 5 + 1) % BIOMES.length;
    return make(
      `${series}-${water}`,
      "weekly",
      `${BIOMES[water].name} Weekly · Total Weight`,
      water,
      rulesOf("total", WEEKLY_CASTS, WEEKLY_SECONDS),
      start,
      start + 7 * DAY,
      series,
    );
  });
}

/** The Survival daily seed for a date and water (05 §5.2). The run itself is WP-5's. */
export function survivalSeed(date: string, water: number): number {
  return seedFrom("survival", date, water);
}

export function survivalId(date: string, water: number): string {
  return `s-${date}-${water}`;
}

/** The Survival daily challenge for the UTC day containing `ms`. */
export function survivalAt(ms: number): EventSpec {
  const start = dayStart(ms);
  const date = dateStamp(start);
  const water = SURVIVAL_WATERS[Math.floor(start / DAY) % SURVIVAL_WATERS.length];
  return make(
    survivalId(date, water),
    "survival",
    `${BIOMES[water].name} Survival · Daily`,
    water,
    rulesOf("survival", 1, 1),
    start,
    start + DAY,
    null,
    survivalSeed(date, water),
  );
}

/** Every event that is live or coming up soon at `nowMs`: this and the next quick, today's and
    tomorrow's daily, this week's weekly three, and today's Survival. Sorted by start, then id. */
export function schedule(nowMs: number): EventSpec[] {
  const list = [quickAt(nowMs), quickAt(nowMs + HOUR), dailyAt(nowMs), dailyAt(nowMs + DAY), ...weeklyAt(nowMs), survivalAt(nowMs)];
  return list.sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
}

/* ── Private events ──────────────────────────────────────────────────────── */

/** Letters a code may use: no I, O, 0 or 1, so it reads the same aloud. */
export const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function isCode(v: unknown): v is string {
  return typeof v === "string" && /^[A-HJ-NP-Z]{4}$/.test(v);
}

export const PRIVATE_LIMITS = {
  minutes: [5, 180],
  castBudget: [5, 120],
  fishingSeconds: [60, 3600],
} as const;

const clampInt = (v: unknown, [lo, hi]: readonly [number, number], d: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d;
  return Math.min(hi, Math.max(lo, n));
};

/** A private event from what the host asked for (anything off falls back to a sensible default). */
export function privateSpec(
  code: string,
  water: unknown,
  ask: { category?: unknown; castBudget?: unknown; fishingSeconds?: unknown; team?: unknown } | null | undefined,
  minutes: unknown,
  now: number,
): EventSpec {
  const w = typeof water === "number" && Number.isInteger(water) && water >= 0 && water < BIOMES.length ? water : 0;
  const team = ask?.team === true;
  /* A team event always adds up Total Weight: it is the one thing that sums fairly across a team. */
  const category: Category = team ? "total" : isCategory(ask?.category) && ask?.category !== "survival" ? ask.category : "total";
  const mins = clampInt(minutes, PRIVATE_LIMITS.minutes, 15);
  const rules: Rules = {
    ...rulesOf(
      category,
      clampInt(ask?.castBudget, PRIVATE_LIMITS.castBudget, 40),
      clampInt(ask?.fishingSeconds, PRIVATE_LIMITS.fishingSeconds, mins * 60),
    ),
    maxPlayers: PRIVATE_MAX_PLAYERS,
    ...(team ? { team: true } : {}),
  };
  const id = `p-${code}`;
  const label = team ? "Team Total Weight" : CATEGORY_INFO[category].name;
  return make(id, "private", `${BIOMES[w].name} · ${label} (${code})`, w, rules, now, now + mins * MINUTE);
}
