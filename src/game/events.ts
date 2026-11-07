/* Rare long-play events and the mutations they hand out (docs/architecture/11-events-and-mutations.md).

   Pure and deterministic: no store, no browser, no Math.random(), and NO import of the shared `rng` stream. Everything
   random here comes from makeRng(seedFrom(save seed, ...)), so a test can run a whole 10-hour session on a fake clock
   and a tournament's replayed stream is never touched. The engine owns the clock and the toasts; this file owns the rules. */

import { BIOMES, FIRST_EVENT_MUTATION, MUTATIONS } from "./content.ts";
import {
  AWAY_RESET_MS,
  COOLDOWN_MS,
  EVENT_RARITIES,
  EVENTS,
  HOLIDAY_FISH_SHARE,
  HOLIDAY_MULT,
  HOUR_MS,
  IDLE_MS,
  type EventDef,
  type EventRarityDef,
} from "./event-data.ts";
import { holidayOn, type ActiveHoliday } from "./holidays.ts";
import { makeRng, seedFrom } from "./rng.ts";
import type { ModeRules } from "./modes.ts";

export { EVENTS, EVENT_RARITIES, HOUR_MS, IDLE_MS, AWAY_RESET_MS, COOLDOWN_MS };
export type { EventDef, EventRarityDef };
/* The holiday API, re-exported so the engine and UI keep importing everything event-shaped from here. */
export { HOLIDAYS, burstDue, holidayDateInYear, holidayMultipliers, holidayMutationName, holidayOn, nextHoliday } from "./holidays.ts";
export type { ActiveHoliday, HolidayDef, HolidayMultipliers, HolidayPhase } from "./holidays.ts";

/** Index of the Astral Sea (the Mythic event's water). */
export const ASTRAL_BIOME = BIOMES.findIndex((b) => b.id === "astral");

/** The event running now. */
export type ActiveEvent = { id: string; startedAt: number; endsAt: number };

/** Everything saved about events (per mode save slot). */
export type EventsSave = {
  /** This save's own seed for event dice (set once; never the shared fishing stream). */
  seed: number;
  /** Counts streaks, so a new streak rolls new dice. */
  session: number;
  /** Continuous active play in this streak, ms. */
  streakMs: number;
  /** Wall-clock ms of the last step (how a reload knows how long the game was closed). */
  lastAt: number;
  /** Time spent idle or hidden since the player was last active, ms. */
  awayMs: number;
  /** How many whole hours of this streak have already had their roll. */
  rolled: number;
  /** No event can start before this wall-clock time. */
  cooldownUntil: number;
  active: ActiveEvent | null;
  /** Times each event has happened (event id -> n). An id is "seen" once n > 0. */
  seen: Record<string, number>;
  /** Mutated fish landed per event (event id -> n). */
  fish: Record<string, number>;
  /** Mutation rolls made, so every roll is a new draw. */
  draws: number;
};

export const noEvents = (): EventsSave => ({
  seed: 0,
  session: 0,
  streakMs: 0,
  lastAt: 0,
  awayMs: 0,
  rolled: 0,
  cooldownUntil: 0,
  active: null,
  seen: {},
  fish: {},
  draws: 0,
});

export const eventById = (id: string): EventDef | undefined => EVENTS.find((e) => e.id === id);
export const rarityOfEvent = (e: EventDef): EventRarityDef => EVENT_RARITIES[e.rarity];
/** The mutation index (into MUTATIONS) an event hands out. */
export const mutationOfEvent = (e: EventDef): number => FIRST_EVENT_MUTATION + EVENTS.indexOf(e);
/** The event behind a mutation index, or undefined for an ordinary mutation. */
export const eventOfMutation = (m: number): EventDef | undefined => (m >= FIRST_EVENT_MUTATION ? EVENTS[m - FIRST_EVENT_MUTATION] : undefined);

/** Events run in Expedition, Recreational and Local Co-op. Tournaments are scored by a server replay from a seed and
    Survival has its own rules, so both are off (05 §6, 11 §5). */
export const eventModeOn = (r: Pick<ModeRules, "id" | "survival">) => r.id !== "tournament" && !r.survival;

