/* Kid-safe names (docs/architecture/06 §3, WP-8 anti-abuse).

   Names are the only free text in the multiplayer layer: boards, teams and friends show them.
   This file decides whether a name may be shown. It is deliberately simple and a little strict:
   a name that trips it falls back to "Angler ABCD" rather than being refused loudly, so a kid is
   never told which word was wrong. Pure; the server runs it on every name it stores, and the
   client runs it first so the box can say "try another name" before anything is sent.

   Three kinds of check:
   - rude words (long ones anywhere in the name once look-alike letters are undone, short ones only
     as whole words so "Bass" and "Assist" stay fine, which matters in a fishing game),
   - contact details (web addresses, long digit runs) so nobody hands out where to find them,
   - nothing left once the odd characters are stripped. */

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "!": "i", "|": "i", "+": "t" };

/** Lower-case, accents off, look-alike digits and symbols turned back into letters. */
export function unleet(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[0134578@$!|+]/g, (c) => LEET[c] ?? c);
}

/** Only the letters, so "f.u c-k" and "fuuuck" cannot hide a word. Runs of one letter shrink to two. */
export function squash(text: string): string {
  return unleet(text)
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");
}

/** Words that are rude wherever they sit in the name (long enough that they rarely appear by accident). */
const ANYWHERE = [
  "fuck", "fuk", "shit", "bitch", "bastard", "cunt", "whore", "slut", "nigg", "fagg", "retard", "pussy", "dildo", "penis",
  "vagina", "blowjob", "handjob", "rapist", "hitler", "molest", "porn", "twat", "jizz", "tranny",
];

/** Words that are rude only as a whole word (they sit inside harmless ones: bass, class, assist, peacock, cucumber). */
const WHOLE = [
  "ass", "arse", "damn", "hell", "piss", "crap", "dick", "tit", "tits", "sex", "sexy", "nude", "naked", "rape", "kill",
  "coon", "fag", "dumb", "idiot", "stupid", "poop", "loser", "suck", "sucks", "cock", "cum", "anal", "boob", "boobs",
  "homo", "nazi", "pedo", "wank", "orgy", "kike", "chink", "spic", "gook", "paki", "dyke",
];

const once = (t: string) => t.replace(/(.)\1+/g, "$1");
/** The long bad words with doubled letters folded ("fuuuck" and "fuck" meet), when that leaves a word long enough to be safe. */
const FOLDED = ANYWHERE.map(once).filter((w) => w.length >= 4);

function words(text: string): string[] {
  return unleet(text)
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** True if the name has a rude word, a web address or a phone number in it. */
export function isRude(text: string): boolean {
  /* Contact details: addresses and long numbers. */
  if (/(https?:|www\.|\.(com|net|org|io|gg|me|tv|xyz|co|us|uk|app)\b)/i.test(text)) return true;
  if (/\d{5,}/.test(text.replace(/[\s.\-_()]/g, ""))) return true;
  if (/[a-z0-9]@[a-z0-9]/i.test(text)) return true;

  const flat = squash(text);
  for (const bad of ANYWHERE) if (flat.includes(bad)) return true;
  const folded = once(flat);
  for (const bad of FOLDED) if (folded.includes(bad)) return true;
  for (const w of words(text)) {
    const stem = w.replace(/(s|es|ed|ing|er|y)$/, "");
    if (WHOLE.includes(w) || WHOLE.includes(stem)) return true;
  }
  /* Letters spread out with spaces or dots ("a s s") are still one short word. */
  if (flat.length <= 5 && WHOLE.includes(flat)) return true;
  return false;
}

/** A name from untrusted text: letters, numbers, spaces and a little punctuation, 2 to 20 characters,
    and nothing rude or private. Returns `fallback` when nothing safe is left. */
export function safeName(v: unknown, fallback: string): string {
  const raw = typeof v === "string" ? v : "";
  const name = raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} _.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20)
    .trim();
  if (name.length < 2) return fallback;
  return isRude(name) || isRude(raw.slice(0, 40)) ? fallback : name;
}

/** Plain-English reason a typed name will not be used, or null if it is fine. Used by the name box. */
export function nameProblem(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (t.length < 2) return "Names need at least two letters.";
  return safeName(t, "") === "" ? "Try a different name. Keep it friendly and don't share contact details." : null;
}
