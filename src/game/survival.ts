/* Survival Fishing rules (docs/architecture/05 §5).
   You are dropped on a water with a hand line and nothing else. Fish to eat, eat to keep
   fishing, stay warm, and see how many days you can last.

   Everything here is PURE: no React, no store, no browser, no Math.random. A run carries its
   own seed and every roll (the weather, the driftwood, a bad fish) is derived from it, so the
   same daily seed gives everyone the same sky. The store (engine.ts) wires these functions to
   the fishing loop; this file only decides what the rules ARE.

   Time is counted in game minutes since 06:00 on day 1. A day is 24 game hours: 18 awake
   (06:00 to 24:00) and 6 in camp (00:00 to 06:00). The day number rolls over at 06:00. */

import { BIOMES, SPECIES_PER_BIOME, WEATHER } from "./content.ts";
import { windowOf } from "./match.ts";
import { readRecords, type Records } from "./records.ts";
import { readRig, type Rig, type Window } from "./presentation.ts";
import { makeRng, seedFrom, weighted } from "./rng.ts";
import { spotById } from "./spots.ts";
import type { Dex } from "./modes.ts";

/* ── Constants ───────────────────────────────────────────────────────────── */

export const SURVIVAL_VERSION = 1;

/** The eight waters Survival is played on (05 §5.2): Pond, River, Lake, Swamp, Coast, Arctic, Mangrove, Kelp. */
export const SURVIVAL_WATERS: readonly number[] = [0, 1, 2, 3, 5, 9, 4, 8];
export const ARCTIC = 9;

/** One-line plain-English feel for each water, shown when picking where to start. */
export const WATER_BLURB: Record<number, string> = {
  0: "Calm and friendly. The best place to learn.",
  1: "Moving water with lots of bites.",
  2: "Wide and deep. Big fish hide here.",
  3: "Murky and mild. Rain comes often.",
  4: "Roots and shade. Plenty to catch.",
  5: "Salt spray and a stiff breeze.",
  8: "A kelp forest. Fish everywhere, cold wind.",
  9: "Freezing! You lose warmth much faster.",
};

/** You are rescued on the morning of this day number. Reaching it wins the run (you may keep going). */
export const WIN_DAY = 15;

export const DAY_MIN = 1440;
/** Minutes after 06:00 when the awake day ends (24:00). */
export const AWAKE_MIN = 1080;
/** From this hour you may go to sleep (17:00). */
export const SLEEP_HOUR = 17;
export const WAKE_HOUR = 6;

export const START_HUNGER = 85;
/** How much of the hunger meter one calorie fills. */
export const HUNGER_PER_CAL = 0.2;
export const BAD_FISH_CHANCE = 0.15;
export const BAD_FISH_HUNGER = 10;
/** Minutes of slower fishing after a bad fish (2 h). */
export const SICK_MIN = 120;
export const SICK_BITE_MUL = 1.4;
/** One driftwood log feeds the fire for an hour. */
export const LOG_MIN = 60;
export const FIRE_MAX_MIN = 12 * 60;
export const FIRE_WARMTH_PER_H = 3;
export const LARDER_MAX = 16;
export const LOG_MAX = 40;

/** Hunger lost per hour: awake, and in camp (00:00 to 06:00). */
export const HUNGER_AWAKE = 4;
export const HUNGER_CAMP = 1.5;
/** Warmth lost per hour by weather id (Sunny, Rain, Storm, Fog); Night adds more. */
export const WEATHER_LOSS: readonly number[] = [0, 2, 4, 1];
export const NIGHT_LOSS = 2;
export const ARCTIC_MUL = 2.5;
/** What a shelter keeps out: nothing, 40 %, 75 % of the loss. */
export const SHELTER_MUL: readonly number[] = [1, 0.6, 0.25];

/** Odds of each sky when the weather changes: Sunny, Rain, Storm, Fog. */
const WEATHER_ODDS: readonly number[] = [45, 25, 12, 18];
export const WEATHER_STAY = 0.7;
export const FORECAST_RIGHT = 0.7;

export const HOOK_NAMES = ["Hand line", "Bone hook", "Carved hook"] as const;
export const LINE_NAMES = ["Plain line", "Braided gut", "Sinew line"] as const;
export const SHELTER_NAMES = ["No shelter", "Lean-to", "Hut"] as const;

/* ── Types ───────────────────────────────────────────────────────────────── */

export type Tier = 0 | 1 | 2;

export type Camp = {
  shelter: Tier;
  /** Minutes of fire left. 0 = out. */
  fire: number;
  smoker: boolean;
  driftwood: number;
  bone: number;
  gut: number;
};

export type Gear = { hook: Tier; line: Tier };

export type LarderItem = {
  name: string;
  /** Calories if you eat it as it is (raw 60 per lb; smoked 90 per lb). */
  cal: number;
  smoked: boolean;
  /** Rots once the day number is past this. */
  expiresDay: number;
  /** Weight in lb and rarity, for the list and for cooking. */
  w: number;
  t: number;
};

export type RunEnd = {
  kind: "lost" | "won";
  /** One plain sentence: "The cold got you on day 6 — a storm, no fire." */
  cause: string;
  day: number;
};

