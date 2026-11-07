/* Achievements (docs/architecture/12 §6). A table of plain-English goals. Each one watches either a number the game
   already knows (`stat`) or a counter by name (`counter`). Counters are how outside systems report things: the
   Events work (WP-15) can call `bumpCounter(state, "event:meteor")` or fire the `fac:achievement` window event
   without this file knowing anything about events, and `registerAchievements` lets it add its own rows.

   Achievements belong to a save slot (and so to its mode). Tournaments give none; Tournament trophies are the
   medals that already exist. Pure: no store, no browser. */

import type { Mode } from "./modes.ts";

export type AchCategory = "fishing" | "collection" | "gear" | "money" | "bosses" | "events" | "modes";

export const CATEGORY_NAMES: Record<AchCategory, string> = {
  fishing: "Fishing",
  collection: "Collection",
  gear: "Gear",
  money: "Money",
  bosses: "Bosses",
  events: "Events and mutations",
  modes: "Ways to play",
};

/** Numbers the game computes from the save and hands in. Add a field here, then use it in a row. */
export type AchStats = {
  caught: number;
  species: number;
  bosses: number;
  level: number;
  money: number;
  earned: number;
  rebirths: number;
  perfects: number;
  bestStreak: number;
  rod: number;
  reel: number;
  line: number;
  boat: number;
  exhibits: number;
  released: number;
  stewards: number;
  epics: number;
  records: number;
  tripsDone: number;
  derbiesWon: number;
  chapters: number;
  kidsSpecies: number;
  mutated: number;
  stickers: number;
  trophies: number;
};

export const noStats = (): AchStats => ({
  caught: 0, species: 0, bosses: 0, level: 1, money: 0, earned: 0, rebirths: 0, perfects: 0, bestStreak: 0, rod: 0, reel: 0, line: 0,
  boat: 0, exhibits: 0, released: 0, stewards: 0, epics: 0, records: 0, tripsDone: 0, derbiesWon: 0, chapters: 0, kidsSpecies: 0,
  mutated: 0, stickers: 0, trophies: 0,
});

export type AchDef = {
  id: string;
  name: string;
  text: string;
  cat: AchCategory;
  goal: number;
  /** A number from the stats… */
  stat?: (s: AchStats) => number;
  /** …or a named counter someone else bumps. */
  counter?: string;
  /** Which modes can earn it (default: all but Tournament and Survival). */
  modes?: readonly Mode[];
};

const CAREER: readonly Mode[] = ["expedition", "story", "coop"];
const ANY: readonly Mode[] = ["expedition", "story", "recreational", "coop"];

const ladder = (idPrefix: string, cat: AchCategory, names: string[], goals: number[], stat: (s: AchStats) => number, text: (g: number) => string, modes?: readonly Mode[]): AchDef[] =>
  goals.map((goal, i) => ({ id: `${idPrefix}-${goal}`, name: names[i], text: text(goal), cat, goal, stat, modes }));

