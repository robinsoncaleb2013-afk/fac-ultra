/* The mode framework (docs/architecture/05 §1).
   A mode is a save slot with its own rules. The rules live in ONE table so a new
   mode (Survival in WP-5, Tournament in WP-7) is data, not scattered `if`s.
   Pure: no React, no store, no browser, so every rule here is unit-tested. */

import { stageOf } from "./content.ts";

/** WP-5 added "survival", WP-7 added "tournament". */
export type Mode = "expedition" | "recreational" | "survival" | "coop" | "tournament";

export type HudItem = "money" | "level" | "weather" | "window" | "hunger" | "warmth" | "day" | "timer";

export type KeepRelease = "both" | "keepOnly" | "releaseOnly" | "eat";

export type ModeRules = {
  id: Mode;
  title: string;
  /** One line for the menu card (plain English; kids read it). */
  blurb: string;
  /** localStorage key of this mode's save slot. */
  saveKey: string;
  economy: boolean;
  contracts: boolean;
  bosses: boolean;
  rebirth: boolean;
  aquarium: boolean;
  /** Every water, rod, reel, line, boat, lure and bait is yours from the first cast. */
  allUnlocked: boolean;
  /** Helping Hand (and so Kid Mode) may be on. Tournaments say no, for fairness. */
  assistAllowed: boolean;
  /** Multiplies how hard the fish pulls (Recreational 0.75, Survival 1.15). */
  fightSpeed: number;
  /** Multiplies the wait for a bite (Recreational 0.8: they bite sooner). */
  biteSpeed: number;
  keepRelease: KeepRelease;
  /** Every mode keeps its own collection, records, stickers and Fish of the Day claim in its own save slot.
      Nothing is shared between modes (decided by the owner on 2026-11-02, docs/architecture/05 §3).
      The field stays so a test can pin it: a mode that ever says anything else breaks the build. */
  dexShared: "own";
  /** Every stage of every water, and each boss's Lair, is open from the first cast (no collection needed). */
  stagesOpen: boolean;
  hud: HudItem[];
  /* Beyond the 05 §1 table (decisions recorded in the WP-4 PR): */
  /** Each visit is a trip with a log (Recreational). */
  trips: boolean;
  /** P takes a picture of the water. */
  photo: boolean;
  /** A second angler shares the screen (J holds the reel). */
  twoPlayer: boolean;
  /** Survival (WP-5): hunger, warmth, a camp and a run with its own save. Only that row sets it. */
  survival?: true;
};

const WILD: HudItem[] = ["money", "level", "weather", "window"];

export const MODES: Record<Mode, ModeRules> = {
  expedition: {
    id: "expedition",
    title: "Expedition",
    blurb: "The career: earn money, buy gear, beat bosses, grow your collection.",
    saveKey: "fac-ultra",
    economy: true,
    contracts: true,
    bosses: true,
    rebirth: true,
    aquarium: true,
    allUnlocked: false,
    assistAllowed: true,
    fightSpeed: 1,
    biteSpeed: 1,
    keepRelease: "both",
    dexShared: "own",
    stagesOpen: false,
    hud: WILD,
    trips: false,
    photo: true,
    twoPlayer: false,
  },
  recreational: {
    id: "recreational",
    title: "Recreational",
    blurb: "Relaxed fishing. Everything is unlocked and nothing here touches your career. Keep a logbook.",
    /* The same slot the old Sandbox used, so those saves carry straight over. */
    saveKey: "fac-ultra-sandbox",
    economy: false,
    contracts: false,
    bosses: true,
    rebirth: false,
    aquarium: true,
    allUnlocked: true,
    assistAllowed: true,
    fightSpeed: 0.75,
    biteSpeed: 0.8,
    keepRelease: "both",
    dexShared: "own",
    stagesOpen: true,
    hud: ["level", "weather", "window"],
    trips: true,
    photo: true,
    twoPlayer: false,
  },
  survival: {
    id: "survival",
    title: "Survival",
    blurb: "Alone with a hand line. Catch food, keep warm, last as many days as you can.",
    saveKey: "fac-ultra-survival",
    economy: false,
    contracts: false,
    bosses: false,
    rebirth: false,
    aquarium: false,
    allUnlocked: false,
    assistAllowed: true,
    fightSpeed: 1.15,
    biteSpeed: 1,
    keepRelease: "eat",
    /* Survival keeps its own collection and never touches the career. */
    dexShared: "own",
    stagesOpen: false,
    hud: ["hunger", "warmth", "day", "weather"],
    trips: false,
    photo: true,
    twoPlayer: false,
    survival: true,
  },
  coop: {
    id: "coop",
    title: "Local Co-op",
    blurb: "Two anglers, one screen, one shared ledger. Player 2 helps with the reel (J).",
    saveKey: "fac-ultra-coop",
    economy: true,
    contracts: true,
    bosses: true,
    rebirth: true,
    aquarium: true,
    allUnlocked: false,
    assistAllowed: true,
    fightSpeed: 1,
    biteSpeed: 1,
    keepRelease: "both",
    dexShared: "own",
    stagesOpen: false,
    hud: WILD,
    trips: false,
    photo: true,
    twoPlayer: true,
  },
  /* WP-7 (06 §1.4, 05 §1): a server-scored event. Helping Hand is off and Kid Mode's play help with it (the
     reading and text features still work), the tackle is the same for everyone, the sky and the fish come from
     the event's seed, and nothing is sold. The slot is a throwaway: events keep their own record on the server. */
  tournament: {
    id: "tournament",
    title: "Tournaments",
    blurb: "Real events with a seed, a clock and a leaderboard the server checks. Same tackle for everyone.",
    saveKey: "fac-ultra-tourney",
    economy: false,
    contracts: false,
    bosses: false,
    rebirth: false,
    aquarium: false,
    allUnlocked: true,
    assistAllowed: false,
    fightSpeed: 1,
    biteSpeed: 1,
    keepRelease: "keepOnly",
    dexShared: "own",
    stagesOpen: false,
    hud: ["level", "weather", "window", "timer"],
    trips: false,
    photo: false,
    twoPlayer: false,
  },
};