/** Words for Kid Mode: the scarier names get friendlier ones. */
export const eventTitle = (e: EventDef, kid: boolean) => (kid && e.kidName ? e.kidName : e.name);
export const mutationTitle = (e: EventDef, kid: boolean) => (kid && e.kidMutation ? e.kidMutation : e.mutation);
/** The name for any mutation index, kid-aware. */
export function mutationName(m: number, kid = false): string {
  const e = eventOfMutation(m);
  return e ? mutationTitle(e, kid) : (MUTATIONS[m]?.name ?? "");
}

/** What the player can see about the conditions: the in-game time of day and the water. */
export type Conditions = { night: boolean; biome: number };

/** Events a player could be given at a roll after `hours` full hours of play, in these conditions. */
export function eligibleEvents(hours: number, c: Conditions): EventDef[] {
  return EVENTS.filter((e) => e.hours <= hours && (!e.night || c.night) && (!e.astral || c.biome === ASTRAL_BIOME));
}

/** The dice for hour mark `hour` of streak `session`. Rarest eligible event is tried first; the first success wins.
    Pure: same seed, streak, hour and conditions always give the same answer. */
export function rollHour(seed: number, session: number, hour: number, c: Conditions): EventDef | null {
  const r = makeRng(seedFrom(seed, "event", session, hour));
  const list = eligibleEvents(hour, c).sort((a, b) => b.rarity - a.rarity || EVENTS.indexOf(a) - EVENTS.indexOf(b));
  for (const e of list) if (r() < EVENT_RARITIES[e.rarity].startChance) return e;
  return null;
}

/** What the game tells the stepper each tick. */
export type StepInput = {
  now: number;
  /** Events allowed in this mode right now (eventModeOn). */
  on: boolean;
  /** The tab is showing. */
  visible: boolean;
  /** The player tapped, cast or pressed a key within IDLE_MS. */
  active: boolean;
  night: boolean;
  biome: number;
};

export type StepResult = { state: EventsSave; started: EventDef | null; ended: EventDef | null; reset: boolean };

/** Reset the streak (the player left for too long). Seen events, counters and an event already running are kept. */
function resetStreak(st: EventsSave): EventsSave {
  return { ...st, session: st.session + 1, streakMs: 0, awayMs: 0, rolled: 0 };
}

/** Move the events clock forward to `in.now`. Never draws from the shared fishing stream. */
export function stepEvents(st: EventsSave, inp: StepInput): StepResult {
  const { now } = inp;
  let s = st;
  let ended: EventDef | null = null;
  let started: EventDef | null = null;
  let reset = false;
  if (!s.seed) s = { ...s, seed: seedFrom("fac-events", now) || 1 };
  const gap = Math.max(0, now - s.lastAt);
  /* An event ends on the wall clock, even if the game was closed. */
  if (s.active && now >= s.active.endsAt) {
    ended = eventById(s.active.id) ?? null;
    s = { ...s, active: null, cooldownUntil: Math.max(s.cooldownUntil, s.active.endsAt + COOLDOWN_MS) };
  }
  if (!inp.on) return { state: { ...s, lastAt: now }, started, ended, reset };
  if (s.lastAt === 0) {
    /* First step in this save: nothing to count yet. */
    return { state: { ...s, lastAt: now }, started, ended, reset };
  }
  if (gap > AWAY_RESET_MS) {
    s = resetStreak(s);
    reset = true;
  } else if (inp.visible && inp.active) {
    s = { ...s, streakMs: s.streakMs + gap, awayMs: 0 };
  } else {
    const away = s.awayMs + gap;
    if (away > AWAY_RESET_MS) {
      s = resetStreak(s);
      reset = true;
    } else s = { ...s, awayMs: away };
  }
  /* One roll per full hour of the streak, at most. A skipped hour (event running, cooldown) is not made up later. */
  const hours = Math.floor(s.streakMs / HOUR_MS);
  while (s.rolled < hours) {
    const hour = s.rolled + 1;
    s = { ...s, rolled: hour };
    if (s.active || now < s.cooldownUntil) continue;
    const e = rollHour(s.seed, s.session, hour, { night: inp.night, biome: inp.biome });
    if (e) {
      s = {
        ...s,
        active: { id: e.id, startedAt: now, endsAt: now + EVENT_RARITIES[e.rarity].minutes * 60_000 },
        seen: { ...s.seen, [e.id]: (s.seen[e.id] ?? 0) + 1 },
      };
      started = e;
    }
  }
  return { state: { ...s, lastAt: now }, started, ended, reset };
}