export type SurvivalRun = {
  water: number;
  /** Every roll of the run derives from this. */
  seed: number;
  /** A daily challenge (the seed comes from the date and water) or a free run. */
  daily: boolean;
  /** YYYY-MM-DD the run was started on (the daily seed's date). */
  date: string;
  /** Game minutes since 06:00 on day 1. */
  min: number;
  hunger: number;
  warmth: number;
  /** Weather id 0..3 (Sunny, Rain, Storm, Fog). */
  weather: number;
  camp: Camp;
  gear: Gear;
  larder: LarderItem[];
  /** Newest last; the last 40 events. */
  log: string[];
  /** Casts made so far: each cast's dice come from (seed, casts). */
  casts: number;
  /** Minutes left of fishing slower after a bad fish. */
  sick: number;
  fish: number;
  eaten: number;
  bad: number;
  biggest: { name: string; w: number; t: number } | null;
  /** You reached the rescue day and chose to keep going. */
  rescued: boolean;
  over: RunEnd | null;
  /** The finished run has been written to the run history. */
  recorded: boolean;
};

export type RunSummary = {
  water: number;
  daily: boolean;
  date: string;
  days: number;
  fish: number;
  eaten: number;
  biggest: number;
  won: boolean;
  cause: string;
};

export type SurvivalMeta = {
  /** Finished runs, newest first (last 20). */
  history: RunSummary[];
  /** The water picked last time. */
  lastWater: number;
};

/** What `fac-ultra-survival` holds: its own run, its own dex, its own history. */
export type SurvivalSave = SurvivalMeta & {
  version: number;
  run: SurvivalRun | null;
  dex: Dex;
  records: Records;
  lastSpot: Record<number, string>;
  rig: Record<number, Rig>;
  coached: Record<string, number>;
  drag: 0 | 1 | 2;
};

/** The result of anything the player does at camp. `say` is one plain line for the message pill. */
export type Step = { run: SurvivalRun; ok: boolean; say: string };

/* ── Little helpers ──────────────────────────────────────────────────────── */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Today's date in the player's own time, YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The seed of a daily challenge: everyone who plays today's Pond gets the same sky and the same fish. */
export function dailySeed(date: string, water: number): number {
  return seedFrom("survival", date, water);
}

export function isSurvivalWater(b: unknown): b is number {
  return typeof b === "number" && SURVIVAL_WATERS.includes(b);
}

/* ── The clock ───────────────────────────────────────────────────────────── */

export type Clock = { day: number; hour: number; minute: number };

/** Day number (rolls at 06:00), and the hour of day 0..24 (after midnight it reads 0..6). */
export function clockOf(min: number): Clock {
  const m = Math.max(0, Math.floor(min));
  const day = Math.floor(m / DAY_MIN) + 1;
  const into = m % DAY_MIN;
  const total = (WAKE_HOUR * 60 + into) % DAY_MIN;
  return { day, hour: Math.floor(total / 60), minute: total % 60 };
}

/** Hour of day as a fraction, 0..24. */
export function hourOf(min: number): number {
  const c = clockOf(min);
  return c.hour + c.minute / 60;
}

/** 20:00 to 06:00. */
export function isNight(hour: number): boolean {
  return hour >= 20 || hour < WAKE_HOUR;
}

/** The "time of day" window the fish feed in right now. */
export function windowAt(min: number): Window {
  return windowOf(hourOf(min));
}

/** Past 24:00: no more fishing today, it is time to sleep. */
export function isForcedCamp(run: Pick<SurvivalRun, "min">): boolean {
  return run.min % DAY_MIN >= AWAKE_MIN;
}

/** Minutes of fishing light left today (0 once it is time to camp). */
export function awakeLeft(run: Pick<SurvivalRun, "min">): number {
  return Math.max(0, AWAKE_MIN - (run.min % DAY_MIN));
}

/** "6:30 am". */
export function clockText(min: number): string {
  const { hour, minute } = clockOf(min);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/** "Morning", "Afternoon" … for a screen reader and for kids who do not read clocks yet. */
export function partOfDay(min: number): string {
  const h = hourOf(min);
  if (h < WAKE_HOUR) return "Night";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 20) return "Evening";
  return "Night";
}

export const dayOf = (run: Pick<SurvivalRun, "min">): number => clockOf(run.min).day;

/** Whole days lived through: dying on day 6 means 5 days survived. */
export function daysSurvived(run: Pick<SurvivalRun, "min">): number {
  return Math.max(0, dayOf(run) - 1);
}

/* ── Weather: a seeded chain, one roll per game hour, 70 % chance it stays ─ */

function rollWeather(seed: number, tag: string, n: number): number {
  return weighted(WEATHER_ODDS, makeRng(seedFrom(tag, seed, n)));
}

/** The first sky of a run. */
export function firstWeather(seed: number): number {
  return rollWeather(seed, "wx0", 0);
}

/** The sky for game hour `absHour` given the sky the hour before. */
export function nextWeather(seed: number, absHour: number, prev: number): number {
  const r = makeRng(seedFrom("wx", seed, absHour));
  if (r() < WEATHER_STAY) return prev;
  return weighted(WEATHER_ODDS, r);
}

