/* Lines: health, line packs and the workshop (docs/architecture/10 §1).

   Lines are no longer sold. They come from packs (catches, level-ups, bosses, contracts) and
   duplicates are good news: n copies of one line craft into one copy of the next. How good a line
   you can craft is capped by your level and by how many bosses you have beaten.

   Pure: no store, no browser. The engine keeps one `LineGear` in the save and calls these.
   Every number is in a table below with a comment. */

import { LINES } from "./content.ts";
import { tickPoints, WEAR } from "./line-wear.ts";
const W = WEAR;

/** Tiers are the existing LINES ladder (Mono 6lb … Starweave Eternal). */
export const LINE_TIERS = LINES.length;
export const TOP_TIER = LINE_TIERS - 1;

/** Health points of each tier (100 = "100 percent" in the drain table). Better line, more health. */
export const LINE_HEALTH: readonly number[] = [100, 130, 165, 205, 250, 300, 360, 430, 510, 600, 700, 820];

/** Crafting: RECIPE_DUPES[t] copies of tier t make one copy of tier t+1. The better the line, the more it takes. */
export const RECIPE_DUPES: readonly number[] = [3, 3, 3, 4, 4, 5, 5, 6, 6, 8, 10];

/** The cap on crafting: to make tier t you need this level AND this many different bosses beaten. Tier 11 is the hard max.
    (Index 0 is the starter line, which cannot be crafted.) */
export const CRAFT_GATE: readonly { lv: number; bosses: number }[] = [
  { lv: 1, bosses: 0 },
  { lv: 3, bosses: 0 },
  { lv: 6, bosses: 0 },
  { lv: 10, bosses: 1 },
  { lv: 15, bosses: 2 },
  { lv: 21, bosses: 3 },
  { lv: 28, bosses: 4 },
  { lv: 36, bosses: 6 },
  { lv: 45, bosses: 8 },
  { lv: 55, bosses: 10 },
  { lv: 68, bosses: 12 },
  { lv: 85, bosses: 14 },
];

/** Line packs. Three lines each. `weights[k]` is the chance weight of tier `min + k`.
    The top two tiers (10 and 11) never drop: they can only be crafted. */
export const LINE_PACKS = [
  { name: "Bronze line pack", min: 0, weights: [60, 30, 10] },
  { name: "Silver line pack", min: 0, weights: [25, 30, 25, 15, 5] },
  { name: "Gold line pack", min: 2, weights: [15, 30, 25, 20, 10] },
  { name: "Platinum line pack", min: 4, weights: [20, 25, 20, 15, 12, 8] },
] as const;
export const LINES_PER_PACK = 3;

/** Where packs come from. All of it happens only in modes with an economy. */
export const PACK_SOURCES = {
  /** Chance of a pack from a landed fish, by rarity 0–4: [pack tier, chance]. */
  catch: [
    [0, 0.02],
    [0, 0.05],
    [1, 0.06],
    [2, 0.08],
    [3, 0.1],
  ] as readonly (readonly [number, number])[],
  /** The first time a boss falls. */
  boss: 2,
  /** Claiming a contract. */
  contract: 1,
  /** A level-up gives the biggest pack its rule allows: every 25th level Platinum, every 10th Gold, every 5th Silver, else Bronze. */
  level: [
    { every: 25, pack: 3 },
    { every: 10, pack: 2 },
    { every: 5, pack: 1 },
    { every: 1, pack: 0 },
  ] as readonly { every: number; pack: number }[],
} as const;

/** What a player keeps in the save. */
export type LineGear = {
  /** Copies owned of each tier. */
  lines: number[];
  /** Unopened packs of each kind. */
  packs: number[];
  /** The tiers of the last pack opened, for the "you got" line. */
  last: number[];
};

export function freeLineGear(): LineGear {
  return { lines: Array.from({ length: LINE_TIERS }, (_, i) => (i === 0 ? 1 : 0)), packs: LINE_PACKS.map(() => 0), last: [] };
}