export const ACHIEVEMENTS: readonly AchDef[] = [
  ...ladder("catch", "fishing", ["First Catch", "Getting Hooked", "Steady Hands", "Fish Whisperer", "A Thousand Casts"], [1, 25, 100, 500, 1000], (s) => s.caught, (g) => (g === 1 ? "Land your first fish." : `Land ${g} fish.`)),
  { id: "perfect-10", name: "Sharp Eyes", text: "Set the hook perfectly 10 times.", cat: "fishing", goal: 10, stat: (s) => s.perfects },
  { id: "perfect-100", name: "Never Misses", text: "Set the hook perfectly 100 times.", cat: "fishing", goal: 100, stat: (s) => s.perfects },
  { id: "streak-10", name: "On a Roll", text: "Land 10 fish in a row.", cat: "fishing", goal: 10, stat: (s) => s.bestStreak },
  { id: "streak-30", name: "Unstoppable", text: "Land 30 fish in a row.", cat: "fishing", goal: 30, stat: (s) => s.bestStreak },
  { id: "let-go-10", name: "Gentle Hands", text: "Let 10 fish go.", cat: "fishing", goal: 10, stat: (s) => s.released, modes: ANY },
  { id: "steward-1", name: "Friend of the Fish", text: "Become a Steward of one kind of fish.", cat: "fishing", goal: 1, stat: (s) => s.stewards, modes: ANY },
  ...ladder("kinds", "collection", ["Curious Angler", "Collector", "Book Worm", "Half the Sea", "Ocean Master", "Every Fish"], [10, 50, 125, 188, 375, 500], (s) => s.species, (g) => `Find ${g} different kinds of fish.`, ANY),
  { id: "epic-1", name: "Epic Find", text: "Catch an epic or better fish.", cat: "collection", goal: 1, stat: (s) => s.epics, modes: ANY },
  { id: "epic-25", name: "Epic Hunter", text: "Find 25 different epic or better fish.", cat: "collection", goal: 25, stat: (s) => s.epics, modes: ANY },
  { id: "pb-10", name: "Personal Bests", text: "Set 10 personal best fish.", cat: "collection", goal: 10, stat: (s) => s.records, modes: ANY },
  { id: "pb-50", name: "Trophy Wall", text: "Set 50 personal best fish.", cat: "collection", goal: 50, stat: (s) => s.records, modes: ANY },
  { id: "sticker-5", name: "Sticker Fan", text: "Collect 5 stickers.", cat: "collection", goal: 5, stat: (s) => s.stickers, modes: ANY },
  { id: "kids-10", name: "Little Explorer", text: "Find 10 kinds of fish for the Kids book.", cat: "collection", goal: 10, stat: (s) => s.kidsSpecies, modes: ANY },
  { id: "rod-5", name: "Better Rod", text: "Own your fifth rod.", cat: "gear", goal: 5, stat: (s) => s.rod + 1, modes: CAREER },
  { id: "rod-15", name: "Rod Master", text: "Own your fifteenth rod.", cat: "gear", goal: 15, stat: (s) => s.rod + 1, modes: CAREER },
  { id: "reel-5", name: "Smooth Reeling", text: "Own your fifth reel.", cat: "gear", goal: 5, stat: (s) => s.reel + 1, modes: CAREER },
  { id: "line-5", name: "Strong Line", text: "Own your fifth line.", cat: "gear", goal: 5, stat: (s) => s.line + 1, modes: CAREER },
  { id: "boat-3", name: "Off the Shore", text: "Own your third boat.", cat: "gear", goal: 3, stat: (s) => s.boat + 1, modes: CAREER },
  { id: "tank-6", name: "Fish Tank", text: "Put 6 fish in your Aquarium.", cat: "gear", goal: 6, stat: (s) => s.exhibits, modes: CAREER },
  { id: "earn-1k", name: "Pocket Money", text: "Earn 1,000 coins in total.", cat: "money", goal: 1000, stat: (s) => s.earned, modes: CAREER },
  { id: "earn-100k", name: "Big Spender", text: "Earn 100,000 coins in total.", cat: "money", goal: 100_000, stat: (s) => s.earned, modes: CAREER },
  { id: "earn-10m", name: "Fish Tycoon", text: "Earn 10,000,000 coins in total.", cat: "money", goal: 10_000_000, stat: (s) => s.earned, modes: CAREER },
  { id: "rebirth-1", name: "Fresh Start", text: "Start over once with a rebirth.", cat: "money", goal: 1, stat: (s) => s.rebirths, modes: CAREER },
  { id: "level-10", name: "Level 10", text: "Reach level 10.", cat: "money", goal: 10, stat: (s) => s.level },
  { id: "level-30", name: "Level 30", text: "Reach level 30.", cat: "money", goal: 30, stat: (s) => s.level },
  { id: "boss-1", name: "Big Fish Down", text: "Beat your first boss.", cat: "bosses", goal: 1, stat: (s) => s.bosses },
  { id: "boss-5", name: "Boss Breaker", text: "Beat 5 bosses.", cat: "bosses", goal: 5, stat: (s) => s.bosses },
  { id: "boss-15", name: "King of the Waters", text: "Beat all 15 bosses.", cat: "bosses", goal: 15, stat: (s) => s.bosses },
  { id: "derby-1", name: "Derby Winner", text: "Win a derby.", cat: "bosses", goal: 1, stat: (s) => s.derbiesWon, modes: CAREER },
  { id: "mutant-1", name: "Odd One Out", text: "Catch a fish with a mutation.", cat: "events", goal: 1, stat: (s) => s.mutated },
  { id: "mutant-25", name: "Mutant Hunter", text: "Catch 25 fish with a mutation.", cat: "events", goal: 25, stat: (s) => s.mutated },
  { id: "event-1", name: "Right Place, Right Time", text: "Catch a fish during a special event.", cat: "events", goal: 1, counter: "event:caught" },
  { id: "event-25", name: "Event Chaser", text: "Catch 25 fish during special events.", cat: "events", goal: 25, counter: "event:caught" },
  { id: "event-seen-1", name: "Look Up!", text: "See a special event begin.", cat: "events", goal: 1, counter: "event:started" },
  { id: "event-seen-10", name: "Event Watcher", text: "See 10 special events begin.", cat: "events", goal: 10, counter: "event:started" },
  { id: "story-1", name: "Chapter One", text: "Finish a chapter of the Story.", cat: "modes", goal: 1, stat: (s) => s.chapters, modes: ["story"] },
  { id: "story-8", name: "Halfway There", text: "Finish 8 chapters of the Story.", cat: "modes", goal: 8, stat: (s) => s.chapters, modes: ["story"] },
  { id: "story-15", name: "Story Complete", text: "Finish the whole Story.", cat: "modes", goal: 15, stat: (s) => s.chapters, modes: ["story"] },
  { id: "trip-1", name: "Day Out", text: "Finish a Relaxed Fishing trip.", cat: "modes", goal: 1, stat: (s) => s.tripsDone, modes: ["recreational"] },
  { id: "trip-10", name: "Regular Visitor", text: "Finish 10 Relaxed Fishing trips.", cat: "modes", goal: 10, stat: (s) => s.tripsDone, modes: ["recreational"] },
  { id: "trophy-1", name: "On the Podium", text: "Win a tournament medal.", cat: "modes", goal: 1, stat: (s) => s.trophies, modes: CAREER },
];