const SKY_WORDS = ["a sunny day", "rain", "a storm", "fog"];

/** What the sky will be tomorrow morning (08:00), and what the evening forecast SAYS (right 70 % of the time). */
export function forecastFor(
  run: SurvivalRun,
): { truth: number; said: number; text: string } | null {
  const h = hourOf(run.min);
  /* Announced in the evening, from 17:00 until you sleep. */
  if (!(h >= SLEEP_HOUR || h < WAKE_HOUR)) return null;
  const day = dayOf(run);
  /* Tomorrow 08:00 (after midnight that is this very morning): two hours into the next day counter. */
  const target = Math.floor((day * DAY_MIN + 120) / 60);
  let w = run.weather;
  for (let a = Math.floor(run.min / 60) + 1; a <= target; a++) w = nextWeather(run.seed, a, w);
  const r = makeRng(seedFrom("fc", run.seed, day));
  const right = r() < FORECAST_RIGHT;
  const others = [0, 1, 2, 3].filter((x) => x !== w);
  const said = right ? w : others[Math.min(others.length - 1, Math.floor(r() * others.length))];
  const text =
    said === 0
      ? "The sky says it will be sunny tomorrow."
      : `The sky says ${SKY_WORDS[said]} tomorrow.`;
  return { truth: w, said, text };
}

/* ── Gear ────────────────────────────────────────────────────────────────── */

/** Green-zone width for the fight: a hand line is tight (14), a bone hook is the plain rod (18), a carved hook is wide (22). */
export const HOOK_ZONE: readonly number[] = [14, 18, 22];
/** Line strength multiplier: hand line ×1, braided gut ×1.6, sinew ×2.4. */
export const LINE_HOLD: readonly number[] = [1, 1.6, 2.4];
/** How much one zone point widens the green band in the fight (fight.ts bandPad). */
export const ZONE_PAD = 0.003;

export const zoneOfGear = (g: Gear) => HOOK_ZONE[g.hook];
export const holdMulOfGear = (g: Gear) => LINE_HOLD[g.line];
/** Extra band width handed to the fight (negative for the hand line). */
export const bandPadOfGear = (g: Gear) => (HOOK_ZONE[g.hook] - 18) * ZONE_PAD;

/** A fish of this rarity (0 common … 4 legendary) can only be landed with a carved hook. */
export const EPIC = 3;

/** null if this gear can land the fish; otherwise why it can't. */
export function gearGate(g: Gear, rarity: number): string | null {
  if (rarity >= EPIC && g.hook < 2) {
    return g.hook === 0
      ? "That one was too big. It snapped your hand line."
      : "That one was too big for a bone hook. It snapped the line.";
  }
  return null;
}

/** What to do about it (the line under the message). */
export const GATE_TIP = "Make a carved hook at camp to land big fish.";

/* ── Time a cast and a fight cost (05 §5.2) ──────────────────────────────── */

/** A cast costs 12 + 4 per second of waiting, in game minutes. */
export const castMinutes = (waitSeconds: number) => Math.round(12 + Math.max(0, waitSeconds) * 4);
/** A fight costs its real seconds ×3 as game minutes. */
export const fightMinutes = (realSeconds: number) => Math.round(Math.max(0, realSeconds) * 3);
/** Bad fish make the wait for a bite longer for a while. */
export const biteMul = (run: Pick<SurvivalRun, "sick">) => (run.sick > 0 ? SICK_BITE_MUL : 1);

/* ── Starting and ending a run ───────────────────────────────────────────── */

function trim(log: string[]): string[] {
  return log.length > LOG_MAX ? log.slice(log.length - LOG_MAX) : log;
}

function say(run: SurvivalRun, text: string): SurvivalRun {
  return { ...run, log: trim([...run.log, text]) };
}

export function newRun(water: number, seed: number, daily: boolean, date: string): SurvivalRun {
  const w = isSurvivalWater(water) ? water : 0;
  const base: SurvivalRun = {
    water: w,
    seed: seed >>> 0,
    daily,
    date,
    min: 0,
    hunger: START_HUNGER,
    warmth: 100,
    weather: firstWeather(seed),
    camp: { shelter: 0, fire: 0, smoker: false, driftwood: 0, bone: 0, gut: 0 },
    gear: { hook: 0, line: 0 },
    larder: [],
    log: [],
    casts: 0,
    sick: 0,
    fish: 0,
    eaten: 0,
    bad: 0,
    biggest: null,
    rescued: false,
    over: null,
    recorded: false,
  };
  const wood = dawnWood(base);
  return say(
    { ...base, camp: { ...base.camp, driftwood: wood } },
    `Day 1. You wash up on the shore of the ${BIOMES[w].name} with a hand line. You find ${wood} pieces of driftwood.`,
  );
}

/** Driftwood the tide leaves at dawn: 2 to 5 pieces, double after a storm. */
export function dawnWood(run: Pick<SurvivalRun, "seed" | "min" | "weather">): number {
  const day = dayOf(run);
  const base = 2 + Math.floor(makeRng(seedFrom("dawn", run.seed, day))() * 4);
  return run.weather === 2 ? base * 2 : base;
}