/** The running event, or null when none (or it has run out by `now`). */
export function activeEvent(st: EventsSave, now: number): { def: EventDef; leftMs: number } | null {
  if (!st.active || now >= st.active.endsAt) return null;
  const def = eventById(st.active.id);
  return def ? { def, leftMs: st.active.endsAt - now } : null;
}

/** A fish and what an event does to it. Generic so the engine's own fish type passes straight through. */
export type Mutable = { m: number; v: number; name: string; boss: boolean; b: number; i: number };

/** Does this fish catch the running event's mutation? Own stream, one fresh draw per fish. Bosses and fish that already
    carry a rolled mutation are never changed, so a boost applies once and never stacks. The caller counts the fish
    when it lands (`countLanded`), not here, because a fish can still get away. */
export function mutateFish<F extends Mutable>(st: EventsSave, fish: F, def: EventDef, speciesName: string): { fish: F; state: EventsSave; hit: boolean } {
  const state = { ...st, draws: st.draws + 1 };
  if (fish.boss || fish.m > 0) return { fish, state, hit: false };
  const r = makeRng(seedFrom(st.seed, "mutation", st.draws))();
  if (r >= EVENT_RARITIES[def.rarity].fishShare) return { fish, state, hit: false };
  const m = mutationOfEvent(def);
  const mutation = MUTATIONS[m];
  return {
    fish: { ...fish, m, v: Math.round(fish.v * mutation.mult), name: `${mutation.name} ${speciesName}` },
    state,
    hit: true,
  };
}

/** "Starlight! 2x XP" / "Trembling! 2x worth" / "Fisherman's Dream! 60x XP and 60x worth". */
export function effectLine(e: EventDef, kid = false): string {
  const mult = EVENT_RARITIES[e.rarity].mult;
  const what = e.kind === "xp" ? `${mult}x XP` : e.kind === "worth" ? `${mult}x worth` : `${mult}x XP and ${mult}x worth`;
  return `${mutationTitle(e, kid)}! ${what}`;
}

/** The catch-card line for a fish with this mutation index, or "" for an ordinary one. */
export function catchLine(m: number, kid = false): string {
  const e = eventOfMutation(m);
  return e ? effectLine(e, kid) : "";
}

/** "8:05" style countdown. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/** A gentle, non-spoiler hint: only once the player has played most of an hour, and rounded to 5 minutes.
    Says when the next chance comes round, never whether anything will happen. null = say nothing. */
export function nextChanceHint(st: EventsSave, now: number): string | null {
  if (st.active || now < st.cooldownUntil) return null;
  if (st.streakMs < 5 * 60_000) return null;
  const left = HOUR_MS - (st.streakMs % HOUR_MS);
  if (left > 15 * 60_000) return null;
  const mins = Math.max(5, Math.ceil(left / (5 * 60_000)) * 5);
  return `Keep fishing. Something rare might happen in about ${mins} minutes.`;
}

/** Plain-English requirement line for the Events list. */
export function requirementLine(e: EventDef): string {
  const h = e.hours === 1 ? "1 hour" : `${e.hours} hours`;
  const bits = [`${h} of fishing in a row`];
  if (e.night) bits.push("only at night");
  if (e.astral) bits.push("only in the Astral Sea");
  return bits.join(", ");
}

/** A mutated fish landed: add it to that event's tally. Ordinary fish leave the save as it was. */
export function countLanded(st: EventsSave, m: number): EventsSave {
  const e = eventOfMutation(m);
  return e ? { ...st, fish: { ...st.fish, [e.id]: (st.fish[e.id] ?? 0) + 1 } } : st;
}

/* ── Holidays on a catch (Update Three, P5) ──────────────────────────────────
   INTERACTION RULE (holiday x random event): the two systems multiply, they never replace each other.
   - The holiday's 50x is GLOBAL: every fish caught in the window gets its worth x50 here, including
     bosses and fish carrying a rolled or random-event mutation. XP x50 and luck x50 are the same
     multipliers, applied at their own seams (keep.ts catchXp and content.ts luckTotal take the date).
   - A random event running at the same time keeps working exactly as before: mutateFish runs first,
     so its mutation takes the fish's single `m` slot and its own multiplier applies first; the
     holiday x50 then applies on top (a Trembling fish in a holiday window is worth 2 x 50 = 100x).
   - The holiday mutation is a NAME, not a second `m`: holiday mutations are not rows in MUTATIONS
     (the New Year name changes every year), so an eligible fish gets the holiday name as a prefix
     plus a `holidayMutation` field, and NO extra multiplier — the global 50x already counted it.
     Eligibility and dice mirror mutateFish exactly: bosses never carry it, a fish that already
     carries any mutation (m > 0, rolled or random-event) keeps that one instead, and the draw
     comes from the events save's own stream (seedFrom(seed, "holiday-mutation", draws)), never
     the shared fishing stream. */

