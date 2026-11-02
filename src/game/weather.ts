/* Deterministic event weather (docs/architecture/06 §2.3).

   A tournament has one weather for everybody: a Markov chain stepped every five
   minutes from the event's seed, so everyone sees the same rain at the same minute and
   the server can recompute it when it replays a cast. Pure, isomorphic, no state.

   The chain has four states, the same ids the game uses (0 sunny, 1 rain, 2 storm,
   3 fog). "Night" (id 4) is a time of day, not a sky: events take their time of day from
   the clock (see `windowAt` in replay.ts), so it never appears here. Every state keeps
   itself 70% of the time (06 §2.3 / 05 §5.4); the other 30% is spread by this table.
   Survival (WP-5) can import WX_MATRIX if it wants the same sky. */

import { makeRng, seedFrom } from "./rng.ts";

/** One step of the chain, in milliseconds. */
export const WEATHER_STEP_MS = 5 * 60_000;

/** Row = the weather now, column = the weather next step. Each row sums to 1. */
export const WX_MATRIX: readonly (readonly number[])[] = [
  [0.7, 0.15, 0.03, 0.12], // sunny
  [0.15, 0.7, 0.1, 0.05], // rain
  [0.1, 0.2, 0.7, 0.0], // storm
  [0.2, 0.1, 0.0, 0.7], // fog
];

export const WX_STATES = WX_MATRIX.length;

/** The long-run share of time in each weather (power iteration; used for the first step and by tests). */
export function stationary(): number[] {
  let p = Array.from({ length: WX_STATES }, () => 1 / WX_STATES);
  for (let k = 0; k < 400; k++) {
    const next = new Array<number>(WX_STATES).fill(0);
    for (let i = 0; i < WX_STATES; i++) for (let j = 0; j < WX_STATES; j++) next[j] += p[i] * WX_MATRIX[i][j];
    p = next;
  }
  return p;
}

function draw(row: readonly number[], x: number): number {
  let acc = 0;
  for (let j = 0; j < row.length; j++) {
    acc += row[j];
    if (x < acc) return j;
  }
  return row.length - 1;
}

/** The weather `msSinceStart` after an event began. Same seed and time, same sky, everywhere. */
export function weatherAt(seed: number, msSinceStart: number): number {
  const steps = Math.min(20_000, Math.max(0, Math.floor(msSinceStart / WEATHER_STEP_MS)));
  const r = makeRng(seedFrom(seed, "wx"));
  let state = draw(stationary(), r());
  for (let k = 0; k < steps; k++) state = draw(WX_MATRIX[state], r());
  return state;
}