/** Old saves had one `line` index and owned everything up to it: they become one copy of each. */
export function lineGearFromOld(line: number): LineGear {
  const top = Math.min(TOP_TIER, Math.max(0, Math.floor(line) || 0));
  const g = freeLineGear();
  for (let t = 0; t <= top; t++) g.lines[t] = 1;
  return g;
}

/** Every line, once (Recreational and Kid-free fishing: all lines are yours). */
export function allLineGear(): LineGear {
  const g = freeLineGear();
  g.lines = g.lines.map(() => 1);
  return g;
}

/** Make anything from a save file safe. Counts are whole numbers 0–9999. */
export function readLineGear(v: unknown, oldLine: number): LineGear {
  if (!v || typeof v !== "object") return lineGearFromOld(oldLine);
  const o = v as Record<string, unknown>;
  const count = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.min(9999, Math.max(0, Math.floor(x))) : 0);
  const lines = Array.from({ length: LINE_TIERS }, (_, i) => (Array.isArray(o.lines) ? count(o.lines[i]) : 0));
  if (!Array.isArray(o.lines)) return lineGearFromOld(oldLine);
  const packs = LINE_PACKS.map((_, i) => (Array.isArray(o.packs) ? count(o.packs[i]) : 0));
  const last = Array.isArray(o.last)
    ? o.last.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < LINE_TIERS).slice(0, LINES_PER_PACK)
    : [];
  return { lines, packs, last };
}

/** Can this tier be put on the rod? Tier 0 is the worn hand line you can always fall back on. */
export const canUse = (g: LineGear, tier: number) => tier === 0 || (g.lines[tier] ?? 0) > 0;

/** Health points of a tier. */
export const healthOf = (tier: number) => LINE_HEALTH[Math.min(TOP_TIER, Math.max(0, tier))];

/* ── Crafting ────────────────────────────────────────────────────────────── */

export type Craft = {
  ok: boolean;
  /** Copies of the lower line this takes. */
  need: number;
  have: number;
  /** Level and boss gates not yet met. */
  needLevel: number;
  needBosses: number;
  /** One plain sentence when not ok. */
  why: string;
};

/** Can one copy of `tier` be crafted right now? */
export function checkCraft(g: LineGear, tier: number, lv: number, bosses: number): Craft {
  if (tier < 1 || tier > TOP_TIER) return { ok: false, need: 0, have: 0, needLevel: 0, needBosses: 0, why: "This line cannot be crafted." };
  const need = RECIPE_DUPES[tier - 1];
  const have = g.lines[tier - 1] ?? 0;
  const gate = CRAFT_GATE[tier];
  const lvOk = lv >= gate.lv;
  const bossOk = bosses >= gate.bosses;
  const parts: string[] = [];
  if (!lvOk) parts.push(`reach level ${gate.lv}`);
  if (!bossOk) parts.push(`beat ${gate.bosses} ${gate.bosses === 1 ? "boss" : "bosses"}`);
  if (have < need) parts.push(`collect ${need} copies of ${LINES[tier - 1].name} (you have ${have})`);
  const why = parts.length ? `${sentence(parts)}.` : "";
  return { ok: !parts.length, need, have, needLevel: lvOk ? 0 : gate.lv, needBosses: bossOk ? 0 : gate.bosses, why };
}

/** Craft one copy of `tier`. Returns the new gear and the line to use if the one in use ran out, or null if it cannot be done. */
export function craft(g: LineGear, tier: number, lv: number, bosses: number): LineGear | null {
  const c = checkCraft(g, tier, lv, bosses);
  if (!c.ok) return null;
  const lines = [...g.lines];
  lines[tier - 1] -= c.need;
  lines[tier] += 1;
  return { ...g, lines };
}