/* Rows other systems add (WP-15 events and mutations). Same shape as above. Safe to call twice with the same ids. */
const EXTRA: AchDef[] = [];

/** Add achievements from another part of the game. Ids that already exist are ignored. */
export function registerAchievements(defs: readonly AchDef[]): void {
  for (const d of defs) {
    if (!d.id || EXTRA.some((x) => x.id === d.id) || ACHIEVEMENTS.some((x) => x.id === d.id)) continue;
    EXTRA.push(d);
  }
}

export const allAchievements = (): readonly AchDef[] => (EXTRA.length ? [...ACHIEVEMENTS, ...EXTRA] : ACHIEVEMENTS);

/** Tournaments and Survival give none (Survival has its own save shape that holds no achievements). */
export const achievementsOn = (mode: Mode): boolean => mode !== "tournament" && mode !== "survival";

export const earnableIn = (d: AchDef, mode: Mode): boolean => achievementsOn(mode) && (d.modes ?? ANY).includes(mode);

/* ── State: what you have and the counters ───────────────────────────────── */

export type AchState = { got: Record<string, number>; n: Record<string, number> };
export const freshAch = (): AchState => ({ got: {}, n: {} });

const ID = /^[a-z0-9:_-]{1,40}$/;

/** Untrusted save data → achievement state. */
export function readAch(v: unknown): AchState {
  const out = freshAch();
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  const o = v as Record<string, unknown>;
  for (const [src, dst, max] of [[o.got, out.got, 1e15], [o.n, out.n, 1e12]] as const) {
    if (!src || typeof src !== "object" || Array.isArray(src)) continue;
    for (const [k, val] of Object.entries(src as object).slice(0, 400)) {
      if (!ID.test(k) || typeof val !== "number" || !Number.isFinite(val) || val < 0) continue;
      dst[k] = Math.min(max, Math.round(val));
    }
  }
  return out;
}

/** Add to a named counter. */
export function bumpCounter(state: AchState, name: string, by = 1): AchState {
  if (!ID.test(name) || !Number.isFinite(by) || by <= 0) return state;
  return { ...state, n: { ...state.n, [name]: Math.min(1e12, (state.n[name] ?? 0) + Math.round(by)) } };
}

export function valueOf(d: AchDef, stats: AchStats, state: AchState): number {
  return d.stat ? d.stat(stats) : d.counter ? (state.n[d.counter] ?? 0) : 0;
}

export type AchView = { def: AchDef; value: number; done: boolean; at: number };

export function achievementViews(mode: Mode, stats: AchStats, state: AchState): AchView[] {
  return allAchievements()
    .filter((d) => earnableIn(d, mode))
    .map((def) => ({ def, value: Math.min(def.goal, valueOf(def, stats, state)), done: !!state.got[def.id], at: state.got[def.id] ?? 0 }));
}

/** Unlock everything that is now earned. Returns the new state and what unlocked this time (for toasts). */
export function checkAchievements(mode: Mode, stats: AchStats, state: AchState, now: number): { state: AchState; unlocked: AchDef[] } {
  if (!achievementsOn(mode)) return { state, unlocked: [] };
  const unlocked: AchDef[] = [];
  let got = state.got;
  for (const d of allAchievements()) {
    if (got[d.id] || !earnableIn(d, mode)) continue;
    if (valueOf(d, stats, state) >= d.goal) {
      if (got === state.got) got = { ...state.got };
      got[d.id] = now;
      unlocked.push(d);
    }
  }
  return unlocked.length ? { state: { ...state, got }, unlocked } : { state, unlocked };
}

export function summaryOf(mode: Mode, stats: AchStats, state: AchState): { done: number; total: number } {
  const v = achievementViews(mode, stats, state);
  return { done: v.filter((x) => x.done).length, total: v.length };
}