/** How a lost run is put in one plain sentence (05 §5.3). */
export function causeOf(run: SurvivalRun, why: "cold" | "hunger"): string {
  const day = dayOf(run);
  if (why === "hunger") {
    return run.eaten === 0
      ? `You ran out of food on day ${day}. You never ate a fish.`
      : `You ran out of food on day ${day}. The fish stopped coming.`;
  }
  const sky =
    run.water === ARCTIC && run.weather === 0
      ? "the Arctic freeze"
      : (["a cold night", "rain", "a storm", "fog"][run.weather] ?? "the cold");
  const bits = [run.camp.fire > 0 ? "the fire was too small" : "no fire"];
  if (run.camp.shelter === 0) bits.push("no shelter");
  return `The cold got you on day ${day} — ${sky}, ${bits.join(", ")}.`;
}

function ended(run: SurvivalRun, why: "cold" | "hunger"): SurvivalRun {
  const cause = causeOf(run, why);
  return say(
    {
      ...run,
      hunger: why === "hunger" ? 0 : run.hunger,
      warmth: why === "cold" ? 0 : run.warmth,
      over: { kind: "lost", cause, day: dayOf(run) },
    },
    cause,
  );
}

/** A finished run in the shape the history keeps. */
export function summarize(run: SurvivalRun): RunSummary {
  return {
    water: run.water,
    daily: run.daily,
    date: run.date,
    days: daysSurvived(run),
    fish: run.fish,
    eaten: run.eaten,
    biggest: run.biggest ? run.biggest.w : 0,
    won: run.over?.kind === "won" || run.rescued,
    cause: run.over?.cause ?? "",
  };
}

/** Better run first: more days, then more fish, then the bigger fish (05 §5.1). */
export function compareRuns(a: RunSummary, b: RunSummary): number {
  return b.days - a.days || b.fish - a.fish || b.biggest - a.biggest;
}

export const HISTORY_MAX = 20;

export function addHistory(history: RunSummary[], s: RunSummary): RunSummary[] {
  return [s, ...history].slice(0, HISTORY_MAX);
}

export function bestRun(history: readonly RunSummary[]): RunSummary | null {
  return history.length ? [...history].sort(compareRuns)[0] : null;
}

/** After the rescue boat arrives you may keep going until the water takes you. */
export function keepGoing(run: SurvivalRun): SurvivalRun {
  if (run.over?.kind !== "won") return run;
  return say(
    { ...run, over: null, rescued: true, recorded: false },
    "You wave the boat on. You are staying a little longer.",
  );
}

/* ── Time passes ─────────────────────────────────────────────────────────── */

/** A new day begins at 06:00: rotten fish are thrown out, the tide leaves driftwood, and on the rescue day a boat comes. */
function newDay(run: SurvivalRun): SurvivalRun {
  const day = dayOf(run);
  const kept = run.larder.filter((f) => day <= f.expiresDay);
  let out = run;
  for (const f of run.larder)
    if (!kept.includes(f)) out = say(out, `The ${f.name} went bad. You throw it out.`);
  const wood = dawnWood(run);
  out = {
    ...out,
    larder: kept,
    camp: { ...out.camp, driftwood: Math.min(99, out.camp.driftwood + wood) },
  };
  out = say(
    out,
    `Day ${day}. ${WEATHER[run.weather].name === "Sunny" ? "The sun is up." : `It is ${SKY_WORDS[run.weather]}.`} The tide left ${wood} pieces of driftwood.`,
  );
  if (day >= WIN_DAY && !out.rescued) {
    const cause = `A boat spotted your fire and found you on day ${day}. You made it!`;
    out = say({ ...out, over: { kind: "won", cause, day } }, cause);
  }
  return out;
}

/** The warmth change for `chunk` minutes (never crossing an hour). Pure and exported so it can be tested. */
export function warmthRate(run: Pick<SurvivalRun, "water" | "weather" | "camp" | "min">): number {
  const night = isNight(hourOf(run.min)) ? NIGHT_LOSS : 0;
  const cold = (WEATHER_LOSS[run.weather] ?? 0) + night;
  const mul = (run.water === ARCTIC ? ARCTIC_MUL : 1) * SHELTER_MUL[run.camp.shelter];
  return cold * mul === 0 ? 0 : -cold * mul;
}

export function hungerRate(run: Pick<SurvivalRun, "min">): number {
  return hourOf(run.min) < WAKE_HOUR ? -HUNGER_CAMP : -HUNGER_AWAKE;
}

/** Let `minutes` of game time go by: hunger and warmth fall, the fire burns, the sky changes, days turn.
    Stops the moment the run ends. */
