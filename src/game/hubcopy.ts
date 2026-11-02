/* The words on the pause menu (the Hub). Plain English for a stranger or a kid: short sentences, no internal names.
   Kept apart from the components so a test can check every line (hubcopy.test.ts). */

import { BIOMES, compact, BOATS, REELS, RODS } from "./content.ts";
import { healthOf } from "./lines.ts";

export type PlayMeta = {
  id: string;
  title: string;
  /** One sentence. */
  summary: string;
  facts: string[];
  /** Which painting to show (a water's id from content.ts). */
  art: string;
  /** Shown on the card in place of the Play button when it cannot be opened. */
  hint?: string;
};

export const PLAY_META: readonly PlayMeta[] = [
  {
    id: "expedition",
    title: "Expedition",
    summary: "Your big adventure: travel to fifteen waters, fill your fish book and beat every boss.",
    facts: ["Pick how hard it is, from Super Easy to Legend", "Three save slots", "Earn coins and buy better gear"],
    art: "river",
  },
  {
    id: "story",
    title: "Story",
    summary: "A guided adventure through the fifteen waters, with goals and a boss to beat in each one.",
    facts: ["Goals like catch three fish at the pond", "A boss at the end of every water", "Three save slots of its own"],
    art: "swamp",
  },
  {
    id: "recreational",
    title: "Relaxed Fishing",
    summary: "Relaxed fishing. Everything is unlocked and nothing here touches your career.",
    facts: ["Its own fish book, records and logbook", "Fish bite sooner and fights are gentler", "Keep a fish or let it go"],
    art: "lake",
  },
  {
    id: "survival",
    title: "Survival",
    summary: "You are alone with a fishing line. Catch food, keep warm and last as many days as you can.",
    facts: ["Catch, cook and rest", "Every run is a new story", "A little harder than the rest"],
    art: "arctic",
  },
  {
    id: "tournaments",
    title: "Tournaments",
    summary: "Fish against other players on the same water with the same rules. The leaderboard is checked, so it is fair.",
    facts: ["Short events you can join any time", "Win medals and trophies", "Bring friends or make a private event"],
    art: "coast",
  },
  {
    id: "kid",
    title: "Kid-Friendly Play",
    summary: "Bigger words, a helping hand and friendlier fishing for younger anglers.",
    facts: ["Easier fights with a glowing green", "Messages can be read out loud", "Fish go in their own Kids book"],
    art: "pond",
  },
  {
    id: "local",
    title: "Fish Together (one screen)",
    summary: "Two players, one screen. One reels and the other helps.",
    facts: ["Player 2 holds the J key", "You share one fish book", "Great for a grown-up and a kid"],
    art: "mangrove",
  },
  {
    id: "online",
    title: "Fish Together (online)",
    summary: "Make a room code, share it with a friend and fish the same water at the same time.",
    facts: ["Works over the internet", "See each other's boats", "No sign-in needed"],
    art: "swamp",
  },
  {
    id: "aquarium",
    title: "The Aquarium",
    summary: "Show off your best fish in a tank. They earn coins even while you are away.",
    facts: ["Build a bigger tank", "Pets and lights make it nicer", "Open it any time from the Lodge"],
    art: "reef",
  },
  {
    id: "derby",
    title: "Derby",
    summary: "Ten minutes against three rivals. The most valuable catch wins the prize.",
    facts: ["A quick race", "Meet the Regulars", "Win coins"],
    art: "canyon",
  },
  {
    id: "rush",
    title: "Boss Rush",
    summary: "Face every boss you have beaten, one after another, against the clock.",
    facts: ["For experts", "Big prizes", "Beat three bosses to unlock"],
    art: "volcano",
  },
];

