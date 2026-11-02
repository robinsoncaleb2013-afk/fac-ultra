/* The Regulars: twelve named anglers who fish the Derby against you (docs/architecture/05 §6.1).

   They replace the Derby's old random-walk numbers. A rival's score is built from
   simulated casts that use the REAL fishing model (`rollFish` with a match vector),
   seeded from the Derby's own seed, so a rival is beaten by fishing well and not by
   luck, and the same Derby seed always gives the same rivals the same day.

   Everything here is pure. A rival cast never touches the live `rng()` stream (the
   stream is swapped for the cast and put back), and nothing here is ever scored by a
   tournament: the fun layer stays out of anything a server verifies (06). WP-8 can call
   `rivalCast` to fill an empty Quick board. */

import { BIOMES, rollFish } from "./content.ts";
import { matchVector, windowOf } from "./match.ts";
import { DEPTHS, FAMILIES, RETRIEVES, type Window } from "./presentation.ts";
import { makeRng, rng, seedFrom, setRng, type Rng } from "./rng.ts";
import { spotsOf } from "./spots.ts";

export type Rival = {
  id: string;
  name: string;
  /** The emoji portrait. */
  emoji: string;
  /** Three short lines on who they are. */
  lines: readonly [string, string, string];
  /** 0.4 (still learning) to 0.95 (very hard to beat). */
  skill: number;
  /** Their favourite water (a biome index). They show up there more. */
  water: number;
  /** What they say when they beat you, and when you beat them. */
  win: string;
  lose: string;
};

export const SKILL_MIN = 0.4;
export const SKILL_MAX = 0.95;

export const RIVALS: readonly Rival[] = [
  {
    id: "tilly",
    name: "Tilly",
    emoji: "🧢",
    lines: ["Eight years old and fearless.", "Reels in everything with a giggle.", "Still learning which lure is which."],
    skill: 0.4,
    water: 0,
    win: "I got more! Did you see? I got more!",
    lose: "That was a good one. Next time I will catch the big one.",
  },
  {
    id: "barnaby",
    name: "Barnaby",
    emoji: "🐻",
    lines: ["Brings a thermos and a folding chair.", "Fishes slowly and talks even slower.", "Happy with any bite at all."],
    skill: 0.45,
    water: 1,
    win: "Well, what do you know. Lucky old me.",
    lose: "Good cast, friend. The chair is warm if you want it.",
  },
  {
    id: "juno",
    name: "Juno",
    emoji: "🌻",
    lines: ["Fishes for the sunrise, not the score.", "Names every fish before letting it go.", "Surprisingly quick with the net."],
    skill: 0.5,
    water: 2,
    win: "Ha! The sunrise was on my side.",
    lose: "You earned that one. I will call her Bluebell.",
  },
  {
    id: "maren",
    name: "Maren",
    emoji: "🧶",
    lines: ["Teaches the kids to tie their knots.", "Patient, steady and never in a hurry.", "Knows every weed bed in the Pond."],
    skill: 0.55,
    water: 0,
    win: "Slow and steady wins the day.",
    lose: "Lovely fishing. Your knots are getting better.",
  },
  {
    id: "dara",
    name: "Dara",
    emoji: "🎒",
    lines: ["Walks three miles to find a quiet creek.", "Carries too many lures and uses them all.", "Always up for a rematch."],
    skill: 0.6,
    water: 3,
    win: "Rematch? I have a new lure to try.",
    lose: "Okay, okay. You win this round.",
  },
  {
    id: "sam",
    name: "Silent Sam",
    emoji: "🤫",
    lines: ["Has not said a word in ten years.", "Never moves until the fish bites.", "Nobody has seen him use the same lure twice."],
    skill: 0.65,
    water: 2,
    win: "...",
    lose: "(A small, polite nod.)",
  },
  {
    id: "ro",
    name: "Big Ro",
    emoji: "🏋️",
    lines: ["Laughs loudly and casts even louder.", "Loves a heavy fish and a heavy lunch.", "Says every fish was the size of a canoe."],
    skill: 0.7,
    water: 5,
    win: "Ha ha! Did you see the size of that one?",
    lose: "Good one! Mine was bigger, but nobody saw it.",
  },
  {
    id: "wren",
    name: "Wren",
    emoji: "🐦",
    lines: ["Reads the weather from the birds.", "Fishes best in the rain.", "Tiny boat, big catches."],
    skill: 0.75,
    water: 4,
    win: "The birds told me it would go this way.",
    lose: "Nice. The birds are impressed.",
  },
  {
    id: "cobb",
    name: "Old Cobb",
    emoji: "🎣",
    lines: ["Has fished the same bend for fifty years.", "Grumbles about lures but uses the best ones.", "Knows where every fish sleeps."],
    skill: 0.8,
    water: 1,
    win: "Fifty years, kid. Fifty years.",
    lose: "Hmph. Not bad. Do not tell anyone I said that.",
  },
  {
    id: "ness",
    name: "Captain Ness",
    emoji: "⚓",
    lines: ["Runs the boat like a ship.", "Reads the tide before breakfast.", "Fair, firm and always on time."],
    skill: 0.85,
    water: 5,
    win: "Smooth water, steady hands. That is the secret.",
    lose: "Well fished, sailor. Fair winds.",
  },
  {
    id: "professor",
    name: "The Professor",
    emoji: "🔬",
    lines: ["Keeps notes on every single cast.", "Can tell you what a fish ate for lunch.", "Believes in science and very small hooks."],
    skill: 0.9,
    water: 10,
    win: "As my notes predicted. Fascinating!",
    lose: "Remarkable. I shall need to revise my notes.",
  },
  {
    id: "queen",
    name: "Pike Queen",
    emoji: "👑",
    lines: ["Has never lost a Derby on the Lake.", "Fast hands and a sharper smile.", "Everyone is a little scared of her."],
    skill: 0.95,
    water: 2,
    win: "Better luck next time, little minnow.",
    lose: "You beat the Queen. Take a bow. It will not happen twice.",
  },
];

