/* Story mode (docs/architecture/12 §4): a guided trip through the fifteen waters. Each water is a chapter with a few
   plain objectives and a boss at the end. Chapters are DATA; progress is DERIVED from the Story save's own fish book,
   so there are no counters to drift and an old save can never be stuck. Pure: no store, no browser. */

import { BIOMES, BOSS_INDEX, rarityOf, SPECIES_PER_BIOME } from "./content.ts";

export type Dex = Record<string, { c: number; w: number; m: number }>;

export type ObjectiveKind = "catch" | "kinds" | "rare" | "boss";
export type Objective = { id: string; kind: ObjectiveKind; goal: number; text: string; biome: number };

/** Where the player is in the story. `chapter` is the water being worked on (15 = the story is finished). */
export type StoryState = { chapter: number; rewarded: number[] };

export const freshStory = (): StoryState => ({ chapter: 0, rewarded: [] });
export const CHAPTERS = BIOMES.length;

/** One line to open each chapter and one to close it. Plain English, short sentences. */
const NARRATIVE: readonly { title: string; intro: string; outro: string }[] = [
  { title: "The Little Pond", intro: "Every angler starts somewhere. Grandpa left you his rod and a quiet pond.", outro: "The pond king is yours. Grandpa would be proud." },
  { title: "Down the River", intro: "The water runs fast here. Learn to read it and the trout will find you.", outro: "You tamed the river wraith. The lake is next." },
  { title: "The Still Lake", intro: "The lake is wide and deep. Something big sleeps below the boats.", outro: "The lake leviathan rests. The fog in the swamp is calling." },
  { title: "Into the Swamp", intro: "Roots, logs and mist. The swamp hides its fish well.", outro: "You found the swamp's secret. Time for tangled mangroves." },
  { title: "Mangrove Maze", intro: "Small fish hide in the roots. Be patient and quiet.", outro: "The maze gave up its biggest fish. The sea is close." },
  { title: "The Salty Coast", intro: "Waves, wind and big open water. Hold on tight.", outro: "A coast legend lands in your net. Now the dry canyon." },
  { title: "Canyon Runs", intro: "Red walls and a narrow river. Fish dash from rock to rock.", outro: "The canyon boss is beaten. A bright reef shimmers ahead." },
  { title: "The Bright Reef", intro: "Colour everywhere. Look for the fish that hide in plain sight.", outro: "The reef's guardian is yours. Kelp forests wait below." },
  { title: "The Kelp Forest", intro: "Tall green fronds sway in the current. Fish slip between them.", outro: "You caught the forest giant. Now the freezing north." },
  { title: "Arctic Cold", intro: "Cold, clear water by the ice. Bundle up and cast far.", outro: "The ice giant is no more. The deep sea is dark and quiet." },
  { title: "The Deep", intro: "Down here the light fades. Strange fish glow in the dark.", outro: "You beat the deep's biggest fish. A sunken city is next." },
  { title: "Sunken City", intro: "Old towers rest under the waves, full of fish who call them home.", outro: "The city's guardian is yours. Fire is next." },
  { title: "Volcano Waters", intro: "Hot water beside a rumbling mountain. Fish here fight hard.", outro: "You cooled the volcano's king. Now to the clouds." },
  { title: "Fishing in the Sky", intro: "You cast from the clouds. The wind carries your line far.", outro: "The sky titan fell for your lure. Only the stars are left." },
  { title: "The Astral Sea", intro: "The last sea, among the stars. One more boss, one last cast.", outro: "You did it. You have fished every water. You are a legend." },
];

export const chapterInfo = (i: number) => NARRATIVE[Math.min(NARRATIVE.length - 1, Math.max(0, i))];