export function advance(run: SurvivalRun, minutes: number): SurvivalRun {
  let r = run;
  let left = Math.max(0, Math.round(minutes));
  while (left > 0 && !r.over) {
    const chunk = Math.min(left, 60 - (r.min % 60));
    const per = chunk / 60;
    const burn = Math.min(chunk, r.camp.fire);
    const warmth = clamp(r.warmth + warmthRate(r) * per + (FIRE_WARMTH_PER_H * burn) / 60, 0, 100);
    const hunger = clamp(r.hunger + hungerRate(r) * per, 0, 100);
    const wasLit = r.camp.fire > 0;
    r = {
      ...r,
      min: r.min + chunk,
      warmth,
      hunger,
      sick: Math.max(0, r.sick - chunk),
      camp: { ...r.camp, fire: r.camp.fire - burn },
    };
    left -= chunk;
    if (wasLit && r.camp.fire === 0) r = say(r, "The fire has burned down.");
    if (warmth <= 0.0001) {
      r = ended(r, "cold");
      break;
    }
    if (hunger <= 0.0001) {
      r = ended(r, "hunger");
      break;
    }
    if (r.min % 60 === 0) {
      /* The hour turned: the sky may change, evening brings the forecast, midnight tells you to camp. */
      r = { ...r, weather: nextWeather(r.seed, r.min / 60, r.weather) };
      const h = hourOf(r.min);
      if (h === 18) {
        const f = forecastFor(r);
        if (f) r = say(r, f.text);
      }
      if (r.min % DAY_MIN === AWAKE_MIN)
        r = say(r, "It is too dark to fish. Time to make camp and sleep.");
      if (r.min % DAY_MIN === 0) r = newDay(r);
    }
  }
  return r;
}

/* ── What the player can do at camp ──────────────────────────────────────── */

const no = (run: SurvivalRun, text: string): Step => ({ run, ok: false, say: text });

/** Hunger the calories fill. */
export const hungerFrom = (cal: number) => Math.round(cal * HUNGER_PER_CAL);
export const rawCal = (w: number) => Math.round(60 * w);
export const cookedCal = (w: number) => Math.round(90 * w);

/** The fish just caught goes in the larder, and its bones and guts in the camp pile. */
export function landFish(run: SurvivalRun, f: { name: string; w: number; t: number }): SurvivalRun {
  const day = dayOf(run);
  const item: LarderItem = {
    name: f.name,
    cal: rawCal(f.w),
    smoked: false,
    expiresDay: day + 1,
    w: f.w,
    t: f.t,
  };
  let larder = [...run.larder, item];
  let out = run;
  if (larder.length > LARDER_MAX) {
    const gone = larder[0];
    larder = larder.slice(1);
    out = say(out, `The larder is full. You let the ${gone.name} go.`);
  }
  const bone = 1 + clamp(Math.round(f.t), 0, 4);
  const biggest =
    !run.biggest || f.w > run.biggest.w ? { name: f.name, w: f.w, t: f.t } : run.biggest;
  return say(
    {
      ...out,
      larder,
      fish: run.fish + 1,
      biggest,
      camp: {
        ...out.camp,
        bone: Math.min(99, out.camp.bone + bone),
        gut: Math.min(99, out.camp.gut + 1),
      },
    },
    `Landed a ${f.name} (${r1(f.w)} lb). +${bone} bone, +1 gut.`,
  );
}

export type Meal = "raw" | "cook";

/** What eating this fish this way would do right now (for the button text). */
export function mealInfo(
  run: SurvivalRun,
  i: number,
  how: Meal,
): { ok: boolean; why: string; gain: number; risk: boolean; min: number } {
  const f = run.larder[i];
  if (!f) return { ok: false, why: "That fish is gone.", gain: 0, risk: false, min: 0 };
  if (f.smoked) return { ok: true, why: "", gain: hungerFrom(f.cal), risk: false, min: 10 };
  if (how === "cook") {
    if (run.camp.fire <= 0)
      return {
        ok: false,
        why: "Light the fire first.",
        gain: hungerFrom(cookedCal(f.w)),
        risk: false,
        min: 20,
      };
    return { ok: true, why: "", gain: hungerFrom(cookedCal(f.w)), risk: false, min: 20 };
  }
  return { ok: true, why: "", gain: hungerFrom(f.cal), risk: true, min: 10 };
}

/** Eat a fish from the larder, raw (risky) or cooked on the fire (safe, and more food). */
export function eat(run: SurvivalRun, i: number, how: Meal): Step {
  if (run.over) return no(run, "The run is over.");
  const f = run.larder[i];
  if (!f) return no(run, "That fish is gone.");
  if (run.hunger >= 95) return no(run, "You are too full to eat.");
  const info = mealInfo(run, i, how);
  if (!info.ok) return no(run, info.why);
  const larder = run.larder.filter((_, j) => j !== i);
  const base = { ...run, larder, eaten: run.eaten + 1 };
  const bad =
    info.risk && makeRng(seedFrom("bad", run.seed, run.eaten, run.casts))() < BAD_FISH_CHANCE;
  if (bad) {
    const sick = {
      ...base,
      hunger: Math.max(1, run.hunger - BAD_FISH_HUNGER),
      sick: SICK_MIN,
      bad: run.bad + 1,
    };
    const text = `The raw ${f.name} was bad! Your tummy hurts and fishing is slower for a while.`;
    return { run: advance(say(sick, text), info.min), ok: true, say: text };
  }
  const text = f.smoked
    ? `You eat the smoked ${f.name}. Mmm.`
    : how === "cook"
      ? `You cook the ${f.name} on the fire and eat it. Warm and filling.`
      : `You eat the raw ${f.name}. It is not great, but it works.`;
  const fed = { ...base, hunger: clamp(run.hunger + info.gain, 0, 100) };
  return { run: advance(say(fed, text), info.min), ok: true, say: text };
}