export const RIVAL_COUNT = RIVALS.length;

const BY_ID = new Map(RIVALS.map((r) => [r.id, r]));
const BY_NAME = new Map(RIVALS.map((r) => [r.name, r]));

export function rivalById(id: string): Rival | undefined {
  return BY_ID.get(id);
}

/** The old random-walk Derby saved only a name; find who it was. */
export function rivalByName(name: string): Rival | undefined {
  return BY_NAME.get(name);
}

/* ── Casting ─────────────────────────────────────────────────────────────── */

/** What the Derby tells a rival about the water they fish: same sky and same fish as you. */
export type DerbyCtx = {
  /** The Derby's own seed. */
  seed: number;
  biome: number;
  /** Your luck when the Derby began: the rivals fish the same water at about your level. */
  luck: number;
  /** Your stage in this water (it caps which species can rise). */
  stage: number;
  weather: number;
  window: Window;
};

/** A cast takes a beginner about 26 seconds and an expert about 14, bite to net. */
export function castSeconds(skill: number): number {
  return 26 - 12 * skill;
}

/** How often a cast comes up empty: a beginner misses a third of them. */
export function missChance(skill: number): number {
  return (1 - skill) * 0.55;
}

/** An expert's luck is a bit better than yours; a beginner's a bit worse. */
export function rivalLuck(skill: number, playerLuck: number): number {
  return Math.max(2, playerLuck) * (0.35 + 0.75 * skill);
}

/** How many tries at picking a spot, a lure family, a depth and a pace; they keep the best. */
export function setupTries(skill: number): number {
  return 1 + Math.round(skill * 5);
}

/** An expert lands a few good bonuses (perfect hooks, streaks) the way you do. */
export function bonus(skill: number): number {
  return 1 + 0.25 * skill;
}

/** The value of this rival's k-th cast in this Derby (0 = the fish got away). Same inputs, same answer, always.
    The live `rng()` stream is not touched. */