/** The highest tier this player could craft by level and bosses alone (the cap shown in the workshop). */
export function craftCap(lv: number, bosses: number): number {
  let top = 0;
  for (let t = 1; t < LINE_TIERS; t++) if (lv >= CRAFT_GATE[t].lv && bosses >= CRAFT_GATE[t].bosses) top = t;
  return top;
}

/* ── Packs ───────────────────────────────────────────────────────────────── */

/** Open a pack: three lines. `rand` returns [0,1). Pure given the random source. */
export function openPack(kind: number, rand: () => number): number[] {
  const pack = LINE_PACKS[kind];
  if (!pack) return [];
  const total = pack.weights.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  for (let n = 0; n < LINES_PER_PACK; n++) {
    let r = rand() * total;
    let k = 0;
    for (; k < pack.weights.length - 1; k++) {
      r -= pack.weights[k];
      if (r < 0) break;
    }
    out.push(pack.min + k);
  }
  return out;
}

/** Spend one pack of `kind`; returns the new gear (lines added, `last` set) or null if there is none. */
export function applyOpen(g: LineGear, kind: number, rand: () => number): LineGear | null {
  if (!(g.packs[kind] > 0)) return null;
  const got = openPack(kind, rand);
  const lines = [...g.lines];
  for (const t of got) lines[t] += 1;
  const packs = [...g.packs];
  packs[kind] -= 1;
  return { lines, packs, last: got };
}

/** Which pack (if any) a landed fish drops. */
export function packFromCatch(rarity: number, rand: () => number): number | null {
  const [pack, chance] = PACK_SOURCES.catch[Math.min(4, Math.max(0, Math.floor(rarity)))];
  return rand() < chance ? pack : null;
}

/** The pack a level-up gives. */
export function packForLevel(level: number): number {
  for (const r of PACK_SOURCES.level) if (level % r.every === 0) return r.pack;
  return 0;
}

export function givePack(g: LineGear, kind: number, n = 1): LineGear {
  const packs = [...g.packs];
  packs[kind] = Math.min(9999, (packs[kind] ?? 0) + n);
  return { ...g, packs };
}

/* ── What the fight gets ─────────────────────────────────────────────────── */

/** The fight's wear multiplier for a mode (10 §1.5). `difficulty` is WP-16's hook: 1 is normal, 2 is twice the wear. */
export function wearMulFor(o: { recreational?: boolean; kid?: boolean; difficulty?: number }): number {
  if (o.recreational) return W.recreationalMul;
  const d = o.difficulty === undefined || !Number.isFinite(o.difficulty) ? 1 : Math.max(0, o.difficulty);
  return d * (o.kid ? W.kidMul : 1);
}

/** Seconds a line of this tier lasts against a fish of this rarity (or a boss), reeling steadily in the green or not reeling at all. */
export function secondsAgainst(tier: number, rarity: number, boss: boolean, steady: boolean): number {
  const perSecond = tickPoints(rarity, boss) * (steady ? WEAR.reelingInGreen : 1);
  return Math.floor(healthOf(tier) / perSecond);
}

/* ── Hooks for the harder modes (WP-16) ──────────────────────────────────── */

/** Difficulty multipliers WP-16 sets (default 1 = normal). `wear` multiplies how fast fish wear the line. */
export const difficulty = { wear: 1 };

/** What happens to the tackle when a line wears out or snaps. Nothing is lost in WP-14; WP-16's hardest
    difficulty sets these. `cause` says why. */
export type LossHooks = {
  loseLure?: (cause: "worn" | "snap") => void;
  loseRod?: (cause: "worn" | "snap") => void;
};
let hooks: LossHooks = {};
export const setLossHooks = (h: LossHooks) => {
  hooks = h;
};
export const lossHooks = (): LossHooks => hooks;

/** "a, b and c" */
function sentence(parts: string[]): string {
  const p = [...parts];
  const first = p.shift()!;
  const cap = first[0].toUpperCase() + first.slice(1);
  if (!p.length) return cap;
  const last = p.pop()!;
  return [cap, ...p].join(", ") + " and " + last;
}
