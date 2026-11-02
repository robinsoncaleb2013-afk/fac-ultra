/* Difficulty (docs/architecture/12 §2). Five levels for the career (Expedition), chosen once when a save slot
   is made. Every number lives in the ONE table below. Pure: no store, no browser, so each row is unit-tested.

   Difficulty only exists in Expedition and Story. Every other mode (Recreational, Survival, Co-op, Tournament)
   plays at "normal" whatever a save says, so a tournament replay and Recreational never move. */

import type { Mode } from "./modes.ts";

export const DIFFICULTIES = ["superEasy", "easy", "normal", "hard", "hardest"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const isDifficulty = (v: unknown): v is Difficulty => typeof v === "string" && (DIFFICULTIES as readonly string[]).includes(v);

/** How Helping Hand behaves: "on" cannot be turned off, "allowed" follows the Settings switch, "off" is not offered. */
export type AssistRule = "on" | "allowed" | "off";

/** How many of the Hardest-only dangers a level has (hazards.ts has the table). */
export type HazardLevel = "none" | "taste" | "full";

export type DifficultyRules = {
  id: Difficulty;
  title: string;
  /** One sentence for the picker (plain English; kids read it). */
  blurb: string;
  /** Times how hard the fish pulls (stacks with the mode's own number). */
  fightSpeed: number;
  /** Times the wait for a bite (a bigger number is a longer wait). */
  biteSpeed: number;
  /** Times what a fish sells for. Hardest pays least. */
  worth: number;
  /** Times the XP a catch gives. */
  xp: number;
  /** Times how fast a fish wears the line down (read by the engine through `wearMulFor` in lines.ts; docs/architecture/10 §1.5). */
  lineDrain: number;
  assist: AssistRule;
  /** Extra width of the green zone, in percent of the bar (a gentle forgiveness for the easiest level). */
  forgiveness: number;
  /** Fish caught here are written in the fish book. Super Easy fish go to the Kids book instead. */
  countsInBook: boolean;
  hazards: HazardLevel;
};

export const DIFFICULTY_TABLE: Record<Difficulty, DifficultyRules> = {
  superEasy: {
    id: "superEasy",
    title: "Super Easy",
    blurb: "Gentle fish, a helping hand and plenty of time. These fish do not go in your fish book.",
    fightSpeed: 0.85,
    biteSpeed: 0.85,
    worth: 1,
    xp: 1,
    lineDrain: 0.5,
    assist: "on",
    forgiveness: 3,
    countsInBook: false,
    hazards: "none",
  },
  easy: {
    id: "easy",
    title: "Easy",
    blurb: "A little friendlier than normal. Your fish count in the book.",
    fightSpeed: 0.93,
    biteSpeed: 0.93,
    worth: 1,
    xp: 1,
    lineDrain: 0.75,
    assist: "allowed",
    forgiveness: 1,
    countsInBook: true,
    hazards: "none",
  },
  normal: {
    id: "normal",
    title: "Normal",
    blurb: "The game as it was made.",
    fightSpeed: 1,
    biteSpeed: 1,
    worth: 1,
    xp: 1,
    lineDrain: 1,
    assist: "allowed",
    forgiveness: 0,
    countsInBook: true,
    hazards: "none",
  },
  hard: {
    id: "hard",
    title: "Hard",
    blurb: "Stronger fish and slower bites. A snapped line can now take your lure.",
    fightSpeed: 1.1,
    biteSpeed: 1.08,
    worth: 1,
    xp: 1.05,
    lineDrain: 1.25,
    assist: "allowed",
    forgiveness: 0,
    countsInBook: true,
    hazards: "taste",
  },
  hardest: {
    id: "hardest",
    title: "Legend",
    blurb: "Tough fish worth less money. You can lose rods, lures, your boat, your wallet and your fish. Nothing is safe.",
    fightSpeed: 1.2,
    biteSpeed: 1.15,
    worth: 0.75,
    xp: 1.15,
    lineDrain: 1.5,
    assist: "off",
    forgiveness: 0,
    countsInBook: true,
    hazards: "full",
  },
};

export const DIFFICULTY_LIST: readonly DifficultyRules[] = DIFFICULTIES.map((d) => DIFFICULTY_TABLE[d]);
export const DEFAULT_DIFFICULTY: Difficulty = "normal";

/** The levels belong to the career modes only. */
export const DIFFICULTY_MODES: readonly Mode[] = ["expedition", "story"];
export const hasDifficulty = (mode: Mode): boolean => DIFFICULTY_MODES.includes(mode);

/** Story is guided and friendly: it always plays at this level, whatever the save says. */
export const STORY_DIFFICULTY: Difficulty = "easy";

/** The level in force: the save's in Expedition, fixed in Story, "normal" everywhere else. */
export function effectiveDifficulty(mode: Mode, saved: Difficulty): Difficulty {
  if (mode === "story") return STORY_DIFFICULTY;
  return mode === "expedition" ? saved : "normal";
}

export const difficultyRules = (mode: Mode, saved: Difficulty): DifficultyRules => DIFFICULTY_TABLE[effectiveDifficulty(mode, saved)];

/* ── Which fish book a catch goes in (docs/architecture/12 §1) ─────────────── */

export type Book = "main" | "kids";

/** The modes whose own book can be set aside for Kid Mode. Survival keeps its own run book and Tournament has none. */
const KID_BOOK_MODES: readonly Mode[] = ["expedition", "story", "recreational", "coop"];

/** Kid Mode (the lens) and Super Easy write to the Kids book, never the mode's main book.
    The main book is the Expedition book in Expedition, the Relaxed Fishing book in Recreational, and so on. */
export function bookFor(mode: Mode, difficulty: Difficulty, kidLens: boolean): Book {
  if (kidLens && KID_BOOK_MODES.includes(mode)) return "kids";
  if (!DIFFICULTY_TABLE[effectiveDifficulty(mode, difficulty)].countsInBook) return "kids";
  return "main";
}

/** Light copy for the Kids book screen. */
export const KIDS_BOOK_LINE = "The Kids book keeps fish caught in Kid Mode and on Super Easy. They never go in your main fish book.";

/** The summary line on a save slot card. */
export function slotLine(d: Difficulty): string {
  return `${DIFFICULTY_TABLE[d].title} difficulty`;
}