export function rivalCast(r: Rival, ctx: DerbyCtx, k: number): number {
  const mine = makeRng(seedFrom("rival", r.id, ctx.seed, k));
  if (mine() < missChance(r.skill)) return 0;
  const spots = spotsOf(ctx.biome);
  let best: number[] | null = null;
  let bestScore = -1;
  for (let t = 0; t < setupTries(r.skill); t++) {
    const spot = spots[Math.min(spots.length - 1, Math.floor(mine() * spots.length))];
    const p = {
      family: FAMILIES[Math.min(FAMILIES.length - 1, Math.floor(mine() * FAMILIES.length))],
      depth: DEPTHS[Math.min(DEPTHS.length - 1, Math.floor(mine() * DEPTHS.length))],
      retrieve: RETRIEVES[Math.min(RETRIEVES.length - 1, Math.floor(mine() * RETRIEVES.length))],
    };
    const ms = matchVector(ctx.biome, spot, p, ctx.weather, ctx.window);
    /* A good setup is one where the likely fish are well matched: judge it by the best few species. */
    const score = [...ms].sort((a, b) => b - a).slice(0, 6).reduce((a, b) => a + b, 0);
    if (score > bestScore) {
      bestScore = score;
      best = ms;
    }
  }
  /* rollFish draws from the live stream, so lend it ours for this one cast and give it back. */
  const keep: Rng = rng;
  setRng(mine);
  try {
    const fish = rollFish(ctx.biome, rivalLuck(r.skill, ctx.luck), { stage: ctx.stage, match: best ?? undefined });
    return Math.round(fish.v * bonus(r.skill));
  } finally {
    setRng(keep);
  }
}

/** A rival in a Derby: what they have so far and how many casts that took. */
export type RivalRun = { id: string; s: number; k: number };

/** Catch a rival up to `elapsed` seconds into the Derby. Idempotent: ask twice, same answer. */
export function advanceRival(run: RivalRun, ctx: DerbyCtx, elapsed: number): RivalRun {
  const r = rivalById(run.id);
  if (!r) return run;
  const due = Math.max(0, Math.floor(elapsed / castSeconds(r.skill)));
  if (due <= run.k) return run;
  let s = run.s;
  for (let k = run.k; k < due; k++) s += rivalCast(r, ctx, k);
  return { id: run.id, s, k: due };
}

/** Pick `n` rivals for a Derby in this water. A rival's favourite water makes them three times as likely to show up. */
export function pickRivals(seed: number, biome: number, n = 3): Rival[] {
  const mine = makeRng(seedFrom("regulars", seed, biome));
  const pool = [...RIVALS];
  const out: Rival[] = [];
  while (out.length < n && pool.length) {
    const w = pool.map((r) => (r.water === biome ? 3 : 1));
    let x = mine() * w.reduce((a, b) => a + b, 0);
    let i = 0;
    for (; i < pool.length - 1; i++) {
      if (x < w[i]) break;
      x -= w[i];
    }
    out.push(pool[i]);
    pool.splice(i, 1);
  }
  return out;
}

/* ── Head to head ─────────────────────────────────────────────────────────── */

/** Lifetime results against each rival, from your side: `w` Derbies you won against them, `l` they won. */
export type RivalRecord = Record<string, { w: number; l: number }>;

export const MAX_RECORD = 9999;

export function readRivalRecord(v: unknown): RivalRecord {
  const out: RivalRecord = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [id, e] of Object.entries(v as object)) {
    if (!BY_ID.has(id) || !e || typeof e !== "object") continue;
    const row = e as Record<string, unknown>;
    const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.min(MAX_RECORD, Math.max(0, Math.round(x))) : 0);
    const w = n(row.w);
    const l = n(row.l);
    if (w || l) out[id] = { w, l };
  }
  return out;
}

/** File a finished Derby: you against each rival you fished. A tie goes to the rival (a tie is not a win). */
export function recordDerby(rec: RivalRecord, you: number, rivals: readonly { id: string; s: number }[]): RivalRecord {
  const out: RivalRecord = { ...rec };
  for (const r of rivals) {
    if (!BY_ID.has(r.id)) continue;
    const p = out[r.id] ?? { w: 0, l: 0 };
    out[r.id] = you > r.s ? { w: Math.min(MAX_RECORD, p.w + 1), l: p.l } : { w: p.w, l: Math.min(MAX_RECORD, p.l + 1) };
  }
  return out;
}

export function recordLine(rec: RivalRecord, id: string): string {
  const e = rec[id];
  if (!e) return "Not fished yet";
  return `You ${e.w}, them ${e.l}`;
}