/** The objectives of a chapter. They grow a little as you go, and the boss is always last. */
export function chapterObjectives(i: number): Objective[] {
  const b = Math.min(CHAPTERS - 1, Math.max(0, i));
  const water = BIOMES[b].name;
  const catchN = Math.min(12, 3 + Math.floor(b / 2) * 1);
  const kinds = Math.min(8, 3 + Math.floor(b / 2));
  const out: Objective[] = [
    { id: `c${b}-catch`, kind: "catch", goal: catchN, biome: b, text: `Catch ${catchN} fish in the ${water}` },
    { id: `c${b}-kinds`, kind: "kinds", goal: kinds, biome: b, text: `Find ${kinds} different kinds of fish in the ${water}` },
  ];
  if (b >= 2) out.push({ id: `c${b}-rare`, kind: "rare", goal: 1, biome: b, text: `Catch a rare or better fish in the ${water}` });
  out.push({ id: `c${b}-boss`, kind: "boss", goal: 1, biome: b, text: `Beat the boss: ${BIOMES[b].fish[BOSS_INDEX]}` });
  return out;
}

/** How far along an objective is, counted from the fish book alone. */
export function objectiveProgress(o: Objective, dex: Dex): number {
  let n = 0;
  let kinds = 0;
  let rare = 0;
  for (let i = 0; i < SPECIES_PER_BIOME; i++) {
    const e = dex[`${o.biome}-${i}`];
    if (!e?.c) continue;
    n += e.c;
    kinds += 1;
    if (i !== BOSS_INDEX && rarityOf(i) >= 2) rare += 1;
  }
  const boss = dex[`${o.biome}-${BOSS_INDEX}`]?.c ? 1 : 0;
  const value = o.kind === "catch" ? n : o.kind === "kinds" ? kinds - boss : o.kind === "rare" ? rare : boss;
  return Math.min(o.goal, value);
}

export type ObjectiveView = { id: string; text: string; prog: number; goal: number; done: boolean };

export function chapterView(i: number, dex: Dex): { objectives: ObjectiveView[]; done: boolean; fraction: number } {
  const objectives = chapterObjectives(i).map((o) => {
    const prog = objectiveProgress(o, dex);
    return { id: o.id, text: o.text, prog, goal: o.goal, done: prog >= o.goal };
  });
  const done = objectives.every((o) => o.done);
  const fraction = objectives.reduce((s, o) => s + o.prog / o.goal, 0) / objectives.length;
  return { objectives, done, fraction };
}

/* ── Rewards ─────────────────────────────────────────────────────────────── */

export type Reward = { coins: number; unlockWater: number | null; chum: number; lurePack: number | null; lines: string[] };

/** What finishing chapter `i` gives. Every number is here. */
export function chapterReward(i: number): Reward {
  const coins = Math.round(150 * (i + 1) ** 1.6);
  const unlockWater = i + 1 < CHAPTERS ? i + 1 : null;
  const chum = 1 + (i % 3 === 2 ? 1 : 0);
  const lurePack = i % 3 === 1 ? i * 3 : null;
  const lines = [`${coins} coins`];
  if (unlockWater !== null) lines.push(`${BIOMES[unlockWater].name} opens up`);
  lines.push(`${chum} Boss Chum for the next boss`);
  if (lurePack !== null) lines.push("A pack of 10 lures");
  return { coins, unlockWater, chum, lurePack, lines };
}

/** After a catch: finish every chapter whose objectives are all done. Rewards are paid once each. */
export function advanceStory(state: StoryState, dex: Dex): { state: StoryState; finished: number[] } {
  let chapter = state.chapter;
  const rewarded = [...state.rewarded];
  const finished: number[] = [];
  while (chapter < CHAPTERS && chapterView(chapter, dex).done) {
    if (!rewarded.includes(chapter)) {
      rewarded.push(chapter);
      finished.push(chapter);
    }
    chapter += 1;
  }
  return { state: { chapter, rewarded }, finished };
}

export const storyDone = (s: StoryState) => s.chapter >= CHAPTERS;

/** Untrusted save data → story state. */
export function readStory(v: unknown): StoryState {
  if (!v || typeof v !== "object" || Array.isArray(v)) return freshStory();
  const o = v as Record<string, unknown>;
  const n = typeof o.chapter === "number" && Number.isFinite(o.chapter) ? Math.round(o.chapter) : 0;
  const rewarded = Array.isArray(o.rewarded)
    ? [...new Set(o.rewarded.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < CHAPTERS))].sort((a, b) => a - b)
    : [];
  return { chapter: Math.min(CHAPTERS, Math.max(0, n)), rewarded };
}
