/* Regulars on an empty board (docs/architecture/06 §3.2, 05 §6.1).

   A Quick event with only a few anglers in it would be a lonely board. The server tops it up with
   named Regulars (rivals.ts) who "fish" the event on the clock: each makes a cast every 14 to 26
   seconds of event time, with the same fish model, the same water and the same sky as everyone else.
   Their score at any moment is a pure function of the event and the time, so every request agrees
   and nothing is stored. They are shown with a little badge so nobody mistakes them for people, they
   leave the board one by one as real anglers join, and they never appear on Daily, Weekly or
   private boards. */

import { pickRivals, castSeconds, bonus, rivalFish, type DerbyCtx, type Rival } from "./rivals.ts";
import { EVENT_STAGE, eventLuck, windowAt } from "./replay.ts";
import { scoreEntry, type Category, type Landed, type Score } from "./scoring.ts";
import { weatherAt } from "./weather.ts";

/** A Quick board shows at least this many names once Regulars have filled the gaps. */
export const BOARD_MIN = 6;
/** Never more than this many Regulars on one board. */
export const MAX_FILL = 5;

/** How many Regulars a board of `humans` real anglers gets. Only Quick events are topped up. */
export function fillCount(kind: string, humans: number): number {
  if (kind !== "quick") return 0;
  return Math.max(0, Math.min(MAX_FILL, BOARD_MIN - Math.max(0, humans)));
}

export type FillEvent = {
  id: string;
  seed: number;
  water: number;
  startsAt: number;
  endsAt: number;
  category: Category;
  castBudget: number;
};

export type RivalRow = Score & { rival: Rival; casts: number };

type Cast = { species: number; weight: number; value: number } | null;
const memo = new Map<string, Cast>();

function castOf(ev: FillEvent, r: Rival, k: number): Cast {
  const key = `${ev.id}:${r.id}:${k}`;
  const have = memo.get(key);
  if (have !== undefined) return have;
  const ms = k * castSeconds(r.skill) * 1000;
  const weather = weatherAt(ev.seed, ms);
  const ctx: DerbyCtx = {
    seed: ev.seed,
    biome: ev.water,
    luck: eventLuck(weather),
    stage: EVENT_STAGE,
    weather,
    window: windowAt(ev.startsAt + ms, weather),
  };
  const fish = rivalFish(r, ctx, k);
  const out: Cast = fish ? { species: fish.i, weight: fish.w, value: Math.round(fish.v * bonus(r.skill)) } : null;
  if (memo.size > 6000) memo.clear();
  memo.set(key, out);
  return out;
}

/** The Regulars who fish this event, in a fixed order (the same first ones whatever `n` is). */
export function fillRivals(ev: Pick<FillEvent, "seed" | "water">, n: number): Rival[] {
  return pickRivals(ev.seed, ev.water, MAX_FILL).slice(0, Math.max(0, Math.min(MAX_FILL, n)));
}

/** Where `n` Regulars stand `now`. Idempotent and clock-driven: ask twice, same answer. */
export function rivalRows(ev: FillEvent, n: number, now: number): RivalRow[] {
  const elapsed = Math.max(0, Math.min(now, ev.endsAt) - ev.startsAt) / 1000;
  return fillRivals(ev, n).map((rival) => {
    const due = Math.min(ev.castBudget, Math.floor(elapsed / castSeconds(rival.skill)));
    const landed: Landed[] = [];
    for (let k = 0; k < due; k++) {
      const c = castOf(ev, rival, k);
      if (c) landed.push({ castIndex: k, species: c.species, weight: c.weight, value: c.value });
    }
    return { rival, casts: due, ...scoreEntry(ev.category, landed) };
  });
}

/** How many of these Regulars are strictly ahead of a human with this score and tiebreak
    (humans win ties: a draw with a Regular goes to the person). */
export function rivalsAhead(rows: readonly Pick<Score, "score" | "tiebreak">[], score: number, tiebreak: number): number {
  return rows.filter((r) => r.score > score || (r.score === score && r.tiebreak > tiebreak)).length;
}