/** The line to show when a Derby ends: the rival who finished best speaks (the winner if it was them, else the one you beat most). */
export function derbyEndLine(you: number, rivals: readonly { id: string; s: number }[]): string {
  const ranked = [...rivals].filter((r) => BY_ID.has(r.id)).sort((a, b) => b.s - a.s);
  const top = ranked[0];
  if (!top) return "";
  const r = BY_ID.get(top.id)!;
  return you > top.s ? `${r.name}: "${r.lose}"` : `${r.name}: "${r.win}"`;
}

/** A water's name for a rival's favourite, for the Regulars board. */
export function favouriteWater(r: Rival): string {
  return BIOMES[r.water]?.name ?? "anywhere";
}

/** The window a Derby fishes in, from the real clock. */
export function derbyWindow(hour: number, weather: number): Window {
  return windowOf(hour, weather);
}

/* ── The Derby itself ─────────────────────────────────────────────────────── */

export const DERBY_MS = 600_000;

/** A Derby in progress. Saved, so a reload carries on: the rivals catch up from `k` casts. */
export type DerbyRun = {
  endsAt: number;
  score: number;
  ctx: DerbyCtx;
  rivals: RivalRun[];
};

/** Start a Derby: three Regulars picked from the seed, none of them with a fish yet. */
export function newDerby(now: number, ctx: DerbyCtx): DerbyRun {
  return {
    endsAt: now + DERBY_MS,
    score: 0,
    ctx,
    rivals: pickRivals(ctx.seed, ctx.biome, 3).map((r) => ({ id: r.id, s: 0, k: 0 })),
  };
}

export const derbyElapsed = (d: Pick<DerbyRun, "endsAt">, now: number) =>
  Math.min(DERBY_MS / 1000, Math.max(0, (now - (d.endsAt - DERBY_MS)) / 1000));

/** Bring every rival up to date. Pure: the same Derby at the same moment always gives the same board. */
export function stepDerby(d: DerbyRun, now: number): DerbyRun {
  const elapsed = derbyElapsed(d, now);
  return { ...d, rivals: d.rivals.map((r) => advanceRival(r, d.ctx, elapsed)) };
}

/** Place of `score` among the rivals (1 = first). A tie goes to the rival. */
export function derbyRank(score: number, rivals: readonly { s: number }[]): number {
  return 1 + rivals.filter((r) => r.s >= score).length;
}

const WINDOW_IDS = ["dawn", "day", "dusk", "night"];

/** A Derby from untrusted save data. A v7 Derby (names and scores only) becomes a Regulars Derby that keeps its scores. */
export function readDerby(v: unknown, fallbackBiome: number, now: number = Date.now()): DerbyRun | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  if (!Array.isArray(d.rivals)) return null;
  const n = (x: unknown, max = 1e15) => (typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : 0);
  const endsAt = n(d.endsAt, 1e16);
  const score = n(d.score);
  const c = (d.ctx && typeof d.ctx === "object" ? d.ctx : null) as Record<string, unknown> | null;
  const seed = c ? Math.floor(n(c.seed, 4294967295)) : seedFrom("derby", endsAt);
  const biome = c ? Math.min(BIOMES.length - 1, Math.floor(n(c.biome, 99))) : fallbackBiome;
  const ctx: DerbyCtx = {
    seed,
    biome,
    luck: c ? n(c.luck, 1e6) : 20,
    stage: c ? Math.min(3, Math.floor(n(c.stage, 3))) : 3,
    weather: c ? Math.min(4, Math.floor(n(c.weather, 4))) : 0,
    window: c && WINDOW_IDS.includes(c.window as string) ? (c.window as Window) : "day",
  };
  const picked = pickRivals(seed, biome, 3);
  const rivals: RivalRun[] = [];
  for (const [i, raw] of d.rivals.slice(0, 4).entries()) {
    const row = (raw ?? {}) as Record<string, unknown>;
    const id =
      typeof row.id === "string" && BY_ID.has(row.id)
        ? row.id
        : (rivalByName(typeof row.n === "string" ? row.n : "")?.id ?? picked[i % picked.length].id);
    if (rivals.some((r) => r.id === id)) continue;
    const r = BY_ID.get(id)!;
    const k = typeof row.k === "number" ? Math.floor(n(row.k, 1e5)) : Math.floor(derbyElapsed({ endsAt }, now) / castSeconds(r.skill));
    rivals.push({ id, s: n(row.s), k });
  }
  return rivals.length ? { endsAt, score, ctx, rivals } : null;
}
