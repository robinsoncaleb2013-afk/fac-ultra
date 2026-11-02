/* Recreational trips (docs/architecture/05 §3).
   A trip is one visit to a water: you pick the water, the time of day and the
   weather, fish, and when you pack up you get a trip card. The creel is just the
   fish kept on the current trip. Pure and unit-tested; the store wires it in. */

import { BIOMES, WEATHER } from "./content.ts";
import { windowOf } from "./match.ts";
import { WINDOWS, WINDOW_INFO, type Window } from "./presentation.ts";

/** How many finished trips the logbook keeps. */
export const MAX_TRIPS = 50;
/** A trip left untouched this long is closed the next time the game opens. */
export const TRIP_IDLE_MS = 30 * 60_000;

export type TripWindow = Window | "clock";

export type TripBest = { n: string; w: number; t: number };

export type Trip = {
  /** ms since 1970. */
  start: number;
  /** 0 while the trip is still open. */
  end: number;
  /** The last time something happened on it (a catch, a release). */
  last: number;
  water: number;
  /** "clock" follows the real time of day. */
  window: TripWindow;
  /** -1 = whatever the weather does; 0..3 = the one you picked. */
  weather: number;
  caught: number;
  kept: number;
  released: number;
  /** Weight of the fish in the creel right now, in lb. */
  keptLb: number;
  /** Weight of every fish landed, in lb. */
  totalLb: number;
  best: TripBest | null;
  /** Names of species new to your collection. */
  fresh: string[];
  /** Names of species where you set a new personal best. */
  recs: string[];
};

/** The weather you can pick for a trip (Night is a time of day, so it is not here). */
export const PICKABLE_WEATHER = [0, 1, 2, 3] as const;

const NAME_CAP = 30;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function startTrip(now: number, water: number, window: TripWindow = "clock", weather = -1): Trip {
  return {
    start: now,
    end: 0,
    last: now,
    water: Math.min(BIOMES.length - 1, Math.max(0, Math.round(water))),
    window,
    weather: PICKABLE_WEATHER.includes(weather as 0) ? weather : -1,
    caught: 0,
    kept: 0,
    released: 0,
    keptLb: 0,
    totalLb: 0,
    best: null,
    fresh: [],
    recs: [],
  };
}

export type TripCatch = { name: string; w: number; rarity: number; discovered: boolean; record: boolean };

/** A fish landed on this trip. It starts in the creel; letting it go is `tripRelease`. */
export function tripCatch(t: Trip, c: TripCatch, now: number): Trip {
  const best = !t.best || c.w > t.best.w ? { n: c.name, w: r1(c.w), t: c.rarity } : t.best;
  return {
    ...t,
    last: now,
    caught: t.caught + 1,
    kept: t.kept + 1,
    keptLb: r1(t.keptLb + c.w),
    totalLb: r1(t.totalLb + c.w),
    best,
    fresh: c.discovered && !t.fresh.includes(c.name) ? [...t.fresh, c.name].slice(-NAME_CAP) : t.fresh,
    recs: c.record && !t.recs.includes(c.name) ? [...t.recs, c.name].slice(-NAME_CAP) : t.recs,
  };
}

/** The last fish was let go: out of the creel, onto the released count. */
export function tripRelease(t: Trip, w: number, now: number): Trip {
  if (t.kept <= 0) return t;
  return { ...t, last: now, kept: t.kept - 1, released: t.released + 1, keptLb: Math.max(0, r1(t.keptLb - w)) };
}

export function finishTrip(t: Trip, now: number): Trip {
  return { ...t, end: Math.max(t.start, now) };
}

/** Newest first, only the last MAX_TRIPS. */
export function addTrip(trips: readonly Trip[], t: Trip, max = MAX_TRIPS): Trip[] {
  return [t, ...trips].slice(0, max);
}

/** Has this open trip sat unused so long it should be closed when the game opens? */
export function tripIsStale(t: Trip, now: number, idle = TRIP_IDLE_MS): boolean {
  return t.end === 0 && now - t.last > idle;
}

/** What is in the creel, as one friendly line. */
export function creelLine(count: number, lb: number): string {
  if (count <= 0) return "Creel today: empty";
  return `Creel today: ${count} fish, ${r1(lb).toFixed(1)} lb`;
}

export function tripMinutes(t: Trip): number {
  const end = t.end || t.last;
  return Math.max(0, Math.round((end - t.start) / 60_000));
}

/** The window the trip was fished in: the one you picked, or the one the clock said when it began. */
export function tripWindowOf(t: Trip): Window {
  if (t.window !== "clock") return t.window;
  const d = new Date(t.start);
  return windowOf(d.getHours() + d.getMinutes() / 60);
}

const WEATHER_PHRASE = ["in the sun", "in the rain", "in a storm", "in the fog"];

