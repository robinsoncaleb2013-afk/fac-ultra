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
