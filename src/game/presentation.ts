/* What is on the line and how it is fished (docs/architecture/04 §3.1).
   Pure data and helpers. A Presentation is the lure FAMILY (from whatever the
   player has equipped) plus the two things the player sets with the Rig
   control: how deep, and how fast to bring it back. */

import { BAITS, LURES, SIG_LURES } from "./content.ts";

export type LureFamily =
  | "worm"
  | "insect"
  | "minnow"
  | "crank"
  | "spoon"
  | "jig"
  | "fly"
  | "topwater"
  | "cut"
  | "dough"
  | "squid"
  | "glow";
export type Depth = 0 | 1 | 2;
export type Retrieve = "still" | "slow" | "medium" | "fast";
export type Window = "dawn" | "day" | "dusk" | "night";
export type Presentation = { family: LureFamily; depth: Depth; retrieve: Retrieve };
export type Rig = { depth: Depth; retrieve: Retrieve };

export const FAMILIES: readonly LureFamily[] = [
  "worm",
  "insect",
  "minnow",
  "crank",
  "spoon",
  "jig",
  "fly",
  "topwater",
  "cut",
  "dough",
  "squid",
  "glow",
];
export const RETRIEVES: readonly Retrieve[] = ["still", "slow", "medium", "fast"];
export const WINDOWS: readonly Window[] = ["dawn", "day", "dusk", "night"];
export const DEPTHS: readonly Depth[] = [0, 1, 2];

/** Kid-readable names. `plural` reads inside a sentence ("Likes plastic worms"). */
export const FAMILY_INFO: Record<LureFamily, { label: string; plural: string }> = {
  worm: { label: "Worm", plural: "plastic worms" },
  insect: { label: "Bug", plural: "bugs and grubs" },
  minnow: { label: "Minnow", plural: "minnow lures" },
  crank: { label: "Crankbait", plural: "crankbaits" },
  spoon: { label: "Spoon", plural: "spoons" },
  jig: { label: "Jig", plural: "jigs" },
  fly: { label: "Fly", plural: "flies" },
  topwater: { label: "Topwater", plural: "topwater lures" },
  cut: { label: "Cut bait", plural: "cut bait" },
  dough: { label: "Dough", plural: "dough balls" },
  squid: { label: "Squid", plural: "squid rigs" },
  glow: { label: "Glow", plural: "glowing baits" },
};

export const DEPTH_INFO: Record<Depth, { label: string; short: string; blurb: string }> = {
  0: { label: "Shallow", short: "shallow", blurb: "Near the top" },
  1: { label: "Middle", short: "mid-depth", blurb: "Halfway down" },
  2: { label: "Deep", short: "deep", blurb: "Near the bottom" },
};

export const RETRIEVE_INFO: Record<Retrieve, { label: string; adverb: string; blurb: string }> = {
  still: { label: "Still", adverb: "still", blurb: "Let it sit" },
  slow: { label: "Slow", adverb: "slow", blurb: "Creep it in" },
  medium: { label: "Medium", adverb: "medium-speed", blurb: "Steady pace" },
  fast: { label: "Fast", adverb: "fast", blurb: "Rip it back" },
};

export const WINDOW_INFO: Record<Window, { label: string }> = {
  dawn: { label: "Dawn" },
  day: { label: "Daytime" },
  dusk: { label: "Dusk" },
  night: { label: "Night" },
};

export const DEFAULT_RIG: Rig = { depth: 1, retrieve: "medium" };

/* ── Families for the gear the player already owns ─────────────────────────
   Procedural lures take the family of their TYPE (a "Rapala Crankbait" is a
   crank, a "Berkley Worm" is a worm). Baits and signature lures are listed by hand. */

export const LURE_TYPE_FAMILY: Record<string, LureFamily> = {
  Spinnerbait: "crank",
  Crankbait: "crank",
  Jig: "jig",
  Spoon: "spoon",
  Popper: "topwater",
  Swimbait: "minnow",
  Jerkbait: "minnow",
  Buzzbait: "topwater",
  Frog: "topwater",
  Worm: "worm",
  Grub: "insect",
  Plug: "crank",
  Topwater: "topwater",
  Fly: "fly",
  Softbait: "worm",
  Blade: "spoon",
  "Squid Rig": "squid",
};

/** Same order as BAITS: Dough Ball, Glow Worm, Chum Bucket, Boss Chum. */
export const BAIT_FAMILY: readonly LureFamily[] = ["dough", "glow", "cut", "cut"];

/** Same order as SIG_LURES. */
export const SIG_FAMILY: readonly LureFamily[] = [
  "worm", // Eel Whistle
  "cut", // Ray Charm
  "cut", // Shell Bell
  "cut", // Shark Tooth Rig
  "glow", // Whale Song Box
  "cut", // Crab Trap Charm
  "squid", // Squid Lantern
  "insect", // Seahorse Flute
  "glow", // Jelly Lantern
  "glow", // False Lantern
  "spoon", // Prism Spoon
  "spoon", // Star Spoon
  "spoon", // Gilded Spoon
  "spoon", // Ultra Spoon Ω
  "minnow", // Epic Decoy
  "minnow", // Royal Decoy
  "crank", // Storm Bell
  "fly", // Rain Drum
  "jig", // Fog Horn
  "insect", // Moth Lantern
  "worm", // Calm Bell
  "jig", // Deep Calm Bell
  "topwater", // Swift Bell
  "crank", // Hunter's Drum
];

export function familyOfLure(i: number): LureFamily | null {
  const name = LURES[i]?.name;
  if (!name) return null;
  for (const type of Object.keys(LURE_TYPE_FAMILY))
    if (name.endsWith(type)) return LURE_TYPE_FAMILY[type];
  return null;
}

/** Equipment that decides the family. Priority: bait (it is what the fish smell), then the
    signature lure, then the tackle-box lure; a bare hook carries a plain worm. */
export type Tackle = { lure: number; sig: number; bait: number };

export function familyOf(t: Tackle): LureFamily {
  if (t.bait >= 0 && BAIT_FAMILY[t.bait] && t.bait < BAITS.length) return BAIT_FAMILY[t.bait];
  if (t.sig >= 0 && t.sig < SIG_LURES.length) return SIG_FAMILY[t.sig];
  if (t.lure >= 0) return familyOfLure(t.lure) ?? "worm";
  return "worm";
}

export function presentationOf(t: Tackle, rig: Rig): Presentation {
  return { family: familyOf(t), depth: rig.depth, retrieve: rig.retrieve };
}

export function isDepth(v: unknown): v is Depth {
  return v === 0 || v === 1 || v === 2;
}
export function isRetrieve(v: unknown): v is Retrieve {
  return typeof v === "string" && (RETRIEVES as readonly string[]).includes(v);
}

/** A rig from untrusted data; anything off falls back field by field. */
export function readRig(v: unknown): Rig {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    depth: isDepth(o.depth) ? o.depth : DEFAULT_RIG.depth,
    retrieve: isRetrieve(o.retrieve) ? o.retrieve : DEFAULT_RIG.retrieve,
  };
}

/** "Middle · Slow" — the short form for buttons. */
export function rigLabel(rig: Rig): string {
  return `${DEPTH_INFO[rig.depth].label} · ${RETRIEVE_INFO[rig.retrieve].label}`;
}