/** Smoke a fish so it keeps for 4 days. Needs the smoker and a lit fire. */
export function smoke(run: SurvivalRun, i: number): Step {
  if (run.over) return no(run, "The run is over.");
  const f = run.larder[i];
  if (!f) return no(run, "That fish is gone.");
  if (f.smoked) return no(run, "That one is already smoked.");
  if (!run.camp.smoker) return no(run, "Build a smoker first.");
  if (run.camp.fire <= 0) return no(run, "Light the fire first.");
  const day = dayOf(run);
  const larder = run.larder.map((x, j) =>
    j === i ? { ...x, smoked: true, cal: cookedCal(x.w), expiresDay: day + 4 } : x,
  );
  const text = `You smoke the ${f.name}. It will keep for 4 days.`;
  return { run: advance(say({ ...run, larder }, text), 30), ok: true, say: text };
}

/** Put a log on the fire (or start it). An hour of warmth per log. */
export function addLog(run: SurvivalRun): Step {
  if (run.over) return no(run, "The run is over.");
  if (run.camp.driftwood < 1) return no(run, "No driftwood left. Look for some.");
  if (run.camp.fire >= FIRE_MAX_MIN) return no(run, "The fire is already roaring.");
  const was = run.camp.fire > 0;
  const camp = {
    ...run.camp,
    driftwood: run.camp.driftwood - 1,
    fire: Math.min(FIRE_MAX_MIN, run.camp.fire + LOG_MIN),
  };
  const text = was ? "You add a log to the fire." : "You light the fire. It crackles.";
  return { run: advance(say({ ...run, camp }, text), 5), ok: true, say: text };
}

/** Walk the shore for driftwood: half an hour for 1 to 3 pieces (double after a storm). */
export function gatherWood(run: SurvivalRun): Step {
  if (run.over) return no(run, "The run is over.");
  if (isForcedCamp(run)) return no(run, "It is too dark to look for wood.");
  const n = 1 + Math.floor(makeRng(seedFrom("gather", run.seed, run.min))() * 3);
  const got = run.weather === 2 ? n * 2 : n;
  const camp = { ...run.camp, driftwood: Math.min(99, run.camp.driftwood + got) };
  const text = `You find ${got} piece${got === 1 ? "" : "s"} of driftwood.`;
  return { run: advance(say({ ...run, camp }, text), 30), ok: true, say: text };
}

/** Sleep until morning. Allowed from 5 pm. */
export function sleep(run: SurvivalRun): Step {
  if (run.over) return no(run, "The run is over.");
  if (hourOf(run.min) < SLEEP_HOUR && hourOf(run.min) >= WAKE_HOUR)
    return no(run, "You are not tired yet. Fish a little longer.");
  const left = DAY_MIN - (run.min % DAY_MIN);
  const out = advance(say(run, "You curl up and sleep."), left);
  return { run: out, ok: true, say: out.over ? out.over.cause : "You wake up." };
}

export type RecipeId =
  | "bone-hook"
  | "carved-hook"
  | "braided-line"
  | "sinew-line"
  | "shelter-1"
  | "shelter-2"
  | "smoker";

export type Recipe = {
  id: RecipeId;
  name: string;
  blurb: string;
  cost: Partial<Record<"bone" | "gut" | "driftwood", number>>;
  /** Game minutes the work takes. */
  min: number;
};

export const RECIPES: readonly Recipe[] = [
  {
    id: "bone-hook",
    name: "Bone hook",
    blurb: "A sharper hook. The green zone gets wider.",
    cost: { bone: 3 },
    min: 30,
  },
  {
    id: "carved-hook",
    name: "Carved hook",
    blurb: "Wider again, and you can land big fish.",
    cost: { bone: 6, driftwood: 2 },
    min: 45,
  },
  {
    id: "braided-line",
    name: "Braided gut line",
    blurb: "Stronger line. It takes more pull.",
    cost: { gut: 4 },
    min: 30,
  },
  {
    id: "sinew-line",
    name: "Sinew line",
    blurb: "The strongest line. Needs the smoker.",
    cost: { gut: 8 },
    min: 45,
  },
  {
    id: "shelter-1",
    name: "Lean-to",
    blurb: "Blocks some of the cold.",
    cost: { driftwood: 8 },
    min: 60,
  },
  {
    id: "shelter-2",
    name: "Hut",
    blurb: "Blocks most of the cold.",
    cost: { driftwood: 14, gut: 4 },
    min: 90,
  },
  {
    id: "smoker",
    name: "Smoker",
    blurb: "Smoked fish keeps for 4 days.",
    cost: { driftwood: 6 },
    min: 45,
  },
];

