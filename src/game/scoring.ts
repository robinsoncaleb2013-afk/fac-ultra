/* How a tournament entry is scored (docs/architecture/06 §2.1).

   Scores are computed from VERIFIED catches only: the server replays every cast and
   hands this file the ones that landed. Pure, so the server, the client's live tally
   and the tests all use the same arithmetic. */

export type Category = "big" | "total" | "sprint" | "value" | "survival";

export const CATEGORIES: readonly Category[] = ["big", "total", "sprint", "value", "survival"];

export const CATEGORY_INFO: Record<Category, { name: string; blurb: string; unit: string }> = {
  big: { name: "Big Fish", blurb: "The heaviest single fish wins.", unit: "lb" },
  total: { name: "Total Weight", blurb: "Add up every fish you land.", unit: "lb" },
  sprint: { name: "Species Sprint", blurb: "The most different kinds of fish.", unit: "kinds" },
  value: { name: "Fish Value", blurb: "The fish that are worth the most, rare and strange ones included.", unit: "pts" },
  survival: { name: "Survival", blurb: "The most days survived on today's seed.", unit: "days" },
};

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

/** One verified landed fish. */
export type Landed = {
  /** Which cast of the entry it came from (the order of play). */
  castIndex: number;
  /** Species slot in the water. */
  species: number;
  weight: number;
  value: number;
};

export type Score = {
  /** The number the board sorts by, highest first. */
  score: number;
  /** Breaks ties, highest first. */
  tiebreak: number;
  /** Heaviest fish landed. */
  best: number;
  /** Distinct species landed. */
  kinds: number;
  /** Fish landed. */
  fish: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Score an entry. Big Fish: heaviest (then second heaviest). Total: sum of weights (then fish count).
    Sprint: distinct species (then who got the last new one soonest). Value: sum of values (then heaviest).
    Survival is scored by its own board, not from casts, and is 0 here. */
export function scoreEntry(category: Category, landed: readonly Landed[]): Score {
  const weights = landed.map((l) => l.weight).sort((a, b) => b - a);
  const best = weights[0] ?? 0;
  const seen = new Set<number>();
  let lastNew = 0;
  for (const l of [...landed].sort((a, b) => a.castIndex - b.castIndex)) {
    if (!seen.has(l.species)) {
      seen.add(l.species);
      lastNew = l.castIndex;
    }
  }
  const base = { best, kinds: seen.size, fish: landed.length };
  switch (category) {
    case "big":
      return { ...base, score: best, tiebreak: weights[1] ?? 0 };
    case "total":
      return { ...base, score: r1(weights.reduce((a, b) => a + b, 0)), tiebreak: landed.length };
    case "sprint":
      return { ...base, score: seen.size, tiebreak: seen.size ? -lastNew : 0 };
    case "value":
      return { ...base, score: Math.round(landed.reduce((a, l) => a + l.value, 0)), tiebreak: best };
    default:
      return { ...base, score: 0, tiebreak: 0 };
  }
}

/** The score as a short phrase for a board row. */
export function scoreLabel(category: Category, score: number): string {
  switch (category) {
    case "big":
    case "total":
      return `${score.toFixed(1)} lb`;
    case "sprint":
      return `${score} kinds`;
    case "value":
      return `${Math.round(score).toLocaleString("en-US")} pts`;
    default:
      return `${score} days`;
  }
}