/* Which book a screen is showing. Every mode keeps its own fish book, records and stickers (WP-11). */
export type BookMode = "expedition" | "recreational" | "survival" | "coop" | "tournament" | "story";
export const BOOK_TEXT: Record<BookMode, { name: string; line: string }> = {
  expedition: { name: "Expedition", line: "This is your Expedition book. Relaxed Fishing keeps a separate one." },
  recreational: { name: "Relaxed Fishing", line: "This is your Relaxed Fishing book. It is kept apart, so nothing here changes your Expedition." },
  survival: { name: "Survival", line: "This is your Survival book. It is kept on its own." },
  coop: { name: "Local Co-op", line: "This is your Co-op book. It is kept on its own." },
  tournament: { name: "Tournaments", line: "Events keep their own results." },
  story: { name: "Story", line: "This is your Story book. It is kept apart from Expedition." },
};
export const bookOf = (mode: BookMode) => BOOK_TEXT[mode];

export const playMeta = (id: string) => PLAY_META.find((m) => m.id === id);

/** One short line for each water, in the order of BIOMES. */
export const WATER_BLURB: readonly string[] = [
  "A quiet green pond. The friendliest place to start.",
  "A winding river with fast water and hungry fish.",
  "A wide lake. Calm on top, deep underneath.",
  "A foggy swamp full of roots, logs and strange fish.",
  "Tangled mangrove roots where small fish hide.",
  "A sunny coast with waves and big open water.",
  "A dry canyon river between tall red walls.",
  "A bright coral reef alive with colour.",
  "A tall forest of kelp swaying under the waves.",
  "Cold, clear water beside the ice.",
  "The deep, dark sea. Quiet, and a little spooky.",
  "A city sunk long ago, now home to fish.",
  "Hot water beside a rumbling volcano.",
  "Fishing from the clouds, high above the world.",
  "The last sea, among the stars.",
];

export const waterBlurb = (i: number) => WATER_BLURB[i] ?? "";

/* ── Gear: one friendly line and a few facts per kind ────────────────────── */

export type GearKindName = "rod" | "reel" | "line" | "boat";

export const GEAR_TEXT: Record<GearKindName, { title: string; one: string; noun: string }> = {
  rod: { title: "Rods", one: "A better rod gives you a wider green to land fish in, and more luck finding rare ones.", noun: "rod" },
  reel: { title: "Reels", one: "A smoother reel makes fish bite sooner and makes reeling steadier.", noun: "reel" },
  line: { title: "Lines", one: "Lines are found in packs and crafted from spares. Stronger line lasts longer against big fish.", noun: "line" },
  boat: { title: "Boats", one: "A better boat takes you to where the fish are. More luck and quicker bites.", noun: "boat" },
};

export function gearFacts(kind: GearKindName, i: number): string[] {
  switch (kind) {
    case "rod":
      return [`Green band ${RODS[i].zone}% wide`, `Luck ${compact(RODS[i].luck)}`];
    case "reel":
      return [`Bites come ${REELS[i].speed * 4}% sooner`, `Reeling ${REELS[i].speed * 7}% steadier`];
    case "line":
      return [`Health ${healthOf(i)}: fish wear it down as you fight`];
    case "boat":
      return [`Luck +${BOATS[i].luck}`, `Bites come ${i * 4}% sooner`];
  }
}

/** Every line a player can read on the Hub, for the plain-English test. */
export function allHubCopy(): string[] {
  const out: string[] = [];
  for (const m of PLAY_META) out.push(m.title, m.summary, ...m.facts, m.hint ?? "");
  for (const b of Object.values(BOOK_TEXT)) out.push(b.name, b.line);
  out.push(...WATER_BLURB);
  for (const k of Object.keys(GEAR_TEXT) as GearKindName[]) {
    out.push(GEAR_TEXT[k].one);
    out.push(...gearFacts(k, 0), ...gearFacts(k, 3));
  }
  return out.filter(Boolean);
}

/** Words that belong to the code, not to the player. They must never show on the Hub. */
export const JARGON = /\b(sim|tz|zone|zone%|json|api|uuid|sanitize|tier|gfx|localstorage|payload|hydrate)\b/i;

export const WATERS_COUNT = BIOMES.length;