export const MODE_LIST: readonly Mode[] = ["expedition", "recreational", "survival", "coop", "tournament"];

/** Is this the server-scored mode? (The rules table has no flag for it; the id is the flag.) */
export const isTournament = (r: Pick<ModeRules, "id">) => r.id === "tournament";

/** The only tabs an event shows: Cast (the event panel), the Dex and the Lodge (Settings). */
export const TOURNAMENT_TABS: readonly string[] = ["cast", "dex", "lodge"];

/** localStorage key per mode. */
export const MODE_KEYS: Record<Mode, string> = {
  expedition: MODES.expedition.saveKey,
  recreational: MODES.recreational.saveKey,
  survival: MODES.survival.saveKey,
  coop: MODES.coop.saveKey,
  tournament: MODES.tournament.saveKey,
};

export function isMode(v: unknown): v is Mode {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(MODES, v);
}

/** Old names (from before WP-4) and card ids → the mode they mean. */
export function legacyMode(v: unknown): Mode | null {
  if (isMode(v)) return v;
  if (v === "career") return "expedition";
  if (v === "sandbox") return "recreational";
  return null;
}

export function rulesOf(mode: Mode): ModeRules {
  return MODES[mode];
}

/* ── Rules applied ───────────────────────────────────────────────────────── */

export const canKeep = (r: ModeRules) => r.keepRelease !== "releaseOnly";
export const canRelease = (r: ModeRules) => r.keepRelease === "both" || r.keepRelease === "releaseOnly";

/** What something costs in this mode: nothing where there is no economy. */
export const priceIn = (r: ModeRules, price: number) => (r.economy ? price : 0);

export const showsMoney = (r: ModeRules) => r.hud.includes("money");

/** The stage (0 Shallows to 3 Boss Lair) of a water in this mode: wide open where the mode says so,
    otherwise earned from the collection of THIS mode's own save. */
export const stageIn = (r: Pick<ModeRules, "stagesOpen">, dex: Dex, biome: number) => (r.stagesOpen ? 3 : stageOf(dex, biome));

/** A collection: caught count, best weight and best mutation per species. Each mode's save holds its own. */
export type Dex = Record<string, { c: number; w: number; m: number }>;

/* ── The menu cards (05 §7) ──────────────────────────────────────────────── */

export type MenuCard = {
  id: string;
  title: string;
  blurb: string;
  /** The mode this card opens. */
  mode: Mode;
  /** Opens this Lodge view after switching (Aquarium, Crew, Derby). */
  view?: "tank" | "crew" | "derby";
  /** Needs this many bosses beaten first. */
  needsBosses?: number;
  /** Opens the event lobby over the menu instead of switching mode straight away. */
  lobby?: boolean;
};

/** Mode cards come straight from MODES; the other cards are things you do in the career. */
export const MENU_CARDS: MenuCard[] = [
  { id: "expedition", title: MODES.expedition.title, blurb: MODES.expedition.blurb, mode: "expedition" },
  { id: "recreational", title: MODES.recreational.title, blurb: MODES.recreational.blurb, mode: "recreational" },
  { id: "survival", title: MODES.survival.title, blurb: MODES.survival.blurb, mode: "survival" },
  {
    id: "tournaments",
    title: MODES.tournament.title,
    blurb: MODES.tournament.blurb,
    mode: "tournament",
    lobby: true,
  },
  { id: "local", title: MODES.coop.title, blurb: MODES.coop.blurb, mode: "coop" },
  {
    id: "online",
    title: "Online Co-op",
    blurb: "Fish with friends over the internet. Share a room code, share the water.",
    mode: "expedition",
    view: "crew",
  },
  {
    id: "aquarium",
    title: "The Aquarium",
    blurb: "Show off your best fish. They earn money while you sleep.",
    mode: "expedition",
    view: "tank",
  },
  {
    id: "derby",
    title: "Derby",
    blurb: "Ten minutes, three rivals, most value wins the prize.",
    mode: "expedition",
    view: "derby",
  },
  {
    id: "rush",
    title: "Boss Rush",
    blurb: "Every boss you beat, back to back, against the clock.",
    mode: "expedition",
    view: "derby",
    needsBosses: 3,
  },
];

/** The card you played last goes first (phone menu). Unknown or old ids are ignored. */
export function orderCards(cards: readonly MenuCard[], last: string | null): MenuCard[] {
  const id = last === "sandbox" ? "recreational" : last;
  const i = cards.findIndex((c) => c.id === id);
  if (i <= 0) return [...cards];
  return [cards[i], ...cards.slice(0, i), ...cards.slice(i + 1)];
}
