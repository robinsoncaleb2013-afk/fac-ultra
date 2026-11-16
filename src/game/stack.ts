/* Update 4: mutation stacks.
   A fish keeps its first mutation in `m` (so old saves and the book still work) and any
   further ones in `extra`. Worth and XP bonuses add: an 8x and a 2x together are 9x,
   not 16x. Releasing a mutated fish may arm the next catch to be that same fish plus
   one new mutation. The chance starts at 25% and falls as the stack grows. */

import { BIOMES, FIRST_EVENT_MUTATION, MUTATIONS, rarityOf } from "./content.ts";
import type { EventsSave } from "./events.ts";
import { makeRng, seedFrom } from "./rng.ts";

export type StackFish = {
  b: number;
  i: number;
  m: number;
  v: number;
  w: number;
  name: string;
  boss: boolean;
  extra?: number[];
};

export type Restack = { b: number; i: number; ids: number[]; v: number; w: number };

export const CALM_STACK = 5;

/** Mutation ids on a fish, first one first. Ordinary fish (m = 0) have none. */
export function stackIds(fish: { m: number; extra?: number[] }): number[] {
  const ids = fish.m > 0 ? [fish.m] : [];
  for (const id of fish.extra ?? []) if (id > 0 && !ids.includes(id)) ids.push(id);
  return ids;
}

/** Chance the next catch is this fish again with one more mutation. */
export function stackChance(count: number): number {
  if (count <= 0) return 0;
  if (count <= 5) return (30 - 5 * count) / 100;
  return Math.max(1, 10 - count) / 100;
}

/** Combined sale multiplier. Each mutation adds its bonus on top of 1x. */
export function worthFactor(ids: readonly number[]): number {
  let bonus = 0;
  for (const id of ids) if (id > 0) bonus += (MUTATIONS[id]?.mult ?? 1) - 1;
  return 1 + bonus;
}

/** Combined XP multiplier, same rule as worth. */
export function xpFactor(ids: readonly number[]): number {
  let bonus = 0;
  for (const id of ids) if (id > 0) bonus += (MUTATIONS[id]?.xp ?? 1) - 1;
  return 1 + bonus;
}

export function stackTitle(ids: readonly number[], species: string): string {
  const names = ids.map((id) => MUTATIONS[id]?.name).filter((n): n is string => !!n);
  return names.length ? `${names.join(" ")} ${species}` : species;
}

/** XP for a stacked fish. With no extras this is not used — catchXp keeps the old path. */
export function stackCatchXp(rarity: number, ids: readonly number[], biome: number, boss: boolean): number {
  let steps = 0;
  for (const id of ids) if (id > 0 && id < FIRST_EVENT_MUTATION) steps += id;
  const base = 3 + rarity * 8 + steps * 5 + biome * 2 + (boss ? 12 : 0);
  return Math.round(base * xpFactor(ids));
}

function pickExtra(st: EventsSave, ids: readonly number[]): { id: number | null; draws: number } {
  const open: number[] = [];
  for (let id = 1; id < MUTATIONS.length; id++) if (!ids.includes(id)) open.push(id);
  const draws = st.draws + 1;
  if (!open.length) return { id: null, draws };
  const r = makeRng(seedFrom(st.seed, "restack-mut", st.draws))();
  return { id: open[Math.floor(r * open.length)], draws };
}

/** Roll whether a release arms a re-catch. Bosses and plain fish never do. */
export function offerRestack(st: EventsSave, fish: StackFish): { state: EventsSave; armed: boolean } {
  const ids = stackIds(fish);
  if (fish.boss || ids.length === 0) return { state: st, armed: false };
  const draws = st.draws + 1;
  const hit = makeRng(seedFrom(st.seed, "restack", st.draws))() < stackChance(ids.length);
  if (!hit) return { state: { ...st, draws }, armed: false };
  const restack: Restack = { b: fish.b, i: fish.i, ids, v: fish.v, w: fish.w };
  return { state: { ...st, draws, restack }, armed: true };
}

/** If a re-catch is armed, this fish becomes that species plus one new mutation. Bosses wait. */
export function takeRestack<F extends StackFish>(st: EventsSave, fish: F): { fish: F; state: EventsSave; hit: boolean } {
  const pending = st.restack;
  if (!pending || fish.boss) return { fish, state: st, hit: false };
  const picked = pickExtra(st, pending.ids);
  const ids = picked.id ? [...pending.ids, picked.id] : [...pending.ids];
  const species = BIOMES[pending.b]?.fish[pending.i] ?? "Fish";
  const before = worthFactor(pending.ids);
  const v = Math.max(1, Math.round((pending.v * worthFactor(ids)) / before));
  const next = {
    ...fish,
    b: pending.b,
    i: pending.i,
    t: rarityOf(pending.i),
    m: ids[0] ?? 0,
    extra: ids.slice(1),
    name: stackTitle(ids, species),
    v,
    w: pending.w,
    boss: false,
  } as F;
  return { fish: next, state: { ...st, draws: picked.draws, restack: null }, hit: true };
}