/** A fish that may also carry a holiday mutation name alongside its ordinary fields. */
export type HolidayMutable<F> = F & { holidayMutation?: string };

/** Apply one holiday to one fish: worth x50 for every fish, plus the holiday mutation name on a
    share of eligible fish (see the rule above). Pure, apart from advancing the save's draw counter. */
export function holidayMutateFish<F extends Mutable>(
  st: EventsSave,
  fish: F,
  holiday: ActiveHoliday,
  speciesName: string,
): { fish: HolidayMutable<F>; state: EventsSave; hit: boolean } {
  const state = { ...st, draws: st.draws + 1 };
  const boosted: HolidayMutable<F> = { ...fish, v: Math.round(fish.v * HOLIDAY_MULT) };
  if (fish.boss || fish.m > 0) return { fish: boosted, state, hit: false };
  const r = makeRng(seedFrom(st.seed, "holiday-mutation", st.draws))();
  if (r >= HOLIDAY_FISH_SHARE) return { fish: boosted, state, hit: false };
  return {
    fish: { ...boosted, holidayMutation: holiday.mutation, name: `${holiday.mutation} ${speciesName}` },
    state,
    hit: true,
  };
}

/** THE catch seam for events of both kinds: random event first (if one is running), holiday second
    (if `date` is inside a holiday window). The engine's eventMutate should call this for every
    rolled fish — with randomDef = null when no random event is running — instead of calling
    mutateFish only when a random event is active, so holidays work on their own. Mode gating
    stays where it already lives: the caller checks eventModeOn first (off in Tournament and
    Survival, exactly like random events, so a tournament replay never sees a holiday). */
export function applyEventsToFish<F extends Mutable>(
  st: EventsSave,
  fish: F,
  randomDef: EventDef | null,
  date: Date,
  speciesName: string,
): { fish: HolidayMutable<F>; state: EventsSave; randomHit: boolean; holidayHit: boolean; holiday: ActiveHoliday | null } {
  let state = st;
  let out: HolidayMutable<F> = fish;
  let randomHit = false;
  let holidayHit = false;
  if (randomDef) {
    const r = mutateFish(state, out, randomDef, speciesName);
    state = r.state;
    out = r.fish;
    randomHit = r.hit;
  }
  const holiday = holidayOn(date);
  if (holiday) {
    const h = holidayMutateFish(state, out, holiday, speciesName);
    state = h.state;
    out = h.fish;
    holidayHit = h.hit;
  }
  return { fish: out, state, randomHit, holidayHit, holiday };
}

/* ── Reading a save (untrusted data) ── */

const num = (v: unknown, lo: number, hi: number, d = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);

function readCounts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const e of EVENTS) {
    const n = num((v as Record<string, unknown>)[e.id], 0, 1e9);
    if (n > 0) out[e.id] = n;
  }
  return out;
}

export function readEvents(v: unknown): EventsSave {
  const base = noEvents();
  if (!v || typeof v !== "object" || Array.isArray(v)) return base;
  const o = v as Record<string, unknown>;
  let active: ActiveEvent | null = null;
  const a = o.active as Record<string, unknown> | null | undefined;
  if (a && typeof a === "object" && typeof a.id === "string" && eventById(a.id)) {
    const startedAt = num(a.startedAt, 0, 1e15);
    const endsAt = num(a.endsAt, 0, 1e15);
    if (endsAt > startedAt) active = { id: a.id, startedAt, endsAt };
  }
  return {
    seed: num(o.seed, 0, 4294967295),
    session: num(o.session, 0, 1e9),
    streakMs: num(o.streakMs, 0, 1e10),
    lastAt: num(o.lastAt, 0, 1e15),
    awayMs: num(o.awayMs, 0, 1e10),
    rolled: num(o.rolled, 0, 1e5),
    cooldownUntil: num(o.cooldownUntil, 0, 1e15),
    active,
    seen: readCounts(o.seen),
    fish: readCounts(o.fish),
    draws: num(o.draws, 0, 1e12),
  };
}
