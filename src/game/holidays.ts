/* Holiday events (Update Three, P5): the pure local-calendar rules behind the HOLIDAYS table in
   event-data.ts. No store, no browser, no randomness at all — everything here is a function of the
   Date you pass in, read in LOCAL time (the player's own calendar: getFullYear/getMonth/getDate).
   Day differences are computed on UTC day numbers built from the local y/m/d, so a daylight-saving
   jump can never stretch or shrink the three-day window.

   The window is always three local calendar days: the eve before the holiday, the day itself, and
   the day after. While a holiday is active, holidayMultipliers() is 50 / 50 / 50 (luck, worth, XP);
   outside any window it is 1 / 1 / 1. How those multipliers reach a catch is in events.ts
   (applyEventsToFish / holidayMutateFish for worth and the mutation name), keep.ts (catchXp's
   optional date for XP) and content.ts (luckTotal's optional date for luck). */

import { HOLIDAY_MULT, HOLIDAYS, NEW_YEAR_BURST_MINUTES, type HolidayDef } from "./event-data.ts";

export { HOLIDAYS, HOLIDAY_MULT, NEW_YEAR_BURST_MINUTES };
export type { HolidayDef };

/** Which third of the window a date falls in. */
export type HolidayPhase = "eve" | "day" | "after";

/** A holiday that is running on a given local date, with everything a caller needs resolved. */
export type ActiveHoliday = {
  def: HolidayDef;
  /** Local midnight at the start of the holiday itself. */
  date: Date;
  /** The year the holiday belongs to. For New Year this is the INCOMING year: the window that
      starts on Dec 31, 2026 belongs to New Year 2027, eve included. */
  year: number;
  /** The resolved mutation name for this occurrence ("jolly", "spooky", "2027", ...). */
  mutation: string;
  phase: HolidayPhase;
  /** True only for New Year: this holiday carries the midnight burst (see burstDue). */
  burst: boolean;
};

export type HolidayMultipliers = { luck: number; worth: number; xp: number };

const DAY_MS = 86_400_000;

/** A DST-proof day number for a local calendar date. */
const dayNumber = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
const dayNumberOf = (date: Date) => dayNumber(date.getFullYear(), date.getMonth() + 1, date.getDate());
const localDate = (y: number, m: number, d: number) => new Date(y, m - 1, d);

/** The n-th `weekday` (0 = Sunday ... 6 = Saturday) of `month` (1-12) in `year`, as a local Date.
    Thanksgiving is nthWeekdayOfMonth(year, 11, 4, 4): the fourth Thursday of November. */
export function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = localDate(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return localDate(year, month, 1 + offset + (n - 1) * 7);
}

/** Western Easter Sunday for `year`, by the Anonymous Gregorian Computus. Local Date at midnight. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return localDate(year, month, day);
}

/** The local calendar date a holiday falls on in `year` (the year the holiday belongs to). */
export function holidayDateInYear(def: HolidayDef, year: number): Date {
  switch (def.date.type) {
    case "fixed":
      return localDate(year, def.date.month, def.date.day);
    case "nth-weekday":
      return nthWeekdayOfMonth(year, def.date.month, def.date.weekday, def.date.n);
    case "easter":
      return easterSunday(year);
  }
}

/** The mutation name for one occurrence of a holiday. Fixed holidays ignore the year;
    New Year's mutation IS the incoming year, as a string ("2027"). */
export function holidayMutationName(def: HolidayDef, year: number): string {
  return typeof def.mutation === "function" ? def.mutation(year) : def.mutation;
}

function activeFor(def: HolidayDef, year: number, diff: number): ActiveHoliday {
  return {
    def,
    date: holidayDateInYear(def, year),
    year,
    mutation: holidayMutationName(def, year),
    phase: diff < 0 ? "eve" : diff > 0 ? "after" : "day",
    burst: def.burst === true,
  };
}

/** The holiday active on `date` (local), honouring the eve → day → day-after window, or null.
    Candidate occurrences are checked for the date's own year and its neighbours, which is what
    lets Dec 31 find next year's New Year (and carry the incoming year's mutation name). No two
    holiday windows overlap, so the first match in HOLIDAYS order is the only match. */
export function holidayOn(date: Date): ActiveHoliday | null {
  const target = dayNumberOf(date);
  const y = date.getFullYear();
  for (const def of HOLIDAYS) {
    for (const year of [y - 1, y, y + 1]) {
      const hd = holidayDateInYear(def, year);
      const diff = target - dayNumber(hd.getFullYear(), hd.getMonth() + 1, hd.getDate());
      if (diff >= -1 && diff <= 1) return activeFor(def, year, diff);
    }
  }
  return null;
}

/** 50 / 50 / 50 inside a holiday window, 1 / 1 / 1 outside. Pure in the date passed in. */
export function holidayMultipliers(date: Date): HolidayMultipliers {
  return holidayOn(date)
    ? { luck: HOLIDAY_MULT, worth: HOLIDAY_MULT, xp: HOLIDAY_MULT }
    : { luck: 1, worth: 1, xp: 1 };
}

/** The next holiday whose window has not fully passed at `from` — the one holidayOn(from) would
    return if a window is live, otherwise the soonest upcoming one. For UI countdowns/lists: for an
    upcoming holiday, count down to `date`; `phase` is only meaningful while the window is live. */
export function nextHoliday(from: Date): ActiveHoliday {
  const target = dayNumberOf(from);
  const y = from.getFullYear();
  let best: ActiveHoliday | null = null;
  let bestDay = Infinity;
  for (const def of HOLIDAYS) {
    for (const year of [y, y + 1]) {
      const hd = holidayDateInYear(def, year);
      const dn = dayNumber(hd.getFullYear(), hd.getMonth() + 1, hd.getDate());
      if (dn < target - 1 || dn >= bestDay) continue;
      bestDay = dn;
      best = activeFor(def, year, target - dn);
    }
  }
  /* best is always set: next year's occurrences are all ahead of `from`. */
  return best!;
}

/** The New Year midnight burst: true only in the first NEW_YEAR_BURST_MINUTES minutes of Jan 1
    (local), while the New Year holiday is active. The coordinator hooks this in the engine's
    per-second step: when it flips true, fire one burst (bonus catches / XP / celebration) and
    remember that this year's burst has fired, so it fires once, not every tick. */
export function burstDue(date: Date): boolean {
  if (date.getMonth() !== 0 || date.getDate() !== 1) return false;
  if (date.getHours() * 60 + date.getMinutes() >= NEW_YEAR_BURST_MINUTES) return false;
  const active = holidayOn(date);
  return active?.def.id === "new-year" && active.burst;
}
