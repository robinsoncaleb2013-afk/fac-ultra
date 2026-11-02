/* The long-play events: ONE data table (docs/architecture/11-events-and-mutations.md).
   Leaf file: it imports nothing, so content.ts can build the mutation list from it and events.ts can run on it
   without a cycle. Every number a designer might want to tune is here and nowhere else. */

export type EventKind = "xp" | "worth" | "both";

/** The six event rarities. Index 0 = Common ... 5 = Mythic. */
export type EventRarityDef = {
  id: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  name: string;
  /** Caleb's multiplier: XP and/or sale value of a mutated fish are times this. */
  mult: number;
  /** How long the event lasts once it starts, in real minutes. */
  minutes: number;
  /** Share of fish caught during the event that carry the mutation (not all fish). */
  fishShare: number;
  /** Chance that this event starts at an hourly roll when the player is eligible for it. */
  startChance: number;
  /** Text colour class (reuses the game's rarity tones where it can). */
  tone: string;
};

export const EVENT_RARITIES: readonly EventRarityDef[] = [
  { id: "common", name: "Common", mult: 2, minutes: 10, fishShare: 0.3, startChance: 0.35, tone: "text-r0" },
  { id: "uncommon", name: "Uncommon", mult: 3, minutes: 12, fishShare: 0.25, startChance: 0.3, tone: "text-r1" },
  { id: "rare", name: "Rare", mult: 5, minutes: 15, fishShare: 0.2, startChance: 0.25, tone: "text-r2" },
  { id: "epic", name: "Epic", mult: 10, minutes: 20, fishShare: 0.15, startChance: 0.2, tone: "text-r3" },
  { id: "legendary", name: "Legendary", mult: 15, minutes: 25, fishShare: 0.12, startChance: 0.15, tone: "text-r4" },
  { id: "mythic", name: "Mythic", mult: 60, minutes: 30, fishShare: 0.1, startChance: 0.25, tone: "text-brass" },
] as const;

export type EventDef = {
  id: string;
  name: string;
  /** Index into EVENT_RARITIES. */
  rarity: number;
  /** Hours of continuous play before this event can start. */
  hours: number;
  /** The mutation's name (the fish is called "<mutation> <species>"). */
  mutation: string;
  kind: EventKind;
  /** Only while it is night in the game (the time-of-day window is "night"). */
  night?: true;
  /** Only while fishing in the Astral Sea. */
  astral?: true;
  /** What the player sees when it starts (plain English). */
  announce: string;
  /** One line for the Events list. */
  blurb: string;
  /** Kid Mode shows these friendlier words for the three scarier names (everything else is already gentle). */
  kidName?: string;
  kidMutation?: string;
  /** How the mutated fish looks: hue, plus a shape that is drawn around it so colour is never the only clue. */
  look: { hue: number; sat: number; light: number; shape: MutationShape; glyph: string };
};

export type MutationShape = "star" | "shard" | "ring" | "flake" | "bolt" | "eye" | "cross" | "flame" | "sparkle" | "drop" | "crown";

/* Caleb's alternation: the first event of each pair is an XP boost, the second a worth (sale value) boost.
   He named it for the first four pairs; Snowfall (Chilly) follows the pattern as XP and Alien as worth; Mythic gives both. */