/** "The River at dawn in the rain". */
export function tripTitle(t: Trip): string {
  const water = BIOMES[t.water]?.name ?? "the water";
  const win = tripWindowOf(t);
  const when = win === "day" ? "in the daytime" : win === "night" ? "at night" : `at ${win}`;
  const weather = t.weather >= 0 && t.weather < WEATHER_PHRASE.length ? ` ${WEATHER_PHRASE[t.weather]}` : "";
  return `${water} ${when}${weather}`;
}

/** The one-line story: "Caught 9, kept 6. Biggest: a 3.4 lb Brown Trout. 2 new species." */
export function tripHeadline(t: Trip): string {
  if (t.caught === 0) return "No bites this time. That happens to everyone.";
  const parts = [`Caught ${t.caught}`];
  if (t.released > 0) parts.push(`let ${t.released} go`);
  let line = `${parts.join(", ")}.`;
  if (t.best) line += ` Biggest: ${t.best.n}, ${r1(t.best.w).toFixed(1)} lb.`;
  if (t.fresh.length) line += ` ${t.fresh.length} new species.`;
  if (t.recs.length) line += ` ${t.recs.length} personal ${t.recs.length === 1 ? "best" : "bests"}.`;
  return line;
}

export type CardInput = { trip: Trip; creelCount: number; creelLb: number };

/** What the trip card says when you pack up (creel summary included). */
export function tripCardLines(c: CardInput): string[] {
  const lines = [tripHeadline(c.trip)];
  lines.push(creelLine(c.creelCount, c.creelLb));
  const mins = tripMinutes(c.trip);
  lines.push(mins < 1 ? "Less than a minute on the water." : `${mins} ${mins === 1 ? "minute" : "minutes"} on the water.`);
  return lines;
}

/* ── Picking the time of day and the weather ─────────────────────────────── */

const HOUR: Record<Window, number> = { dawn: 6, day: 12, dusk: 18, night: 22 };

/** A clock hour inside the window, so the painting's tint matches a picked time. */
export function windowHour(w: Window): number {
  return HOUR[w];
}

export function windowLabel(w: TripWindow): string {
  return w === "clock" ? "Real time" : WINDOW_INFO[w].label;
}

export function weatherLabel(w: number): string {
  return w < 0 ? "Whatever comes" : (WEATHER[w]?.name ?? "Sunny");
}

/* ── Photo mode caption (05 §3) ──────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function photoCaption(o: { water: number; fish?: { name: string; w: number } | null; at: Date }): string {
  const water = BIOMES[o.water]?.name ?? "";
  const date = `${o.at.getDate()} ${MONTHS[o.at.getMonth()]} ${o.at.getFullYear()}`;
  const fish = o.fish ? ` · ${o.fish.name}, ${r1(o.fish.w).toFixed(1)} lb` : "";
  return `${water}${fish} · ${date}`;
}

/* ── Untrusted save data ─────────────────────────────────────────────────── */

const n = (v: unknown, d: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

function names(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 60)).slice(0, NAME_CAP);
}

/** One trip from untrusted data, or null if it is not a trip. */
export function readTrip(v: unknown): Trip | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const start = n(o.start, 0, 0, 1e16);
  if (!start) return null;
  const b = o.best && typeof o.best === "object" ? (o.best as Record<string, unknown>) : null;
  const win = WINDOWS.find((x) => x === o.window) ?? "clock";
  const caught = Math.round(n(o.caught, 0, 0, 1e6));
  const released = Math.min(caught, Math.round(n(o.released, 0, 0, 1e6)));
  const kept = Math.min(caught - released, Math.round(n(o.kept, caught - released, 0, 1e6)));
  const weather = Math.round(n(o.weather, -1, -1, 3));
  return {
    start,
    end: n(o.end, 0, 0, 1e16),
    last: n(o.last, start, 0, 1e16),
    water: Math.round(n(o.water, 0, 0, BIOMES.length - 1)),
    window: win,
    weather,
    caught,
    kept,
    released,
    keptLb: r1(n(o.keptLb, 0, 0, 1e7)),
    totalLb: r1(n(o.totalLb, 0, 0, 1e7)),
    best:
      b && n(b.w, 0, 0, 1e6) > 0
        ? {
            n: typeof b.n === "string" ? b.n.slice(0, 60) : "Fish",
            w: r1(n(b.w, 0, 0, 1e6)),
            t: Math.round(n(b.t, 0, 0, 4)),
          }
        : null,
    fresh: names(o.fresh),
    recs: names(o.recs),
  };
}

/** The saved logbook: finished trips only, newest first, at most MAX_TRIPS. */
export function readTrips(v: unknown): Trip[] {
  if (!Array.isArray(v)) return [];
  const out: Trip[] = [];
  for (const x of v) {
    const t = readTrip(x);
    if (t && t.end > 0) out.push(t);
    if (out.length >= MAX_TRIPS) break;
  }
  return out;
}