export function recipeOf(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** null when it can be made right now, otherwise why not (in plain words). */
export function craftBlock(run: SurvivalRun, id: RecipeId): string | null {
  const rc = recipeOf(id);
  if (!rc) return "Nothing to make.";
  if (run.over) return "The run is over.";
  switch (id) {
    case "bone-hook":
      if (run.gear.hook >= 1) return "You already have a better hook.";
      break;
    case "carved-hook":
      if (run.gear.hook >= 2) return "You already have the best hook.";
      if (run.gear.hook < 1) return "Make a bone hook first.";
      break;
    case "braided-line":
      if (run.gear.line >= 1) return "You already have a better line.";
      break;
    case "sinew-line":
      if (run.gear.line >= 2) return "You already have the best line.";
      if (run.gear.line < 1) return "Make a braided line first.";
      if (!run.camp.smoker) return "Build the smoker first.";
      break;
    case "shelter-1":
      if (run.camp.shelter >= 1) return "You already have a shelter.";
      break;
    case "shelter-2":
      if (run.camp.shelter >= 2) return "You already have a hut.";
      if (run.camp.shelter < 1) return "Build a lean-to first.";
      break;
    case "smoker":
      if (run.camp.smoker) return "You already have a smoker.";
      break;
  }
  for (const [k, need] of Object.entries(rc.cost) as ["bone" | "gut" | "driftwood", number][]) {
    if (run.camp[k] < need)
      return `Needs ${need} ${k === "driftwood" ? "driftwood" : k} (you have ${run.camp[k]}).`;
  }
  return null;
}

export function craft(run: SurvivalRun, id: RecipeId): Step {
  const why = craftBlock(run, id);
  if (why) return no(run, why);
  const rc = recipeOf(id)!;
  const camp = { ...run.camp };
  for (const [k, need] of Object.entries(rc.cost) as ["bone" | "gut" | "driftwood", number][])
    camp[k] -= need;
  const gear = { ...run.gear };
  switch (id) {
    case "bone-hook":
      gear.hook = 1;
      break;
    case "carved-hook":
      gear.hook = 2;
      break;
    case "braided-line":
      gear.line = 1;
      break;
    case "sinew-line":
      gear.line = 2;
      break;
    case "shelter-1":
      camp.shelter = 1;
      break;
    case "shelter-2":
      camp.shelter = 2;
      break;
    case "smoker":
      camp.smoker = true;
      break;
  }
  const text = `You make the ${rc.name.toLowerCase()}.`;
  return { run: advance(say({ ...run, camp, gear }, text), rc.min), ok: true, say: text };
}

/* ── Words for the meters (kid-friendly; never a bare number) ────────────── */

export function vitalWord(kind: "hunger" | "warmth", v: number): string {
  const lo =
    kind === "hunger"
      ? ["Starving", "Hungry", "Peckish", "Full"]
      : ["Freezing", "Cold", "Chilly", "Warm"];
  return v < 15 ? lo[0] : v < 40 ? lo[1] : v < 70 ? lo[2] : lo[3];
}

/* ── Saving: its own slot, its own dex ───────────────────────────────────── */

export function freshMeta(): SurvivalMeta {
  return { history: [], lastWater: 0 };
}

export function freshSurvivalSave(): SurvivalSave {
  return {
    version: SURVIVAL_VERSION,
    run: null,
    ...freshMeta(),
    dex: {},
    records: {},
    lastSpot: {},
    rig: {},
    coached: {},
    drag: 1,
  };
}

function num(v: unknown, d: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : d;
  return Math.min(max, Math.max(min, n));
}
function int(v: unknown, d: number, min: number, max: number): number {
  return Math.round(num(v, d, min, max));
}
function text(v: unknown, d: string, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : d;
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function tier(v: unknown): Tier {
  return int(v, 0, 0, 2) as Tier;
}

function readLarder(v: unknown): LarderItem[] {
  if (!Array.isArray(v)) return [];
  const out: LarderItem[] = [];
  for (const x of v.slice(0, LARDER_MAX)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const w = num(o.w, 1, 0, 1e4);
    out.push({
      name: text(o.name, "Fish", 60),
      cal: int(o.cal, rawCal(w), 0, 1e6),
      smoked: o.smoked === true,
      expiresDay: int(o.expiresDay, 1, 0, 1e5),
      w,
      t: int(o.t, 0, 0, 4),
    });
  }
  return out;
}

function readEnd(v: unknown): RunEnd | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.kind !== "lost" && o.kind !== "won") return null;
  return { kind: o.kind, cause: text(o.cause, "", 200), day: int(o.day, 1, 1, 1e5) };
}