export const EVENTS: readonly EventDef[] = [
  {
    id: "shooting-stars", name: "Shooting Stars", rarity: 0, hours: 1, mutation: "Starlight", kind: "xp", night: true,
    announce: "Shooting stars are crossing the sky! Some fish are glowing with starlight.",
    blurb: "A night sky full of falling stars. Starlight fish give extra XP.",
    look: { hue: 52, sat: 90, light: 62, shape: "star", glyph: "★" },
  },
  {
    id: "meteor-collision", name: "Meteor Collision", rarity: 0, hours: 1, mutation: "Trembling", kind: "worth",
    announce: "A meteor crashed nearby! Some fish are trembling, and they are worth more.",
    blurb: "The ground shakes. Trembling fish sell for more.",
    look: { hue: 24, sat: 80, light: 52, shape: "bolt", glyph: "✵" },
  },
  {
    id: "blood-moon", name: "Blood Moon", rarity: 1, hours: 2, mutation: "Blood Red", kind: "xp",
    announce: "A blood moon is rising! Some fish have turned deep red and give extra XP.",
    blurb: "A red moon hangs overhead. Blood Red fish give extra XP.",
    kidName: "Ruby Moon", kidMutation: "Ruby Red",
    look: { hue: 355, sat: 78, light: 40, shape: "ring", glyph: "●" },
  },
  {
    id: "meteorite-strike", name: "Meteorite Strike", rarity: 1, hours: 2, mutation: "Stone Scales", kind: "worth",
    announce: "A meteorite hit the water! Some fish grew stone scales, and they are worth more.",
    blurb: "Space rock in the water. Stone Scales fish sell for more.",
    look: { hue: 215, sat: 10, light: 48, shape: "shard", glyph: "◆" },
  },
  {
    id: "snowfall", name: "Snowfall", rarity: 2, hours: 3, mutation: "Chilly", kind: "xp",
    announce: "Snow is falling! Some fish are chilly and give extra XP.",
    blurb: "Soft snow on the water. Chilly fish give extra XP.",
    look: { hue: 195, sat: 70, light: 78, shape: "flake", glyph: "❄" },
  },
  {
    id: "alien-invasion", name: "Alien Invasion", rarity: 2, hours: 3, mutation: "Alien", kind: "worth",
    announce: "Strange lights in the sky! Some fish have turned alien, and they are worth more.",
    blurb: "Visitors from far away. Alien fish sell for more.",
    look: { hue: 125, sat: 85, light: 52, shape: "eye", glyph: "◉" },
  },
  {
    id: "radioactive-rain", name: "Radioactive Rain", rarity: 3, hours: 4, mutation: "Radioactive", kind: "xp",
    announce: "Glowing rain is falling! Some fish are radioactive and give lots of extra XP.",
    blurb: "Green rain from the clouds. Radioactive fish give lots of extra XP.",
    look: { hue: 85, sat: 95, light: 50, shape: "cross", glyph: "☢" },
  },
  {
    id: "northern-lights", name: "Northern Lights", rarity: 3, hours: 4, mutation: "Mesmerized", kind: "worth", night: true,
    announce: "The northern lights are dancing! Some fish are mesmerized, and they are worth lots more.",
    blurb: "Ribbons of light at night. Mesmerized fish sell for lots more.",
    look: { hue: 165, sat: 80, light: 58, shape: "sparkle", glyph: "✨" },
  },
  {
    id: "divine-intervention", name: "Divine Intervention", rarity: 4, hours: 6, mutation: "Blessed", kind: "xp",
    announce: "A golden light shines down! Some fish are blessed and give huge extra XP.",
    blurb: "A beam of light from above. Blessed fish give huge extra XP.",
    look: { hue: 46, sat: 95, light: 72, shape: "crown", glyph: "✦" },
  },
  {
    id: "armageddon", name: "Armageddon", rarity: 4, hours: 6, mutation: "Cursed", kind: "worth",
    announce: "The sky is on fire! Some fish are cursed, and they are worth a huge amount more.",
    blurb: "A fiery sky. Cursed fish sell for a huge amount more.",
    kidName: "Fire Sky", kidMutation: "Moonshadow",
    look: { hue: 275, sat: 60, light: 30, shape: "flame", glyph: "☠" },
  },
  {
    id: "legend-of-the-fisherman", name: "Legend of the Fisherman", rarity: 5, hours: 10, mutation: "Fisherman's Dream", kind: "both", astral: true,
    announce: "The Legend of the Fisherman is alive tonight! Some fish are a Fisherman's Dream: huge XP and huge coins.",
    blurb: "A story told by the old anglers. Fisherman's Dream fish give huge XP and sell for huge coins.",
    look: { hue: 262, sat: 85, light: 66, shape: "drop", glyph: "❤" },
  },
] as const;

export const EVENT_IDS = EVENTS.map((e) => e.id);

/* Playing "straight" (all tunable). */
const MIN = 60_000;
export const HOUR_MS = 60 * MIN;
/** Time without a tap, key or cast after which the clock stops counting (the player may have wandered off with the tab open). */
export const IDLE_MS = 3 * MIN;
/** Time away (tab hidden, idle, or the game closed) after which the streak is gone. Shorter breaks pause it. */
export const AWAY_RESET_MS = 10 * MIN;
/** After an event ends, no new one can start for this long. */
export const COOLDOWN_MS = 30 * MIN;
