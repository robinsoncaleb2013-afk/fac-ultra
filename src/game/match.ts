/* How well a cast fits the fish (docs/architecture/04 §3.3–3.6, §4).

   Everything here is pure: give it a water, a spot, what is on the line, the
   weather and the time of day, and it says which fish will want it, how fast
   they will bite, and what to tell the player. No state, no randomness. */

import {
  BOSS_INDEX,
  MAX_MATCH,
  fishWeights,
  matchWeight,
  sizeBiasOf,
  stageCap,
  type RollOptions,
} from "./content.ts";
import { habitOf, habitsOfBiome, type Habit } from "./habits.ts";
import {
  DEPTH_INFO,
  FAMILY_INFO,
  RETRIEVES,
  RETRIEVE_INFO,
  type Presentation,
  type Window,
} from "./presentation.ts";
import { spotsOf, type Spot } from "./spots.ts";

export { matchWeight, MAX_MATCH, sizeBiasOf };

/** How long a cast may wait before the pill offers a hint (04 §3.6 says 8 s, but the longest
    wait the game can produce is about 5.4 s, so 8 s would never fire; see the PR notes). */
export const HINT_AFTER = 3;

/** 05–08 dawn, 08–17 day, 17–20 dusk, else night. Night weather (id 4) forces night. */
export function windowOf(hour: number, weather = 0): Window {
  if (weather === 4) return "night";
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

/** The window right now. With "follow the clock" off the water stays in daytime. */
export function windowNow(followClock: boolean, weather: number, now: Date = new Date()): Window {
  return windowOf(followClock ? now.getHours() + now.getMinutes() / 60 : 12, weather);
}

export function matchScore(
  h: Habit,
  spot: Spot,
  p: Presentation,
  weather: number,
  window: Window,
): number {
  let s = 0;
  if (h.structures.includes(spot.structure)) s += 2;
  if (h.depth === p.depth) s += 2;
  else if (Math.abs(h.depth - p.depth) === 1) s += 0.5;
  if (h.likes.includes(p.family)) s += 2;
  if (h.retrieve.includes(p.retrieve)) s += 1;
  if (h.feeds.includes(window)) s += 1.5;
  if (h.weather.includes(weather)) s += 1;
  return s;
}

/** Match score for every species slot in the water (the boss slot too). */
export function matchVector(
  biome: number,
  spot: Spot,
  p: Presentation,
  weather: number,
  window: Window,
): number[] {
  return habitsOfBiome(biome).map((h) => matchScore(h, spot, p, weather, window));
}

/** The bite-time multiplier: a great rig at the right spot bites in about a third of the time. */
export function biteFactor(avgMatch: number): number {
  return Math.min(1.35, Math.max(0.45, 1.35 - avgMatch * 0.09));
}

/** Mean match of the fish that are actually around (their normal odds, before the match itself). */
export function averageMatch(ms: readonly number[], weights: readonly number[]): number {
  let sum = 0;
  let total = 0;
  for (let n = 0; n < ms.length; n++) {
    sum += (weights[n] ?? 0) * ms[n];
    total += weights[n] ?? 0;
  }
  return total > 0 ? sum / total : 0;
}

export type CastPlan = {
  /** Match score per species slot. */
  ms: number[];
  /** Average match of the fish around. */
  avg: number;
  /** Multiplier for the wait before a bite. */
  wait: number;
};

/** Everything the engine needs at the moment of the cast. */
export function planCast(
  biome: number,
  spot: Spot,
  p: Presentation,
  weather: number,
  window: Window,
  luck: number,
  opts: RollOptions = {},
): CastPlan {
  const ms = matchVector(biome, spot, p, weather, window);
  const base = fishWeights(biome, luck, { ...opts, match: undefined });
  const avg = averageMatch(ms, base);
  return { ms, avg, wait: biteFactor(avg) };
}

/* ── Words for the player ─────────────────────────────────────────────── */

const WAKES: Record<Window, string> = { dawn: "dawn", day: "midday", dusk: "dusk", night: "night" };
const ORDER = (r: Presentation["retrieve"]) => RETRIEVES.indexOf(r);

/** After a catch: what the fish would have preferred, or null if the rig was right. */
export function missNote(h: Habit, p: Presentation): string | null {
  if (!h.retrieve.includes(p.retrieve)) {
    const want = [...h.retrieve].sort(
      (a, b) => Math.abs(ORDER(a) - ORDER(p.retrieve)) - Math.abs(ORDER(b) - ORDER(p.retrieve)),
    )[0];
    const dir = ORDER(want) < ORDER(p.retrieve) ? "slower" : "faster";
    return `That one wanted a ${dir} retrieve.`;
  }
  if (h.depth !== p.depth)
    return h.depth > p.depth ? "That one was hiding deeper." : "That one was up near the top.";
  if (!h.likes.includes(p.family)) return `That one likes ${FAMILY_INFO[h.likes[0]].plural}.`;
  return null;
}

/** The biggest thing wrong with the cast, as one short tip (never a species name). */
export function hintFor(h: Habit, spot: Spot, p: Presentation, window: Window): string | null {
  const losses: { loss: number; text: string }[] = [];
  if (h.depth !== p.depth) {
    const gap = Math.abs(h.depth - p.depth);
    losses.push({
      loss: gap === 2 ? 2 : 1.5,
      text: h.depth > p.depth ? "Fish deeper here." : "Try fishing shallower here.",
    });
  }
  if (!h.likes.includes(p.family)) {
    losses.push({ loss: 2, text: `Try ${FAMILY_INFO[h.likes[0]].plural}.` });
  }
  if (!h.feeds.includes(window)) {
    losses.push({ loss: 1.5, text: `This spot wakes up at ${WAKES[h.feeds[0]]}.` });
  }
  if (!h.retrieve.includes(p.retrieve)) {
    const want = [...h.retrieve].sort(
      (a, b) => Math.abs(ORDER(a) - ORDER(p.retrieve)) - Math.abs(ORDER(b) - ORDER(p.retrieve)),
    )[0];
    losses.push({
      loss: 1,
      text: ORDER(want) < ORDER(p.retrieve) ? "Try a slower retrieve." : "Try a faster retrieve.",
    });
  }
  if (!h.structures.includes(spot.structure)) {
    losses.push({ loss: 2.5, text: "Try a different spot." });
  }
  losses.sort((a, b) => b.loss - a.loss);
  return losses[0]?.text ?? null;
}

/** After a quiet wait: look at the best-matching species the player has NOT caught here yet and
    say what would suit it. `caught(i)` says whether slot i is already in the dex. */
export function hintForCast(
  biome: number,
  spot: Spot,
  p: Presentation,
  weather: number,
  window: Window,
  stage: number,
  caught: (i: number) => boolean,
): string | null {
  const cap = stageCap(stage);
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i <= cap && i < BOSS_INDEX; i++) {
    if (caught(i)) continue;
    const h = habitOf(biome, i);
    /* Only fish that actually live at this kind of spot. */
    if (!h.structures.includes(spot.structure)) continue;
    const score = matchScore(h, spot, p, weather, window);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  if (best < 0) return "Nothing new lives here. Try another spot.";
  return hintFor(habitOf(biome, best), spot, p, window);
}

/** The two commonest species that hold at a spot, for the hover label (04 §3.6). */
export function spotResidents(biome: number, spot: Spot, count = 2): number[] {
  const out: { i: number; score: number }[] = [];
  for (let i = 0; i < BOSS_INDEX; i++) {
    const h = habitOf(biome, i);
    if (!h.structures.includes(spot.structure)) continue;
    /* Commoner species first; a depth match breaks ties among near equals. */
    out.push({ i, score: -i + (h.depth === spot.depth ? 0.5 : 0) });
  }
  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((o) => o.i);
}

/** The spots in a water where a species holds (for the dex "Where to find" row). */
export function whereToFind(biome: number, i: number): Spot[] {
  const h = habitOf(biome, i);
  return spotsOf(biome).filter((s) => h.structures.includes(s.structure));
}

/** One line for the Rig sheet: the pace and depth that suit the commonest fish at this spot.
    Names a fish only if the player has already caught it. */
export function rigHint(biome: number, spot: Spot, name: (i: number) => string | null): string {
  const [first] = spotResidents(biome, spot, 1);
  if (first === undefined) return "Try a few settings and see what bites.";
  const h = habitOf(biome, first);
  const style = `${RETRIEVE_INFO[h.retrieve[0]].label} and ${DEPTH_INFO[h.depth].short}`;
  const who = name(first);
  return who ? `${style} is good for ${who} here.` : `${style} is a good start at this spot.`;
}
