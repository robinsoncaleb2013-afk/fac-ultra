import { KID_HELP_FLOOR } from "./kid.ts";

/* Helping Hand: the kid-mode reel assist (docs/architecture/03 §5).
   A pure function of how the player has been doing, so it is unit-tested and
   the component layer never computes a band width. */

export type AssistInput = {
  /** Is Helping Hand switched on in Settings? */
  assist: boolean;
  /** Consecutive missed taps inside this fight. */
  misses: number;
  /** Consecutive fights lost (slip or snap). Each counts as two misses. */
  failedFights: number;
  /** Consecutive fights won. */
  wins: number;
  /** Kid Mode: the help never fades below a moderate amount (05 §4). */
  kid?: boolean;
};

export type AssistResult = {
  missStreak: number;
  hitStreak: number;
  /** Percentage points added to the band width. */
  zoneBonus: number;
  /** Multiplies the cursor speed. */
  speedFactor: number;
  /** Extra seconds on the bite window. */
  biteBonus: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function helpingHand(i: AssistInput): AssistResult {
  const missStreak = Math.max(0, i.misses) + Math.max(0, i.failedFights) * 2;
  const hitStreak = Math.max(0, i.wins);
  if (!i.assist) return { missStreak, hitStreak, zoneBonus: 0, speedFactor: 1, biteBonus: 0 };
  return {
    missStreak,
    hitStreak,
    zoneBonus: clamp(missStreak * 3 - hitStreak * 1.5, -4, 14),
    speedFactor: clamp(1 - missStreak * 0.07 + hitStreak * 0.03, 0.6, 1.1),
    biteBonus: clamp(missStreak * 0.25, 0, 1.2),
  };
}

/* ── Helping Hand in the tension fight (docs/architecture/04 §5.6) ───────────
   The same streaks that used to widen the cursor band now steer the fight:
   a wider green zone, half the line strain, a longer warning before a run, and
   a fish that pulls a little less. The strength follows the player: it starts
   moderate, climbs while they keep losing, and fades after a couple of wins. */

export type FightHelp = {
  /** 0 (none) … 1 (green [0.28, 0.85], half strain, 0.8 s warning). */
  strength: number;
  /** Multiplies the fish's pull. */
  pullMul: number;
};

/** Below this the help is faint enough that the glow and the "helping hand" line go away. */
export const HELP_SHOWN = 0.3;

/** null when Helping Hand is off (and always off in tournaments, which pass `assist: false`). */
export function fightHelp(i: AssistInput): FightHelp | null {
  if (!i.assist) return null;
  const h = helpingHand(i);
  return {
    strength: clamp(0.4 + (h.zoneBonus / 14) * 0.6, i.kid ? KID_HELP_FLOOR : 0.15, 1),
    pullMul: h.speedFactor,
  };
}

/** Should the ring glow and the pill say "Helping hand: the green is wider."? Honest, never secret. */
export function isHelping(help: FightHelp | null, always = false): boolean {
  return !!help && (always || help.strength >= HELP_SHOWN);
}
