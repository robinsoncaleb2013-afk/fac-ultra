/* Kid Mode (docs/architecture/05 §4): a lens on top of any mode that allows Helping Hand,
   never a mode of its own. Pure helpers, so every row of the spec table is unit-tested. */

import type { ModeRules } from "./modes.ts";

/** Kid Mode only applies where the mode allows it. Tournaments say no, for fairness. */
export function kidActive(kid: boolean, rules: Pick<ModeRules, "assistAllowed">): boolean {
  return kid && rules.assistAllowed;
}

/** Helping Hand is on: you asked for it, or Kid Mode makes it so (where the mode allows it). */
export function assistOn(assist: boolean, kid: boolean, rules: Pick<ModeRules, "assistAllowed">): boolean {
  return rules.assistAllowed && (assist || kid);
}

/** Text goes up one step (text-sm becomes text-base …). Applied as a `data-kid` attribute on <html>. */
export const KID_TEXT_STEP = 1;

/** Seconds of quiet waiting before the pill offers a spot hint. The spec's 8 s → 5 s becomes 3 s → 1.9 s here,
    because the longest wait the game makes is about 5 s (see HINT_AFTER in match.ts). */
export const HINT_AFTER_KID = 1.9;

export function hintAfter(active: boolean, normal: number): number {
  return active ? Math.min(normal, HINT_AFTER_KID) : normal;
}

/** The glow never fades below this while Kid Mode is on, so the help is always visible. */
export const KID_HELP_FLOOR = 0.45;

/** Coaching lines never stop in Kid Mode. */
export function coachAlways(active: boolean, seen: number, limit: number): boolean {
  return active || seen < limit;
}

/** Rare and better ask "Are you sure?" before they are sold. */
export const SURE_RARITY = 2;

export type Sure = { kind: "sell"; rarity: number } | { kind: "sellMany"; topRarity: number } | { kind: "rebirth" };

export function needsSure(active: boolean, what: Sure): boolean {
  if (!active) return false;
  if (what.kind === "rebirth") return true;
  if (what.kind === "sell") return what.rarity >= SURE_RARITY;
  return what.topRarity >= SURE_RARITY;
}

/** Messages this long get a 🔊 button. */
export const LONG_MESSAGE = 40;
export const SPEECH_RATE = 0.95;

export function isLongMessage(text: string): boolean {
  return text.trim().length >= LONG_MESSAGE;
}

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const BIG = ["", "thousand", "million", "billion", "trillion", "quadrillion"];

function below1000(n: number): string {
  const out: string[] = [];
  if (n >= 100) {
    out.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    out.push(n % 10 ? `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}` : TENS[Math.floor(n / 10)]);
  } else if (n > 0) out.push(ONES[n]);
  return out.join(" ");
}

/** 1200 → "one thousand two hundred". Whole numbers up to the quadrillions. */
export function numberWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (!Number.isFinite(value)) return "too many to say";
  if (n >= 1e18) return "a gigantic pile";
  if (n === 0) return "zero";
  const parts: string[] = [];
  for (let i = 0; n > 0; i++) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(`${below1000(chunk)}${BIG[i] ? ` ${BIG[i]}` : ""}`);
    n = Math.floor(n / 1000);
  }
  return parts.join(" ");
}

/** The word form for money tooltips: $1.2K → "one thousand two hundred dollars". */
export function moneyWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n >= 1e18) return "a gigantic pile of dollars";
  return `${numberWords(n)} ${n === 1 ? "dollar" : "dollars"}`;
}
