/* Line wear: the line has health, and a hooked fish drains it (docs/architecture/10 §1).

   Pure and tiny on purpose: fight.ts imports this, the server replays with it, and it imports
   nothing from the game's content tables. Every number is in WEAR below.

   RULES VERSIONS (docs/architecture/10 §1.6). Wear changes how a replayed cast ends, so it is
   versioned. Tournament events record the version they were created under and the server replays
   each cast with that version's rules:
     1 = the original fight, no wear (every event made before WP-14).
     2 = line wear on.
   Anything that would change a replayed cast again bumps RULES_VERSION and adds a case below. */

/** The newest fight/line rules. New events are created under this version. */
export const RULES_VERSION = 2;
/** The oldest rules the server still replays. */
export const OLDEST_RULES_VERSION = 1;

/** A version number from anything (an old event row has none: that means version 1). */
export function rulesVersionOf(v: unknown): number {
  return typeof v === "number" && Number.isInteger(v) && v >= OLDEST_RULES_VERSION && v <= RULES_VERSION ? v : OLDEST_RULES_VERSION;
}

/** Does this rules version wear the line down in a fight? */
export const hasLineWear = (version: number) => version >= 2;

/** The tuning table. Edit here, run lines.test.ts. */
export const WEAR = {
  /** One tick of wear is this many fight steps. 20 steps of 50 ms = 1 second. Whole steps keep it exact. */
  tickSteps: 20,
  /** The line's health is counted in points; 100 points is "100 percent" for the drain table. */
  pointsPer100: 100,
  /** Percent of that 100 points a hooked fish takes each tick, by rarity: common, uncommon, rare, epic, legendary.
      Caleb named 1, 2, 5, 10 and 15; rare (3) is the middle, decided in WP-14. */
  pct: [1, 2, 3, 5, 10] as const,
  /** Bosses, and anything above legendary, take this much. */
  bossPct: 15,
  /** Holding the reel with the needle in the green halves the wear: skill beats the clock. */
  reelingInGreen: 0.5,
  /** A tired fish pulls less, so it wears the line less. */
  tired: 0.6,
  tiredBelow: 0.25,
  /** A fish in the air (or a statue-still Emperor) is not pulling at all. */
  airborne: 0,
  /** Helping Hand at full strength takes this share off the wear (scaled by its strength). */
  helpEase: 0.5,
  /** Kid Mode: very forgiving. Applied by the engine as the fight's base wear multiplier. */
  kidMul: 0.25,
  /** Recreational: the line never wears out. */
  recreationalMul: 0,
} as const;

/** Percent per tick for a fish of rarity 0–4, or a boss (anything above legendary counts as a boss). */
export function wearPct(rarity: number, boss: boolean): number {
  if (boss || rarity > 4) return WEAR.bossPct;
  return WEAR.pct[Math.min(4, Math.max(0, Math.floor(rarity)))];
}

/** What the fight is doing right now, as far as wear cares. */
export type WearView = {
  reeling: boolean;
  tension: number;
  lo: number;
  hi: number;
  stamina: number;
  jump: number;
  still: number;
};

/** How much of a tick's wear the line takes this moment. */
export function wearFactor(v: WearView): number {
  if (v.jump > 0 || v.still > 0) return WEAR.airborne;
  let m = 1;
  if (v.reeling && v.tension >= v.lo && v.tension <= v.hi) m *= WEAR.reelingInGreen;
  if (v.stamina < WEAR.tiredBelow) m *= WEAR.tired;
  return m;
}

/** Points one full tick takes, before the moment's factor and the fight's multipliers. */
export function tickPoints(rarity: number, boss: boolean): number {
  return (WEAR.pointsPer100 * wearPct(rarity, boss)) / 100;
}