/** A run from untrusted data (the save is user-editable JSON). null when it is not a run on a Survival water. */
export function readRun(v: unknown): SurvivalRun | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!isSurvivalWater(o.water)) return null;
  const camp = obj(o.camp);
  const gear = obj(o.gear);
  const bg =
    o.biggest && typeof o.biggest === "object" ? (o.biggest as Record<string, unknown>) : null;
  const seed = int(o.seed, 1, 0, 4294967295);
  const log = Array.isArray(o.log)
    ? o.log.filter((l): l is string => typeof l === "string").map((l) => l.slice(0, 200))
    : [];
  return {
    water: o.water,
    seed,
    daily: o.daily === true,
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(o.date)) ? String(o.date) : "2026-01-01",
    min: int(o.min, 0, 0, 1e6),
    hunger: num(o.hunger, START_HUNGER, 0, 100),
    warmth: num(o.warmth, 100, 0, 100),
    weather: int(o.weather, 0, 0, 3),
    camp: {
      shelter: tier(camp.shelter),
      fire: int(camp.fire, 0, 0, FIRE_MAX_MIN),
      smoker: camp.smoker === true,
      driftwood: int(camp.driftwood, 0, 0, 99),
      bone: int(camp.bone, 0, 0, 99),
      gut: int(camp.gut, 0, 0, 99),
    },
    gear: { hook: tier(gear.hook), line: tier(gear.line) },
    larder: readLarder(o.larder),
    log: trim(log),
    casts: int(o.casts, 0, 0, 1e7),
    sick: int(o.sick, 0, 0, SICK_MIN),
    fish: int(o.fish, 0, 0, 1e7),
    eaten: int(o.eaten, 0, 0, 1e7),
    bad: int(o.bad, 0, 0, 1e7),
    biggest: bg
      ? { name: text(bg.name, "Fish", 60), w: num(bg.w, 0, 0, 1e6), t: int(bg.t, 0, 0, 4) }
      : null,
    rescued: o.rescued === true,
    over: readEnd(o.over),
    recorded: o.recorded === true,
  };
}

function readHistory(v: unknown): RunSummary[] {
  if (!Array.isArray(v)) return [];
  const out: RunSummary[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    out.push({
      water: isSurvivalWater(o.water) ? o.water : 0,
      daily: o.daily === true,
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(o.date)) ? String(o.date) : "2026-01-01",
      days: int(o.days, 0, 0, 1e5),
      fish: int(o.fish, 0, 0, 1e7),
      eaten: int(o.eaten, 0, 0, 1e7),
      biggest: num(o.biggest, 0, 0, 1e6),
      won: o.won === true,
      cause: text(o.cause, "", 200),
    });
    if (out.length >= HISTORY_MAX) break;
  }
  return out;
}

/** The survival dex: only Survival waters and real species slots survive. */
export function readSurvivalDex(v: unknown): Dex {
  const out: Dex = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as object)) {
    if (!/^\d+-\d+$/.test(k)) continue;
    const [b, i] = k.split("-").map(Number);
    if (!isSurvivalWater(b) || i < 0 || i >= SPECIES_PER_BIOME) continue;
    const e = obj(val);
    const c = int(e.c, 0, 0, 1e9);
    if (!c) continue;
    out[`${b}-${i}`] = { c, w: num(e.w, 0, 0, 1e6), m: int(e.m, 0, 0, 5) };
  }
  return out;
}

function readSpots(v: unknown): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [k, id] of Object.entries(obj(v))) {
    const b = Number(k);
    if (!isSurvivalWater(b) || typeof id !== "string") continue;
    if (spotById(b, id)) out[b] = id;
  }
  return out;
}

function readRigs(v: unknown): Record<number, Rig> {
  const out: Record<number, Rig> = {};
  for (const [k, rig] of Object.entries(obj(v))) {
    const b = Number(k);
    if (isSurvivalWater(b)) out[b] = readRig(rig);
  }
  return out;
}

/** Old saves are lifted to the current version here, one step at a time. There is only version 1 so far:
    the step is the place a later change adds its `if (version < 2)`. A save from a NEWER game keeps what we know. */
export function migrateSurvival(raw: unknown): Record<string, unknown> {
  const o = obj(raw);
  const version = int(o.version, 1, 1, 1e6);
  return { ...o, version: Math.min(version, SURVIVAL_VERSION) };
}

/** Anything at all in, a safe SurvivalSave out. Never throws. */
export function sanitizeSurvival(raw: unknown): SurvivalSave {
  if (!raw || typeof raw !== "object") return freshSurvivalSave();
  const o = migrateSurvival(raw);
  const coached: Record<string, number> = {};
  for (const [k, n] of Object.entries(obj(o.coached))) {
    if (/^[a-z]{3,12}$/.test(k)) coached[k] = int(n, 0, 0, 99);
  }
  return {
    version: SURVIVAL_VERSION,
    run: readRun(o.run),
    history: readHistory(o.history),
    lastWater: isSurvivalWater(o.lastWater) ? o.lastWater : 0,
    dex: readSurvivalDex(o.dex),
    records: readRecords(o.records),
    lastSpot: readSpots(o.lastSpot),
    rig: readRigs(o.rig),
    coached,
    drag: int(o.drag, 1, 0, 2) as 0 | 1 | 2,
  };
}

/** The pieces of the live store that Survival saves (the store has many more fields that Survival ignores). */
export type SurvivalFields = {
  survival: SurvivalRun | null;
  sMeta: SurvivalMeta;
  dex: Dex;
  records: Records;
  lastSpot: Record<number, string>;
  rig: Record<number, Rig>;
  coached: Record<string, number>;
  drag: 0 | 1 | 2;
};

/** What goes into `fac-ultra-survival`. */
export function toSurvivalSave(s: SurvivalFields): SurvivalSave {
  return {
    version: SURVIVAL_VERSION,
    run: s.survival,
    history: s.sMeta.history,
    lastWater: s.sMeta.lastWater,
    dex: s.dex,
    records: s.records,
    lastSpot: s.lastSpot,
    rig: s.rig,
    coached: s.coached,
    drag: s.drag,
  };
}
