import { create } from "zustand";
import { loose, makeRng, rng, seedFrom, setRng } from "@/game/rng";
import { habitOf, type FightStyle } from "@/game/habits";
import { hintForCast, HINT_AFTER, missNote, planCast, windowNow, type CastPlan } from "@/game/match";
import {
  DEFAULT_RIG,
  isDepth,
  isRetrieve,
  presentationOf,
  readRig,
  type Presentation,
  type Rig,
  type Window,
} from "@/game/presentation";
import { defaultSpot, resolveSpot, spotById, type Spot } from "@/game/spots";
import { audio } from "@/game/audio";
import { clampVolume, DEFAULT_VOLUME } from "@/game/ambience";
import { addClaim, claimsFotd, FOTD_XP_MULT, fotdFor, today } from "@/game/fotd";
import { funModeOn, readFun } from "@/game/fun";
import {
  activeEvent,
  applyEventsToFish,
  catchLine,
  countLanded,
  eventById,
  eventModeOn,
  eventOfMutation,
  eventTitle,
  noEvents,
  readEvents,
  stepEvents,
  type EventsSave,
} from "@/game/events";
import { burstDue, holidayOn } from "@/game/holidays";
import { redeemCode } from "@/game/promo";
import { nightProgress, settleNight, startNight, type NightReport } from "@/game/night";
import { canUnlockFinalBiome, doPrestige, finalBiomeIndex } from "@/game/prestige";
import {
  advance as tutAdvance,
  currentStep as tutStep,
  isTutorialDone,
  shouldForceFirstCatch,
  startTutorial,
  stopSpeaking,
  TUTORIAL_FIRST_CATCH,
  type TutorialEvent,
  type TutorialState,
} from "@/game/tutorial";
import { IDLE_MS } from "@/game/event-data";
import { emitEventEnded, emitEventStarted, emitMutatedCatch, onEventStarted, onMutatedCatch } from "@/game/event-hooks";
import { adopt, chooseGift, giftReady, isPetKind, noPet, PETS, takeGift, petUnlocked, type Pet, type PetKind } from "@/game/pet";
import { derbyEndLine, newDerby, readDerby, recordDerby, stepDerby, derbyRank, rivalById, derbyWindow, type DerbyRun, type RivalRecord } from "@/game/rivals";
import { frameId, newPages, pageId, rollShiny } from "@/game/stickers";
import {
  fightInitOf,
  MISSED,
  rollCast,
  windowAt,
  type CastRoll,
  type Envelope,
  type ReplayEvent,
} from "@/game/replay";
import { scoreEntry } from "@/game/scoring";
import { checkGear, gatesOn } from "@/game/gear-rules";
import {
  allLineGear,
  applyOpen,
  canUse,
  craft as craftLineGear,
  difficulty,
  freeLineGear,
  givePack,
  healthOf,
  LINE_PACKS,
  lossHooks,
  packForLevel,
  packFromCatch,
  PACK_SOURCES,
  readLineGear,
  wearMulFor,
  type LineGear,
} from "@/game/lines";
import { rulesVersionOf } from "@/game/line-wear";
import {
  applyResults,
  isSkinId,
  newMedals,
  readHistory,
  readResults,
  readTitles,
  readTrophies,
  titleFor,
  unlockedSkins,
  MEDAL_NAMES,
  type History,
  type SkinId,
  type Trophy,
} from "@/game/social";
import {
  api,
  cantCast,
  castsLeft,
  EnvelopeQueue,
  playerId,
  queueStore,
  secondsLeft,
  serverNow,
  verdictNote,
  type CatchReply,
  type JoinInfo,
  type TourneyRun,
} from "@/game/tourney";
import { weatherAt } from "@/game/weather";
import { fightHelp, helpingHand, isHelping } from "@/game/assist";
import {
  canKeep,
  canRelease,
  choosesFish,
  isTournament,
  legacyMode,
  TOURNAMENT_TABS,
  MODE_KEYS,
  MODES,
  priceIn,
  stageIn,
  type Mode,
  type ModeRules,
} from "@/game/modes";
import {
  addHistory,
  addLog,
  advance,
  bandPadOfGear,
  biteMul,
  castMinutes,
  craft,
  dailySeed,
  eat,
  fightMinutes,
  freshMeta,
  gatherWood,
  gearGate,
  GATE_TIP,
  hourOf,
  holdMulOfGear,
  isForcedCamp,
  keepGoing,
  landFish,
  localDate,
  newRun,
  sanitizeSurvival,
  sleep,
  smoke,
  summarize,
  SURVIVAL_WATERS,
  toSurvivalSave,
  windowAt as survivalWindowAt,
  type Meal,
  type RecipeId,
  type Step,
  type SurvivalMeta,
  type SurvivalRun,
} from "@/game/survival";
import { assistOn, coachAlways, hintAfter, kidActive, needsSure } from "@/game/kid";
import { bookFor, difficultyRules, isDifficulty, type Book, type Difficulty } from "@/game/difficulty";
import {
  freshHazards,
  hazardLevelFor,
  mayExhibit,
  onCast,
  onSnap,
  putBack,
  readHazards,
  salvageCost,
  tickTank,
  type HazardState,
} from "@/game/hazards";
import { advanceStory, CHAPTERS as CHAPTER_COUNT, chapterInfo, chapterReward, freshStory, readStory, type StoryState } from "@/game/story";
import { bumpCounter, checkAchievements, freshAch, readAch, type AchState, type AchStats } from "@/game/achievements";
import { ACTIVE_SLOTS_KEY, clampSlot, hasSlots, readActiveSlots, slotCards, slotKey, slotName, syncId, type ActiveSlots } from "@/game/slots";
import {
  addTrip,
  finishTrip,
  readTrip,
  readTrips,
  startTrip,
  tripCardLines,
  creelLine,
  tripCatch,
  tripIsStale,
  tripRelease,
  windowHour,
  type Trip,
  type TripWindow,
} from "@/game/trips";
import {
  applyHelp,
  COACH,
  COACH_FIGHTS,
  FIGHT_STEP,
  linePercent,
  newFight,
  progressOf,
  pushTrace,
  stepFight,
  TAP_STEPS,
  zoneOf,
  type Drag,
  type Fight,
} from "@/game/fight";
import {
  catchXp,
  noStewards,
  readReleased,
  readStewards,
  releaseFish,
  releaseNote,
  sizeMulOf,
  type Released,
  type Stewards,
} from "@/game/keep";
import {
  beatsRecord,
  LAIR_SPOT,
  readRecords,
  speciesKey,
  withRecord,
  type CatchContext,
  type Records,
} from "@/game/records";
import {
  DEVICE_KEY,
  deviceSubset,
  formOf,
  LEVEL_TIER,
  normPref,
  overlayDevice,
  readDevice,
  readDeviceSettings,
  resolveLevel,
  type Gfx,
  type GfxPref,
  type Level,
} from "@/game/device";
import { setActiveLevel, tierSpec } from "@/game/graphics";
import { hubTargetFor, resolveHubTarget, tabsFor } from "@/game/hubnav";
import type { LeaveFacts } from "@/game/leave";
import { useHubUi } from "@/game/hubstate";
import { probedLevel } from "@/game/probe";
import {
  AUTO_PRICE,
  BAITS,
  BIOMES,
  BOATS,
  BOSS_CHUM_INDEX,
  BOSS_INDEX,
  baseValue,
  baseWeight,
  bossChumPrice,
  type Contract,
  dexCount,
  exhibitValue,
  GEAR,
  type GearKind,
  GIFT_PRICES,
  FIRST_EVENT_MUTATION,
  LIGHT_PRICE,
  LINES,
  MUTATIONS,
  betterMutation,
  luckTotal,
  LURES,
  money,
  multOf,
  PACKS,
  rankName,
  rarityOf,
  REELS,
  RODS,
  rollFish,
  type Rolled,
  SHOWCASE_SLOTS,
  SIG_LURES,
  sigEffect,
  SPECIES_PER_BIOME,
  TANK_TIERS,
  type TankState,
  tankRatePerHour,
  TOTAL_SPECIES,
  WEATHER,
  xpNeed,
} from "@/game/content";

export type Tab = "cast" | "bag" | "gear" | "lures" | "waters" | "dex" | "lodge" | "camp";
export type Phase = "idle" | "wait" | "bite" | "reel";
export type { Mode } from "@/game/modes";
export { MODE_KEYS } from "@/game/modes";
export type LodgeView = "record" | "logbook" | "tank" | "derby" | "regulars" | "pet" | "crew" | "trophies" | "events" | "settings" | "pbroom" | "kidsbook" | "achievements" | "story";

/** WP-6: the Derby is fished against the Regulars (rivals.ts); old random-walk Derbies are converted on load. */
export type DerbyState = DerbyRun | null;

export type RushState = {
  list: number[];
  pos: number;
  t0: number;
} | null;

export type Save = {
  version: number;
  c: number;
  xp: number;
  lv: number;
  rod: number;
  reel: number;
  line: number;
  boat: number;
  biome: number;
  ub: number[];
  box: Record<string, number>;
  lure: number;
  dex: Record<string, { c: number; w: number; m: number }>;
  inv: { name: string; t: number; v: number; w: number; i: number; b: number; m: number }[];
  rb: number;
  tot: number;
  caught: number;
  auto: boolean;
  autoOn: boolean;
  weather: number;
  streak: number;
  bestStreak: number;
  untilBoss: number;
  bosses: number;
  perfects: number;
  taught: boolean;
  contracts: Contract[];
  pins: string[];
  sound: boolean;
  motion: boolean;
  flash: boolean;
  /* WP-1 (save v4): device-level settings, mirrored to fac-ultra-device */
  gfx: GfxPref;
  assist: boolean;
  followClock: boolean;
  /* WP-4 (save v7): Kid Mode is a device setting too (it follows the person at the screen). */
  kid: boolean;
  /* WP-4 (save v7): the Recreational logbook (finished trips, newest first, last 50) and the trip in progress */
  trips: Trip[];
  trip: Trip | null;
  /* WP-2 (save v5): where you last fished each water, and how you rigged it there */
  lastSpot: Record<number, string>;
  rig: Record<number, Rig>;
  /* WP-3 (save v6): your best fish with their story, what you let go, and what that earned */
  records: Records;
  released: Released;
  stewards: Stewards;
  /** Fights seen per fight style: the first few of each get coaching lines. */
  coached: Record<string, number>;
  /** Drag setting for the reel: 0 loose, 1 normal, 2 tight. */
  drag: Drag;
  /* Expansion (save v3) */
  sigBox: number[];
  sig: number;
  baitBox: Record<string, number>;
  bait: number;
  lair: boolean;
  mastered: number[];
  tank: TankState;
  derbiesWon: number;
  derby: DerbyState;
  rush: RushState;
  rushBest: number;
  /* WP-6 (save v8): the fun layer. Pet, sticker book, shiny list, days the Fish of the Day was caught,
     lifetime head-to-head against the Regulars. Plus two device settings: ambience volume and the colour-blind palette. */
  pet: Pet;
  stickers: string[];
  shiny: string[];
  fotdClaimed: string[];
  rivalRecord: RivalRecord;
  volume: number;
  cb: boolean;
  /* WP-8 (save v9): what tournaments left you with. The server keeps the truth (api/trophies); these are
     your cabinet: medals, titles, the bobber skin you picked, and your last 50 events. */
  trophies: Trophy[];
  titles: string[];
  bobberSkin: SkinId;
  tourneyHistory: History[];
  /* WP-16 (save v12, docs/architecture/12): the slot's name and when it was made (0 = never created on purpose), its
     difficulty, the Kids book (Kid Mode and Super Easy fish; the main `dex` never sees them), the Story chapter,
     achievements, the Legend-difficulty hazard state, and "keep every fish without asking". */
  slotName: string;
  created: number;
  difficulty: Difficulty;
  sideDex: Record<string, { c: number; w: number; m: number }>;
  story: StoryState;
  ach: AchState;
  hz: HazardState;
  autoKeep: boolean;
  /* WP-14 (save v11): the line workshop. Lines are crafted from duplicates and found in packs; `line` is the tier in use. */
  lineGear: LineGear;
  /* WP-15 (save v10): the long-play events. The streak clock, the event running, the events seen and the mutated fish landed. */
  events: EventsSave;
  /* Update Three (save v13): promo codes this save has claimed (canonical upper-case), the Prestige count,
     whether the guided tutorial is finished, and the night-fishing state (on, and when it was switched on). */
  promo: string[];
  prestige: number;
  tutored: boolean;
  night: { on: boolean; since: number };
};

export type LastCatch = {
  name: string;
  rarity: number;
  species: number;
  biome: number;
  mutation: number;
  weight: number;
  value: number;
  perfect: boolean;
  boss: boolean;
  frenzy: boolean;
  discovered: boolean;
  /** Heavier than this species' previous best (and not the first one caught). */
  record: boolean;
  /* WP-6 */
  shiny: boolean;
  /** Today's Fish of the Day, first one: double XP and a gold frame. */
  fotd: boolean;
  /** This catch filled the last cell of the water's page. */
  page: boolean;
  /* WP-16: which book it went in ("kids" for Kid Mode and Super Easy). */
  book: Book;
};

type Toast = { id: number; text: string };

const SAVE_VERSION = 13;
const MARKS = [10, 25, 50, 100, 150, 200, 250, 300, 375, 400, 450, 500];

let currentMode: Mode = "expedition";

/* WP-16: which numbered slot is open in Expedition and Story (12 §5). A device note, kept in fac-ultra-slots. */
let activeSlots: ActiveSlots = {};

export function activeSlot(mode: Mode = currentMode): number {
  return hasSlots(mode) ? clampSlot(mode, activeSlots[mode]) : 0;
}

function loadActiveSlots() {
  try {
    activeSlots = readActiveSlots(localStorage.getItem(ACTIVE_SLOTS_KEY));
  } catch {
    activeSlots = {};
  }
}

function saveActiveSlots() {
  try {
    localStorage.setItem(ACTIVE_SLOTS_KEY, JSON.stringify(activeSlots));
  } catch {
    /* private mode: the next visit opens slot 1 */
  }
}

/** The localStorage key of the slot being played (the mode's original key for slot 1). */
export function modeKey(mode: Mode = currentMode) {
  return slotKey(mode, activeSlot(mode));
}

/** The cloud's name for the slot being played ("expedition", "expedition-s1" …). */
export function currentSyncId(): string {
  return syncId(currentMode, activeSlot(currentMode));
}

/** The rules of the mode being played (05 §1). Every mode branch in the game reads this. */
export function modeRules(mode: Mode = currentMode): ModeRules {
  return MODES[mode];
}

/** The gear progression rules (10 §2) for the mode being played. Recreational, Kid Mode and Tournament skip them. */
function gateOf(s: Save, kind: Parameters<typeof checkGear>[0], index: number) {
  if (!gatesOn(modeRules(), kidActive(s.kid, modeRules()))) return { ok: true, missing: [] as string[], text: "" };
  return checkGear(kind, index, s);
}

/* v1 → v3 world remap: five biomes were inserted into the ladder and five
   species into every biome's rarity bands (see EXPANSION-DESIGN §2). */
const BIOME_REMAP: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 5, 5: 7, 6: 9, 7: 10, 8: 12, 9: 13 };

export function speciesRemap(old: number) {
  if (old <= 7) return old;
  if (old <= 13) return old + 1;
  if (old <= 17) return old + 2;
  if (old === 18) return 21;
  return BOSS_INDEX;
}

let toastSeq = 1;
let saveTimer = 0;
let bound = false;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "splash" | "rain" | "snow" | "ember" | "spark" | "bubble";
  size: number;
};

type Swimmer = { x: number; y: number; v: number; dir: number; species: number; phase: number; sc: number };

export const sim = {
  phase: "idle" as Phase,
  biteLeft: 0,
  biteMax: 1,
  waitLeft: 0,
  fish: null as Rolled | null,
  castLure: -1,
  perfect: false,
  bossCast: false,
  trauma: 0,
  hitstop: 0,
  hitFlash: 0,
  flashA: 0,
  t: 0,
  weatherAcc: 0,
  calmAcc: 0,
  autoAcc: 0,
  settleAcc: 0,
  evAcc: 0,
  evSave: 0,
  lastActive: 0,
  fxAcc: 0,
  castBait: -1,
  castLair: false,
  introT: 0,
  frenzyLeft: 0,
  shownFrenzy: 0,
  bnx: 0.5,
  bny: 0.74,
  particles: [] as Particle[],
  swimmers: [] as Swimmer[],
  /** A fish in the air: the landing leap (big) or a jumper's mid-fight leap (small). */
  leap: null as null | { t: number; look: Rolled; small?: boolean },
  /* WP-1: fight ring and Helping Hand (never saved) */
  cap: 90,
  spinT: 0,
  bandFlash: 0,
  /** Helping Hand is on the fight right now (the ring glows). */
  helpGlow: false,
  misses: 0,
  failedFights: 0,
  wins: 0,
  lastInput: 0,
  hover: null as null | { x: number; y: number },
  /* WP-3: the tension fight (never saved). `fight` is the pure state; the rest feeds it. */
  fight: null as null | Fight,
  /** The reel is held down (mouse, key or finger). */
  down: false,
  /** Steps left of a tap's short hold. */
  tapLeft: 0,
  /** Player two (local co-op) is holding the reel. */
  partner: false,
  partnerTapLeft: 0,
  /** Seconds of real time not yet turned into fixed 50 ms fight steps. */
  acc: 0,
  /** The fight's input trace: alternating released/held run lengths in steps (06 §1.3). */
  trace: [] as number[],
  /** Edge counters already reacted to, so each warning, run and strain sounds once. */
  seen: { warns: 0, runs: 0, jumps: 0, reds: 0, ticks: 0, freeze: false, still: false, surge: false, style: "runner" as FightStyle },
  /** Show coaching lines in this fight. */
  coach: false,
  /** Drag when the fish was hooked (a replay needs it; live changes are casual-play only). */
  dragAtHook: 1 as Drag,
  /** Last detail line sent to the UI, so the 60 fps loop writes it only when it changes. */
  shownDetail: "",
  /* WP-2: where the bobber is aimed and what this cast was made with (never saved) */
  spotId: "",
  /** 0 → 1 while the bobber flies from the rod tip to the spot; 1 = landed. */
  castT: 1,
  cast: null as null | CastInfo,
  waited: 0,
  hinted: false,
  /* WP-5: when the fish was hooked (sim.t), so a Survival fight can cost game time. -1 = not hooked. */
  hookT: -1,
  /* WP-6: seconds left of the pet's cheer after a catch (cosmetic, never saved). */
  petT: 0,
  /* WP-7: the tournament cast in the air (never saved). Rolled once at the cast from the event's seed. */
  troll: null as null | TourneyCast,
  tAcc: 0,
  /* WP-16: seconds since the tank checks last ran (never saved). */
  hzAcc: 0,
};

/** The time-based dangers of the Aquarium (docs/architecture/12 §3). Cheap: it returns at once unless something is due. */
function tickTankHazards() {
  const s = useGame.getState();
  if (!s.hydrated || s.screen !== "game") return;
  const danger = hazardsNow(s);
  if (danger === "none" && !s.hz.jump && !s.hz.grace) return;
  const out = tickTank(s.hz, danger, s.tank, s.c, Date.now());
  if (out.hz === s.hz && out.exhibits === s.tank.exhibits && out.c === s.c) return;
  const patch: Partial<Store> = { hz: out.hz };
  if (out.exhibits !== s.tank.exhibits) {
    const lost = new Set(out.events.filter((e) => e.kind === "lost").map((e) => (e as { key: string }).key));
    patch.tank = { ...s.tank, exhibits: out.exhibits, ped: s.tank.ped.filter((k) => !lost.has(k)) };
  }
  if (out.c !== s.c) patch.c = out.c;
  useGame.setState(patch);
  hazardSay(out.lines);
  if (out.events.length) persistSoon();
}

/** One tournament cast: what was chosen, what the seed rolled, and when the hook went in. */
export type TourneyCast = {
  index: number;
  at: number;
  spot: string;
  p: Presentation;
  roll: CastRoll;
  /** Milliseconds after the bite began that the fish was hooked (MISSED until it is). */
  hookMs: number;
};

/** Everything the fight and the after-catch message need to know about the cast. */
export type CastInfo = {
  spotId: string;
  p: Presentation;
  window: Window;
  weather: number;
  /** Match score per species slot; null on Boss Lair casts (the boss is not matched). */
  ms: number[] | null;
  avg: number;
};

function starterContracts(): Contract[] {
  return [
    { id: "start-count", kind: "count", goal: 6, prog: 0, reward: 210, label: "Land 6 fish" },
    { id: "start-rare", kind: "rarity", goal: 2, prog: 0, reward: 280, label: "Land 2 rare or better", minRarity: 2 },
    { id: "start-bank", kind: "bank", goal: 150, prog: 0, reward: 70, label: "Sell $150 worth" },
  ];
}

export function freshTank(): TankState {
  return { tier: 0, gift: 0, lights: [], exhibits: [], ped: [], feedUntil: 0, lastSettle: Date.now() };
}

export function fresh(): Save {
  return {
    version: SAVE_VERSION,
    c: 50,
    xp: 0,
    lv: 1,
    rod: 0,
    reel: 0,
    line: 0,
    boat: 0,
    biome: 0,
    ub: [0],
    box: {},
    lure: -1,
    dex: {},
    inv: [],
    rb: 0,
    tot: 0,
    caught: 0,
    auto: false,
    autoOn: false,
    weather: 0,
    streak: 0,
    bestStreak: 0,
    untilBoss: 12,
    bosses: 0,
    perfects: 0,
    taught: false,
    contracts: starterContracts(),
    pins: [],
    sound: true,
    motion: true,
    flash: true,
    gfx: "auto",
    assist: true,
    followClock: true,
    kid: false,
    trips: [],
    trip: null,
    lastSpot: {},
    rig: {},
    records: {},
    released: {},
    stewards: noStewards(),
    coached: {},
    drag: 1,
    sigBox: [],
    sig: -1,
    baitBox: {},
    bait: -1,
    lair: false,
    mastered: [],
    tank: freshTank(),
    derbiesWon: 0,
    derby: null,
    rush: null,
    rushBest: 0,
    pet: noPet(),
    stickers: [],
    shiny: [],
    fotdClaimed: [],
    rivalRecord: {},
    volume: DEFAULT_VOLUME,
    cb: false,
    trophies: [],
    titles: [],
    bobberSkin: "plain",
    tourneyHistory: [],
    slotName: "",
    created: 0,
    difficulty: "normal",
    sideDex: {},
    story: freshStory(),
    ach: freshAch(),
    hz: freshHazards((loose() * 4294967296) >>> 0),
    autoKeep: false,
    lineGear: freeLineGear(),
    events: noEvents(),
    promo: [],
    prestige: 0,
    tutored: false,
    night: { on: false, since: 0 },
  };
}

/** A new save for a mode where `allUnlocked` is true (Recreational): every water and every piece of gear is yours. */
export function unlockedSave(): Save {
  const base = fresh();
  const box: Record<string, number> = {};
  for (let i = 0; i < LURES.length; i++) box[String(i)] = 999;
  const baitBox: Record<string, number> = {};
  for (let i = 0; i < BAITS.length; i++) baitBox[String(i)] = 999;
  return {
    ...base,
    rod: RODS.length - 1,
    reel: REELS.length - 1,
    line: LINES.length - 1,
    lineGear: allLineGear(),
    boat: BOATS.length - 1,
    ub: BIOMES.map((_, i) => i),
    box,
    sigBox: SIG_LURES.map((_, i) => i),
    baitBox,
    contracts: [],
    tank: { ...freshTank(), tier: TANK_TIERS.length - 1, gift: GIFT_PRICES.length },
  };
}

function num(v: unknown, d: number, min = 0, max = 1e15) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : d;
  return Math.min(max, Math.max(min, n));
}
function int(v: unknown, d: number, min: number, max: number) {
  return Math.round(num(v, d, min, max));
}
function bool(v: unknown, d: boolean) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return d;
}
/** A string from untrusted save data, clipped to `max` characters. */
export function str(v: unknown, d: string, max = 80) {
  return typeof v === "string" ? v.slice(0, max) : d;
}
/** An array from untrusted save data: each item passed through `item`,
    items it rejects (returns `undefined`) dropped, clipped to `max` entries. */
export function list<T>(v: unknown, item: (x: unknown) => T | undefined, max = 500): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const x of v) {
    const y = item(x);
    if (y !== undefined) out.push(y);
    if (out.length >= max) break;
  }
  return out;
}
export { num as saveNum, int as saveInt, bool as saveBool };
function uid() {
  return loose().toString(36).slice(2, 9);
}

const KINDS = new Set(["count", "rarity", "discover", "bank", "biome", "boss"]);

function readContracts(v: unknown, fallback: Contract[]): Contract[] {
  if (!Array.isArray(v) || v.length === 0) return fallback;
  const out: Contract[] = [];
  for (const item of v.slice(0, 3)) {
    if (!item || typeof item !== "object") return fallback;
    const c = item as Record<string, unknown>;
    if (typeof c.kind !== "string" || !KINDS.has(c.kind) || typeof c.label !== "string") return fallback;
    out.push({
      id: typeof c.id === "string" ? c.id : uid(),
      kind: c.kind as Contract["kind"],
      goal: int(c.goal, 1, 1, 1e9),
      prog: int(c.prog, 0, 0, 1e9),
      reward: int(c.reward, 0, 0, 1e12),
      label: c.label.slice(0, 90),
      minRarity: c.minRarity == null ? undefined : int(c.minRarity, 2, 0, 4),
      biome: c.biome == null ? undefined : int(c.biome, 0, 0, BIOMES.length - 1),
    });
  }
  return out.length ? out : fallback;
}

function readTank(v: unknown, dex: Save["dex"]): TankState {
  const base = freshTank();
  if (!v || typeof v !== "object") return base;
  const t = v as Record<string, unknown>;
  const exhibits: string[] = [];
  if (Array.isArray(t.exhibits)) {
    for (const key of t.exhibits) {
      if (typeof key !== "string" || !dex[key]?.c || exhibits.includes(key)) continue;
      exhibits.push(key);
      if (exhibits.length >= TANK_TIERS[TANK_TIERS.length - 1].slots) break;
    }
  }
  const ped = Array.isArray(t.ped)
    ? t.ped.filter((k): k is string => typeof k === "string" && exhibits.includes(k)).slice(0, SHOWCASE_SLOTS)
    : [];
  const lights = Array.isArray(t.lights)
    ? [...new Set(t.lights.map((n) => int(n, -1, 0, BIOMES.length - 1)).filter((n) => n >= 0))]
    : [];
  return {
    tier: int(t.tier, 0, 0, TANK_TIERS.length - 1),
    gift: int(t.gift, 0, 0, GIFT_PRICES.length),
    lights,
    exhibits,
    ped,
    feedUntil: num(t.feedUntil, 0, 0, 1e16),
    lastSettle: num(t.lastSettle, Date.now(), 0, 1e16),
  };
}

/** Remembered spots: only known biomes and spot ids that still exist in that water survive. */
function readLastSpot(v: unknown): Record<number, string> {
  const out: Record<number, string> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, id] of Object.entries(v as object)) {
    if (!/^\d{1,2}$/.test(k)) continue;
    const b = Number(k);
    if (b < 0 || b >= BIOMES.length || typeof id !== "string") continue;
    if (spotById(b, id)) out[b] = id;
  }
  return out;
}

/** Remembered rigs per water; depth and retrieve each fall back to the default if off. */
function readRigs(v: unknown): Record<number, Rig> {
  const out: Record<number, Rig> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, rig] of Object.entries(v as object)) {
    if (!/^\d{1,2}$/.test(k)) continue;
    const b = Number(k);
    if (b < 0 || b >= BIOMES.length) continue;
    out[b] = readRig(rig);
  }
  return out;
}

function isSpeciesKey(key: string) {
  return speciesKey(key) !== null;
}

const STYLES: readonly FightStyle[] = ["runner", "diver", "jumper", "bulldog", "thrasher"];

/** Fights seen per style, clamped; unknown styles dropped. */
function readCoached(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const style of STYLES) {
    const n = (v as Record<string, unknown>)[style];
    if (typeof n === "number" && Number.isFinite(n) && n > 0) out[style] = Math.min(99, Math.round(n));
  }
  return out;
}

export function sanitize(raw: unknown): Save {
  const base = fresh();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const migrate = int(o.version, 1, 1, SAVE_VERSION) < 3;
  const mapB = (b: number) => (migrate ? (BIOME_REMAP[b] ?? b) : b);
  const mapI = (i: number) => (migrate ? speciesRemap(i) : i);
  const dex: Save["dex"] = {};
  if (o.dex && typeof o.dex === "object") {
    for (const [k, val] of Object.entries(o.dex as object)) {
      if (!/^\d+-\d+$/.test(k)) continue;
      const [rb, ri] = k.split("-").map(Number);
      if (rb < 0 || rb > BIOMES.length - 1 || ri < 0 || ri > SPECIES_PER_BIOME - 1) continue;
      const b = mapB(rb);
      const i = mapI(ri);
      const e = val as { c?: number; w?: number; m?: number };
      const c = int(e?.c, 0, 0, 1e9);
      if (!c) continue;
      const key = `${b}-${i}`;
      const prev = dex[key];
      dex[key] = {
        c: (prev?.c || 0) + c,
        w: Math.max(prev?.w || 0, num(e?.w, 0, 0, 1e6)),
        m: betterMutation(prev?.m || 0, int(e?.m, 0, 0, MUTATIONS.length - 1)),
      };
    }
  }
  const inv: Save["inv"] = [];
  if (Array.isArray(o.inv)) {
    for (const item of o.inv.slice(0, 250)) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      const name = typeof it.name === "string" ? it.name : typeof it.n === "string" ? it.n : "Fish";
      inv.push({
        name: name.slice(0, 80),
        t: int(it.t, 0, 0, 4),
        v: int(it.v, 1, 0, 1e12),
        w: num(it.w, 1, 0, 1e6),
        i: mapI(int(it.i, 0, 0, SPECIES_PER_BIOME - 1)),
        b: mapB(int(it.b, 0, 0, BIOMES.length - 1)),
        m: int(it.m, 0, 0, MUTATIONS.length - 1),
      });
    }
  }
  let ub = Array.isArray(o.ub)
    ? [...new Set(o.ub.map((n) => mapB(int(n, -1, 0, BIOMES.length - 1))).filter((n) => n >= 0))]
    : [0];
  if (!ub.includes(0)) ub = [0, ...ub];
  const box: Record<string, number> = {};
  if (o.box && typeof o.box === "object") {
    for (const [k, v] of Object.entries(o.box as object)) {
      const i = int(Number(k), -1, 0, 49);
      const q = int(v, 0, 0, 99999);
      if (i >= 0 && q > 0) box[String(i)] = q;
    }
  }
  let lure = int(o.lure, -1, -1, 49);
  if (lure >= 0 && !(box[String(lure)] > 0)) lure = -1;
  const pins: string[] = [];
  if (Array.isArray(o.pins)) {
    for (const item of o.pins) {
      if (typeof item !== "string") continue;
      let key = item;
      if (migrate && /^\d+-\d+$/.test(item)) {
        const [pb, pi] = item.split("-").map(Number);
        key = `${mapB(pb)}-${mapI(pi)}`;
      }
      if (!dex[key]?.c || pins.includes(key)) continue;
      pins.push(key);
      if (pins.length >= 8) break;
    }
  }
  const biome = mapB(int(o.biome ?? o.bi, 0, 0, BIOMES.length - 1));
  const sigBox = Array.isArray(o.sigBox)
    ? [...new Set(o.sigBox.map((n) => int(n, -1, 0, SIG_LURES.length - 1)).filter((n) => n >= 0))]
    : [];
  let sig = int(o.sig, -1, -1, SIG_LURES.length - 1);
  if (sig >= 0 && !sigBox.includes(sig)) sig = -1;
  const baitBox: Record<string, number> = {};
  if (o.baitBox && typeof o.baitBox === "object") {
    for (const [k, v] of Object.entries(o.baitBox as object)) {
      const i = int(Number(k), -1, 0, BAITS.length - 1);
      const q = int(v, 0, 0, 99999);
      if (i >= 0 && q > 0) baitBox[String(i)] = q;
    }
  }
  let bait = int(o.bait, -1, -1, BAITS.length - 1);
  if (bait >= 0 && !(baitBox[String(bait)] > 0)) bait = -1;
  const mastered = Array.isArray(o.mastered)
    ? [...new Set(o.mastered.map((n) => mapB(int(n, -1, 0, BIOMES.length - 1))).filter((n) => n >= 0))]
    : [];
  const tank = readTank(o.tank, dex);
  /* v7 → v8 (WP-6): a Derby saved with names and scores only becomes a Regulars Derby that keeps its scores. */
  const derby: DerbyState = readDerby(o.derby, ub.includes(biome) ? biome : ub[0]);
  let rush: RushState = null;
  if (o.rush && typeof o.rush === "object") {
    const r = o.rush as Record<string, unknown>;
    if (Array.isArray(r.list)) {
      rush = {
        list: r.list.map((n) => int(n, 0, 0, BIOMES.length - 1)).slice(0, BIOMES.length),
        pos: int(r.pos, 0, 0, BIOMES.length),
        t0: num(r.t0, 0, 0, 1e16),
      };
    }
  }
  const oldLine = int(o.line, 0, 0, LINES.length - 1);
  const lineGear = readLineGear(o.lineGear, oldLine);
  return {
    ...base,
    version: SAVE_VERSION,
    c: num(o.c, 50, 0, 1e15),
    xp: num(o.xp, 0, 0, 1e12),
    lv: int(o.lv, 1, 1, 9999),
    rod: int(o.rod, 0, 0, RODS.length - 1),
    reel: int(o.reel, 0, 0, REELS.length - 1),
    line: canUse(lineGear, oldLine) ? oldLine : 0,
    boat: int(o.boat, 0, 0, BOATS.length - 1),
    biome: ub.includes(biome) ? biome : ub[0],
    ub,
    box,
    lure,
    dex,
    inv,
    rb: int(o.rb, 0, 0, 9999),
    tot: num(o.tot, 0, 0, 1e15),
    caught: int(o.caught ?? o.n, 0, 0, 1e12),
    auto: bool(o.auto ?? o.au, false),
    autoOn: bool(o.autoOn ?? o.on, false),
    weather: int(o.weather, 0, 0, 4),
    streak: int(o.streak, 0, 0, 99999),
    bestStreak: int(o.bestStreak, 0, 0, 99999),
    untilBoss: int(o.untilBoss, 12, 0, 99),
    bosses: int(o.bosses, 0, 0, 1e9),
    perfects: int(o.perfects, 0, 0, 1e9),
    taught: bool(o.taught, false),
    contracts: migrate
      ? readContracts(o.contracts, base.contracts).map((c) =>
          c.biome == null ? c : { ...c, biome: mapB(c.biome) },
        )
      : readContracts(o.contracts, base.contracts),
    pins,
    sound: bool(o.sound, true),
    motion: bool(o.motion, true),
    flash: bool(o.flash, true),
    gfx: normPref(o.gfx) ?? "auto",
    assist: bool(o.assist, true),
    followClock: bool(o.followClock, true),
    /* v6 → v7 (WP-4): three new fields, nothing existing changed meaning. Old saves get no logbook and Kid Mode off. */
    kid: bool(o.kid, false),
    trips: readTrips(o.trips),
    trip: openTrip(o.trip),
    /* v4 → v5 (WP-2): two new fields, nothing existing changed meaning. Old saves get {}. */
    lastSpot: readLastSpot(o.lastSpot),
    rig: readRigs(o.rig),
    /* v5 → v6 (WP-3): five new fields, nothing existing changed meaning. Old saves get empty ones. */
    records: readRecords(o.records),
    released: readReleased(o.released, isSpeciesKey),
    stewards: readStewards(o.stewards, isSpeciesKey, BIOMES.length),
    coached: readCoached(o.coached),
    drag: int(o.drag, 1, 0, 2) as Drag,
    sigBox,
    sig,
    baitBox,
    bait,
    lair: bool(o.lair, false),
    mastered,
    tank,
    derbiesWon: int(o.derbiesWon, 0, 0, 1e9),
    derby,
    rush,
    rushBest: num(o.rushBest, 0, 0, 1e16),
    /* v7 → v8 (WP-6): seven new fields, nothing existing changed meaning. Old saves get no pet, an empty book, 35% ambience. */
    ...readFun(o),
    volume: o.volume === undefined ? DEFAULT_VOLUME : clampVolume(num(o.volume, DEFAULT_VOLUME, 0, 100)),
    cb: bool(o.cb, false),
    /* v8 → v9 (WP-8): four new fields, nothing existing changed meaning. Old saves get an empty cabinet and the Classic bobber. */
    trophies: readTrophies(o.trophies),
    titles: readTitles(o.titles),
    bobberSkin: isSkinId(o.bobberSkin) ? o.bobberSkin : "plain",
    tourneyHistory: readHistory(o.tourneyHistory),
    /* v11 → v12 (WP-16): eight new fields, nothing existing changed meaning. Old saves are Normal difficulty with an empty
       Kids book, no story, no achievements (they are earned on the next check) and a hazard seed taken from the save itself. */
    slotName: str(o.slotName, "", 20),
    created: int(o.created, 0, 0, 1e15),
    difficulty: isDifficulty(o.difficulty) ? o.difficulty : "normal",
    sideDex: readSideDex(o.sideDex),
    story: readStory(o.story),
    ach: readAch(o.ach),
    hz: readHazards(o.hz, seedFrom("hazard-seed", String(o.created ?? 0), String(o.tot ?? 0), String(o.caught ?? 0))),
    autoKeep: bool(o.autoKeep, false),
    /* v10 → v11 (WP-14): lines became an inventory. An old save owned every line up to `line`: it gets one copy of each. */
    lineGear,
    /* v9 → v10 (WP-15): one new field, nothing existing changed meaning. Old saves start with no streak and no events seen. */
    events: readEvents(o.events),
    /* v12 -> v13 (Update Three): four new fields, nothing existing changed meaning. Old saves have
       claimed no codes, never prestiged, not done the guided tutorial, and never fished at night. */
    promo: [...new Set(list(o.promo, (x) => (typeof x === "string" && x.trim() ? x.trim().toUpperCase().slice(0, 24) : undefined), 100))],
    prestige: int(o.prestige, 0, 0, 999),
    tutored: bool(o.tutored, false),
    night: readNight(o.night),
  };
}

/** Night-fishing state from untrusted data. */
function readNight(v: unknown): Save["night"] {
  if (!v || typeof v !== "object") return { on: false, since: 0 };
  const n = v as Record<string, unknown>;
  return { on: bool(n.on, false), since: int(n.since, 0, 0, 1e15) };
}

/** The Kids book from untrusted data (same shape and bounds as the dex). */
function readSideDex(v: unknown): Save["dex"] {
  const out: Save["dex"] = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as object)) {
    if (!/^\d+-\d+$/.test(k)) continue;
    const [b, i] = k.split("-").map(Number);
    if (b > BIOMES.length - 1 || i > SPECIES_PER_BIOME - 1) continue;
    const e = val as { c?: number; w?: number; m?: number };
    const c = int(e?.c, 0, 0, 1e9);
    if (c) out[k] = { c, w: num(e?.w, 0, 0, 1e6), m: int(e?.m, 0, 0, MUTATIONS.length - 1) };
  }
  return out;
}

export function snapshot(s: Save): Save {
  return {
    version: SAVE_VERSION,
    c: s.c,
    xp: s.xp,
    lv: s.lv,
    rod: s.rod,
    reel: s.reel,
    line: s.line,
    boat: s.boat,
    biome: s.biome,
    ub: s.ub,
    box: s.box,
    lure: s.lure,
    dex: s.dex,
    inv: s.inv,
    rb: s.rb,
    tot: s.tot,
    caught: s.caught,
    auto: s.auto,
    autoOn: s.autoOn,
    weather: s.weather,
    streak: s.streak,
    bestStreak: s.bestStreak,
    untilBoss: s.untilBoss,
    bosses: s.bosses,
    perfects: s.perfects,
    taught: s.taught,
    contracts: s.contracts,
    pins: s.pins,
    sound: s.sound,
    motion: s.motion,
    flash: s.flash,
    gfx: s.gfx,
    assist: s.assist,
    followClock: s.followClock,
    kid: s.kid,
    trips: s.trips,
    trip: s.trip,
    lastSpot: s.lastSpot,
    rig: s.rig,
    records: s.records,
    released: s.released,
    stewards: s.stewards,
    coached: s.coached,
    drag: s.drag,
    sigBox: s.sigBox,
    sig: s.sig,
    baitBox: s.baitBox,
    bait: s.bait,
    lair: s.lair,
    mastered: s.mastered,
    tank: s.tank,
    derbiesWon: s.derbiesWon,
    derby: s.derby,
    rush: s.rush,
    rushBest: s.rushBest,
    pet: s.pet,
    stickers: s.stickers,
    shiny: s.shiny,
    fotdClaimed: s.fotdClaimed,
    rivalRecord: s.rivalRecord,
    volume: s.volume,
    cb: s.cb,
    trophies: s.trophies,
    titles: s.titles,
    bobberSkin: s.bobberSkin,
    tourneyHistory: s.tourneyHistory,
    slotName: s.slotName,
    created: s.created,
    difficulty: s.difficulty,
    sideDex: s.sideDex,
    story: s.story,
    ach: s.ach,
    hz: s.hz,
    autoKeep: s.autoKeep,
    lineGear: s.lineGear,
    events: s.events,
    promo: s.promo,
    prestige: s.prestige,
    tutored: s.tutored,
    night: s.night,
  };
}

/** The trip in progress from untrusted data (a finished one is not "open"). */
function openTrip(v: unknown): Trip | null {
  const t = readTrip(v);
  return t && t.end === 0 ? t : null;
}

/** Weight of what is in the creel, in lb. */
function creelWeight(inv: Save["inv"]) {
  return Math.round(inv.reduce((sum, f) => sum + f.w, 0) * 10) / 10;
}

/** Pack up a trip: file it in the logbook, empty the creel. `card` shows the trip card. */
function closeTrip(
  s: Pick<Save, "trip" | "trips" | "inv">,
  now: number,
  card = true,
): Pick<Save, "trip" | "trips" | "inv"> & { tripCard: { trip: Trip; lines: string[] } | null } {
  const t = s.trip;
  if (!t) return { trip: null, trips: s.trips, inv: s.inv, tripCard: null };
  const done = finishTrip(t, now);
  /* A blink-and-gone trip with nothing caught is not worth a logbook line. */
  const worth = card || done.caught > 0 || now - done.start > 2 * 60_000;
  return {
    trip: null,
    trips: worth ? addTrip(s.trips, done) : s.trips,
    inv: [],
    tripCard: card ? { trip: done, lines: tripCardLines({ trip: done, creelCount: s.inv.length, creelLb: creelWeight(s.inv) }) } : null,
  };
}

/* WP-9: the cloud layer listens for saves. It gets the mode and the exact text that was just written to
   this device; it never changes the save and the game never waits for it. */
type PersistListener = (syncId: string, json: string) => void;
const persistListeners = new Set<PersistListener>();
/* WP-16: the cloud layer also hears when a slot is deleted, so the cloud copy goes too and cannot come back. */
const removeListeners = new Set<(syncId: string) => void>();

/** Call `fn` with the sync id of every slot the player deletes. Returns a function that stops listening. */
export function onSlotRemoved(fn: (syncId: string) => void): () => void {
  removeListeners.add(fn);
  return () => removeListeners.delete(fn);
}

/** Call `fn` after every save to this device. Returns a function that stops listening. */
export function onPersisted(fn: PersistListener): () => void {
  persistListeners.add(fn);
  return () => persistListeners.delete(fn);
}

/** What leaving now would interrupt (see leave.ts). */
export function currentLeaveFacts(): LeaveFacts {
  const s = useGame.getState();
  return {
    line: sim.phase === "idle" ? "none" : sim.phase === "wait" ? "waiting" : "fight",
    trip: !!s.trip && !!MODES[s.mode].trips,
    event: s.mode === "tournament" && !!s.tourney,
    run: !!s.survival && !s.survival.over,
  };
}

/** Write the live game to this device right now (instead of in a moment). */
export function flushSave() {
  window.clearTimeout(saveTimer);
  persistNow();
}

/** Load the current mode again from this device's storage (after the cloud put a newer save there). */
export function reloadActiveSlot() {
  if (!useGame.getState().hydrated) return;
  loadSlot(currentMode, useGame.getState().screen === "game");
}

function persistNow() {
  /* Before the first load nothing is real yet: writing the empty starting state would overwrite the player's save
     (and, on a test-phase update, the device settings the reset keeps). */
  if (!useGame.getState().hydrated) return;
  try {
    const key = modeKey();
    const st = useGame.getState();
    /* Survival has its own slot and its own shape (survival.ts): it never writes a career-shaped save. */
    const json = JSON.stringify(modeRules().survival ? toSurvivalSave(st) : snapshot(st));
    const prev = localStorage.getItem(key);
    if (prev) localStorage.setItem(key + "-bak", prev);
    localStorage.setItem(key, json);
    /* Device settings follow the player across modes (07 §2). */
    localStorage.setItem(DEVICE_KEY, JSON.stringify(deviceSubset(useGame.getState())));
    for (const fn of persistListeners) fn(currentSyncId(), json);
  } catch {
    /* private mode or quota */
  }
}

/* ── Survival (WP-5): the store side. The rules are pure and live in survival.ts. ───────────── */

/** Real seconds since the fish was hooked (0 if it never was). */
function hookedSeconds() {
  return sim.hookT >= 0 ? Math.max(0, sim.t - sim.hookT) : 0;
}

/** Make `run` the live run: the sky follows it, a finished run is filed in the history, and it is saved. */
function commitRun(run: SurvivalRun, line?: string) {
  const s = useGame.getState();
  let meta = s.sMeta;
  let out = run;
  if (out.over && !out.recorded) {
    out = { ...out, recorded: true };
    meta = { ...meta, history: addHistory(meta.history, summarize(out)) };
    if (out.over?.kind === "won") audio.fanfare();
    else audio.fail("snap");
  }
  const patch: Partial<Store> = { survival: out, sMeta: meta, weather: out.weather };
  if (line) {
    patch.message = line;
    patch.detail = "";
  }
  if (isForcedCamp(out) && s.survival && !isForcedCamp(s.survival) && !out.over) {
    patch.toasts = pushToast([...s.toasts], "It is too dark to fish. Time to camp.");
  }
  useGame.setState(patch);
  persistSoon();
}

/** A cast is refused when there is no run, the run is over, or it is too dark. Says why. */
function survivalBlocksCast(): boolean {
  const run = useGame.getState().survival;
  let why = "";
  let dark = false;
  if (!run) why = "Start a run first.";
  else if (run.over) why = "This run is over.";
  else if (isForcedCamp(run)) {
    why = "It is too dark to fish.";
    dark = true;
  }
  if (!why) return false;
  useGame.setState({ message: why, detail: dark ? "Open Camp and sleep until morning." : "", ...(dark ? { tab: "camp" as Tab } : {}) });
  return true;
}

/** Pay a cast's game time. False when the run ended during it. */
function survivalChargeCast(waitSeconds: number): boolean {
  const run = useGame.getState().survival;
  if (!run) return false;
  const next = advance({ ...run, casts: run.casts + 1 }, castMinutes(waitSeconds));
  commitRun(next);
  if (next.over) {
    sim.phase = "idle";
    return false;
  }
  return true;
}

function survivalFightCost(realSeconds: number) {
  const run = useGame.getState().survival;
  if (run) commitRun(advance(run, fightMinutes(realSeconds)));
}

/* ── Long-play events (WP-15, docs/architecture/11) ── */

/** The player is here: a tap, a key or a cast. Resets the idle timer of the events clock. */
export function noteActivity(now = Date.now()) {
  sim.lastActive = now;
}

/** Advance the events clock to now. Called about once a second from frame(); the pure rules live in events.ts. */
/* ── Update Three wiring ─────────────────────────────────────────────────
   The pure packages (promo, tutorial, night, prestige, holidays) hold the rules;
   these helpers and the store actions below are the only engine glue. */

/** The stored-level loop the catch pipeline runs (withCatch): xp past a level becomes the level. */
function applyLevelUps(xp: number, lv: number): { xp: number; lv: number; gained: number } {
  let gained = 0;
  while (xp >= xpNeed(lv)) {
    xp -= xpNeed(lv);
    lv += 1;
    gained += 1;
  }
  return { xp, lv, gained };
}

/**
 * Settle a finished night on `base`: run the pure settle, then apply the level loop it
 * deliberately leaves to the engine, granting the per-level line packs a normal stretch
 * of catches would (economy modes only, exactly like withCatch).
 */
function applyNightSettled(base: Save, now: number): { s: Save; report: NightReport; gainedLv: number; found: number[] } {
  const { s, report } = settleNight(base, now, rng);
  const up = applyLevelUps(s.xp, s.lv);
  let lineGear = s.lineGear;
  const found: number[] = [];
  if (modeRules().economy && up.gained > 0) {
    for (let L = s.lv + 1; L <= up.lv; L++) found.push(packForLevel(L));
    for (const k of found) lineGear = givePack(lineGear, k);
  }
  return { s: { ...s, xp: up.xp, lv: up.lv, lineGear }, report, gainedLv: up.gained, found };
}

/** Advance the guided tutorial after the player really did the thing; finishing lands in finishTutorial. */
function bumpTutorial(event: TutorialEvent) {
  const st = useGame.getState();
  const tut = st.tutorial;
  if (!tut) return;
  const next = tutAdvance(tut, event);
  if (isTutorialDone(next)) {
    st.finishTutorial();
    return;
  }
  const patch: Partial<Store> = { tutorial: next };
  /* The pack step must never strand a new player: a fresh save owns no line pack and
     cannot afford one, so hand over one Bronze pack the moment the step arrives. */
  if (tutStep(next)?.id === "pack" && st.lineGear.packs.every((n) => n <= 0)) {
    patch.lineGear = givePack(st.lineGear, 0);
  }
  useGame.setState(patch);
}

/** The year the New Year midnight burst last fired for (module latch: once per year). */
let burstYear = -1;

export function stepEventsLive(now = Date.now()) {
  const s = useGame.getState();
  const on = eventModeOn(modeRules());
  /* Tournaments and Survival never run the events clock, and never touch its dice. */
  if (!on) return;
  const base = s.events.seed ? s.events : { ...s.events, seed: ((loose() * 4294967295) | 0) >>> 0 || 1 };
  const night = windowFor(s) === "night";
  const res = stepEvents(base, {
    now,
    on,
    visible: typeof document === "undefined" || document.visibilityState !== "hidden",
    active: s.screen === "game" && now - sim.lastActive <= IDLE_MS,
    night,
    biome: s.biome,
  });
  const patch: Partial<Store> = { events: res.state };
  const toasts = [...s.toasts];
  const kid = kidOn(s);
  if (res.ended) {
    pushToast(toasts, `${eventTitle(res.ended, kid)} is over.`);
    emitEventEnded(res.ended);
  }
  if (res.started) {
    pushToast(toasts, res.started.announce);
    patch.eventBanner = { id: res.started.id, at: now };
    audio.event(res.started.rarity);
    emitEventStarted(res.started);
  }
  /* Update Three: the New Year midnight burst — once a year, in the first minutes of
     Jan 1, a gift of gold equal to the new year. Latched by year so it fires once. */
  let burstFired = false;
  const nowD = new Date(now);
  if (burstDue(nowD) && burstYear !== nowD.getFullYear()) {
    burstYear = nowD.getFullYear();
    burstFired = true;
    const gift = nowD.getFullYear();
    pushToast(toasts, `Happy New Year! The midnight burst gives you ${money(gift)} gold.`);
    patch.c = s.c + gift;
    patch.tot = s.tot + gift;
    audio.fanfare();
  }
  if (res.ended || res.started || burstFired) patch.toasts = toasts.slice(-3);
  useGame.setState(patch);
  if (res.ended || res.started || burstFired) persistSoon();
}

/** Give the fish the running event's mutation, if the dice say so — and, on a holiday, the
 *  holiday's name and 50x worth (Update Three: the two systems multiply, never replace).
 *  Off in Tournaments (server replay) and Survival. */
function eventMutate(fish: Rolled): Rolled {
  const s = useGame.getState();
  if (!eventModeOn(modeRules())) return fish;
  const now = new Date();
  const act = activeEvent(s.events, now.getTime());
  if (!act && !holidayOn(now)) return fish;
  const res = applyEventsToFish(s.events, fish, act?.def ?? null, now, BIOMES[fish.b].fish[fish.i]);
  useGame.setState({ events: res.state });
  return res.fish;
}

function persistSoon() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persistNow, 400);
}

/* ── Achievements (WP-16, 12 §6): checked a moment after anything changes, never during the fight itself. ── */

export function achStats(s: Save): AchStats {
  let released = 0;
  for (const n of Object.values(s.released)) released += n;
  let epics = 0;
  for (const k of Object.keys(s.dex)) if (s.dex[k]?.c && rarityOf(Number(k.split("-")[1])) >= 3) epics += 1;
  return {
    caught: s.caught,
    species: dexCount(s.dex),
    bosses: s.bosses,
    level: s.lv,
    money: s.c,
    earned: s.tot,
    rebirths: s.rb,
    perfects: s.perfects,
    bestStreak: s.bestStreak,
    rod: s.rod,
    reel: s.reel,
    line: s.line,
    boat: s.boat,
    exhibits: s.tank.exhibits.length,
    released,
    stewards: s.stewards.species.length + s.stewards.waters.length,
    epics,
    records: Object.keys(s.records).length,
    tripsDone: s.trips.length,
    derbiesWon: s.derbiesWon,
    chapters: s.story.rewarded.length,
    kidsSpecies: dexCount(s.sideDex),
    mutated: s.ach.n["catch:mutated"] ?? 0,
    stickers: s.stickers.length,
    trophies: s.trophies.length,
  };
}

/** Unlock what is now earned and say so. A pile of old ones at once becomes a single notice. */
export function runAchievements() {
  const s = useGame.getState();
  if (!s.hydrated || s.screen !== "game") return;
  const r = checkAchievements(currentMode, achStats(s), s.ach, Date.now());
  if (!r.unlocked.length) return;
  const toasts = [...s.toasts];
  if (r.unlocked.length > 3) pushToast(toasts, `${r.unlocked.length} achievements unlocked. See the Lodge.`);
  else for (const d of r.unlocked) pushToast(toasts, `Achievement: ${d.name}. ${d.text}`);
  audio.fanfare();
  useGame.setState({ ach: r.state, toasts: toasts.slice(-3) });
  persistSoon();
}

let achTimer = 0;
function watchAchievements() {
  useGame.subscribe(() => {
    if (achTimer) return;
    achTimer = window.setTimeout(() => {
      achTimer = 0;
      runAchievements();
    }, 600);
  });
  /* WP-15 signals (src/game/event-hooks.ts): a mutated catch is an event catch; an event starting is one more event seen. */
  onMutatedCatch(() => useGame.getState().signal("event:caught", 1));
  onEventStarted(() => useGame.getState().signal("event:started", 1));
  /* Outside systems (events, mutations) report by name without importing this file: dispatch "fac:achievement". */
  window.addEventListener("fac:achievement", (e) => {
    const d = (e as CustomEvent<{ name?: string; by?: number }>).detail;
    if (d && typeof d.name === "string") useGame.getState().signal(d.name, typeof d.by === "number" ? d.by : 1);
  });
}

function bindLifecycle() {
  if (bound) return;
  bound = true;
  watchAchievements();
  const flush = () => {
    if (document.visibilityState === "hidden") persistNow();
  };
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("pagehide", persistNow);
  /* Any tap or key counts as "still here" for the events clock (it never reads what was pressed). */
  const here = () => noteActivity();
  window.addEventListener("pointerdown", here, { passive: true });
  window.addEventListener("keydown", here, { passive: true });
  audio.bind();
}

function consumeLure(s: Save): { box: Save["box"]; lure: number } {
  if (s.lure < 0) return { box: s.box, lure: -1 };
  const box = { ...s.box };
  const k = String(s.lure);
  const left = (box[k] || 0) - 1;
  if (left <= 0) {
    delete box[k];
    return { box, lure: -1 };
  }
  box[k] = left;
  return { box, lure: s.lure };
}

function consumeBait(s: Save): { baitBox: Save["baitBox"]; bait: number } {
  if (s.bait < 0) return { baitBox: s.baitBox, bait: -1 };
  const baitBox = { ...s.baitBox };
  const k = String(s.bait);
  const left = (baitBox[k] || 0) - 1;
  if (left <= 0) {
    delete baitBox[k];
    return { baitBox, bait: -1 };
  }
  baitBox[k] = left;
  return { baitBox, bait: s.bait };
}

/** Settle aquarium earnings between lastSettle and now, capped by tank tier. */
export function settleTank(s: Save, now = Date.now()): { gain: number; hours: number; tank: TankState } {
  const cap = TANK_TIERS[s.tank.tier].capHours;
  const elapsedH = Math.max(0, (now - s.tank.lastSettle) / 3_600_000);
  const hours = Math.min(elapsedH, cap);
  const rate = modeRules().economy ? tankRatePerHour(s.tank, s.dex, now) : 0;
  const gain = Math.floor(rate * hours);
  return { gain, hours, tank: { ...s.tank, lastSettle: now } };
}

function makeContract(s: Save, kind: Contract["kind"]): Contract {
  const lv = s.lv;
  const id = uid();
  if (kind === "count") return { id, kind, goal: 6, prog: 0, reward: 35 * 6 * lv, label: "Land 6 fish" };
  if (kind === "rarity")
    return { id, kind, goal: 2, prog: 0, reward: 280 * lv, label: "Land 2 rare or better", minRarity: 2 };
  if (kind === "discover") return { id, kind, goal: 1, prog: 0, reward: 220 * lv, label: "Discover a new species" };
  if (kind === "bank") {
    const goal = 150 * lv;
    return { id, kind, goal, prog: 0, reward: Math.round(goal * 0.45), label: `Sell ${money(goal)} worth` };
  }
  if (kind === "biome")
    return {
      id,
      kind,
      goal: 5,
      prog: 0,
      reward: 80 * lv,
      biome: s.biome,
      label: `Land 5 in ${BIOMES[s.biome].name}`,
    };
  return { id, kind: "boss", goal: 1, prog: 0, reward: 900 * lv, label: "Land a tide beast" };
}

function nextContract(s: Save, current: Contract[]): Contract {
  const used = new Set(current.map((c) => c.kind));
  const pool: Contract["kind"][] = ["count", "rarity", "bank", "biome", "boss"];
  if (dexCount(s.dex) < TOTAL_SPECIES) pool.push("discover");
  const open = pool.filter((k) => !used.has(k));
  const kind = (open.length ? open : pool)[(loose() * (open.length || pool.length)) | 0];
  return makeContract(s, kind);
}

function bumpCatch(list: Contract[], info: { rarity: number; biome: number; boss: boolean; discovered: boolean }) {
  return list.map((c) => {
    if (c.prog >= c.goal) return c;
    let add = 0;
    if (c.kind === "count") add = 1;
    else if (c.kind === "rarity" && info.rarity >= (c.minRarity ?? 2)) add = 1;
    else if (c.kind === "discover" && info.discovered) add = 1;
    else if (c.kind === "biome" && c.biome === info.biome) add = 1;
    else if (c.kind === "boss" && info.boss) add = 1;
    if (!add) return c;
    return { ...c, prog: Math.min(c.goal, c.prog + add) };
  });
}

function bumpBank(list: Contract[], gained: number) {
  if (gained <= 0) return list;
  return list.map((c) => (c.kind === "bank" && c.prog < c.goal ? { ...c, prog: Math.min(c.goal, c.prog + gained) } : c));
}

function pushToast(list: Toast[], text: string) {
  list.push({ id: ++toastSeq, text });
  return list.slice(-3);
}

/** The fun layer (pet, stickers, shiny, Fish of the Day, Regulars) runs in the career and Recreational. Tournaments
    score on the server and Survival keeps its own slot, so both leave it out (05 §6). */
/** The collection that opens a water's stages: the main book plus the Kids book, so Kid Mode and Super Easy
    fish still help you along even though they never enter the main book (12 §1). */
export function stageBook(s: { dex: Save["dex"]; sideDex: Save["dex"] }): Save["dex"] {
  const side = s.sideDex;
  let any = false;
  for (const _k in side) {
    void _k;
    any = true;
    break;
  }
  if (!any) return s.dex;
  const out: Save["dex"] = { ...s.dex };
  for (const [k, e] of Object.entries(side)) {
    const have = out[k];
    out[k] = have ? { c: have.c + e.c, w: Math.max(have.w, e.w), m: Math.max(have.m, e.m) } : e;
  }
  return out;
}

function funOn() {
  return funModeOn(modeRules());
}

function withCatch(
  s: Save & { toasts: Toast[] },
  fish: Rolled,
  o: { auto: boolean; perfect: boolean; frenzy: boolean; ctx?: CatchContext },
) {
  let streak = s.streak;
  let bestStreak = s.bestStreak;
  /* WP-16: the level's worth and XP multipliers, and which book this fish is written in (12 §1, §2). */
  const level = difficultyRules(currentMode, s.difficulty);
  const book = bookFor(currentMode, s.difficulty, kidActive(s.kid, modeRules()));
  const side = book === "kids";
  let scale = o.auto ? 0.4 : 1;
  if (!o.auto) {
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    if (o.perfect) scale *= 1.28;
    if (o.frenzy) scale *= 1.5;
    scale *= 1 + Math.min(streak, 12) * 0.03;
  }
  const v = Math.round(fish.v * scale * level.worth);
  const key = `${fish.b}-${fish.i}`;
  const prev = (side ? s.sideDex : s.dex)[key];
  const discovered = !prev?.c;
  /* Records are set the moment a fish lands, kept or released, with the whole story of the cast. The Kids book keeps none. */
  const isBest = !side && beatsRecord(s.records, key, fish.w, prev?.w || 0);
  const records = !side && o.ctx ? withRecord(s.records, key, fish.w, o.ctx, Date.now(), prev?.w || 0) : s.records;
  const entry = { c: (prev?.c || 0) + 1, w: Math.max(prev?.w || 0, fish.w), m: betterMutation(prev?.m || 0, fish.m) };
  const dex = side ? s.dex : { ...s.dex, [key]: entry };
  const sideDex = side ? { ...s.sideDex, [key]: entry } : s.sideDex;
  const ach = fish.m > 0 ? bumpCounter(s.ach, "catch:mutated") : s.ach;
  const item = {
    name: fish.boss ? `Tide ${fish.name}` : fish.name,
    t: fish.t,
    v,
    w: fish.w,
    i: fish.i,
    b: fish.b,
    m: fish.m,
  };
  const inv = [...s.inv, item];
  let overflow = 0;
  while (inv.length > 250) overflow += inv.shift()!.v;
  let c = s.c;
  let tot = s.tot;
  let contracts = bumpCatch(s.contracts, { rarity: fish.t, biome: fish.b, boss: fish.boss && !o.auto, discovered });
  const bookDex = side ? sideDex : dex;
  if (overflow && modeRules().economy) {
    const gained = Math.round(overflow * multOf(dex, s.rb));
    c += gained;
    tot += gained;
    contracts = bumpBank(contracts, gained);
  }
  /* WP-6: shiny, Fish of the Day and sticker pages. Cosmetic rolls use the unseeded stream, so they never move a bite. */
  const fun = funOn() && !side;
  const date = today();
  const claim = fun && !o.auto && claimsFotd(fotdFor(date, s.ub), key, s.fotdClaimed, date);
  const shiny = fun && !o.auto && rollShiny(loose);
  const shinyList = shiny && !s.shiny.includes(key) ? [...s.shiny, key] : s.shiny;
  let stickers = s.stickers;
  if (claim && !stickers.includes(frameId(key))) stickers = [...stickers, frameId(key)];
  const donePages = fun ? newPages(dex, stickers) : [];
  if (donePages.length) stickers = [...stickers, ...donePages.map(pageId)];
  const fotdClaimed = claim ? addClaim(s.fotdClaimed, date) : s.fotdClaimed;
  let xpGain = catchXp(fish.t, fish.m, fish.b, fish.boss, new Date()) * (claim ? FOTD_XP_MULT : 1);
  if (level.xp !== 1) xpGain = Math.round(xpGain * level.xp);
  let xp = s.xp + xpGain;
  let lv = s.lv;
  let gainedLv = 0;
  while (xp >= xpNeed(lv)) {
    xp -= xpNeed(lv);
    lv += 1;
    gainedLv += 1;
  }
  let mastered = s.mastered;
  const firstBoss = fish.boss && !o.auto && !mastered.includes(fish.b);
  if (firstBoss) mastered = [...mastered, fish.b];
  /* WP-14: line packs. Levels, first-time bosses and lucky catches give them; only modes with an economy do. */
  let lineGear = s.lineGear;
  const found: number[] = [];
  if (modeRules().economy && !o.auto) {
    for (let L = s.lv + 1; L <= lv; L++) found.push(packForLevel(L));
    if (firstBoss) found.push(PACK_SOURCES.boss);
    const drop = packFromCatch(fish.t, loose);
    if (drop !== null) found.push(drop);
    for (const k of found) lineGear = givePack(lineGear, k);
  }
  let derby = s.derby;
  if (derby && !o.auto && Date.now() < derby.endsAt) derby = { ...derby, score: derby.score + v };
  const toasts = [...s.toasts];
  if (discovered) pushToast(toasts, side ? `New for your Kids book. ${BIOMES[fish.b].fish[fish.i]}.` : `New species. ${BIOMES[fish.b].fish[fish.i]}.`);
  if (gainedLv) pushToast(toasts, `Level ${lv}. ${rankName(lv)}.`);
  if (found.length) pushToast(toasts, `You found ${found.length === 1 ? `a ${LINE_PACKS[found[0]].name}` : `${found.length} line packs`}. Open ${found.length === 1 ? "it" : "them"} in Tackle.`);
  const count = dexCount(bookDex);
  if (discovered && !side && MARKS.includes(count)) pushToast(toasts, `Dex ${count} of ${TOTAL_SPECIES}.`);
  if (fish.boss && !o.auto) pushToast(toasts, `${BIOMES[fish.b].name} mastered. The boss is yours.`);
  if (fish.m >= FIRST_EVENT_MUTATION && fish.m < MUTATIONS.length) {
    const ev = eventOfMutation(fish.m);
    if (ev) {
      pushToast(toasts, catchLine(fish.m, kidOn(s)));
      emitMutatedCatch({ event: ev, mutation: fish.m, species: fish.i, biome: fish.b, value: v, boss: false });
    }
  }
  if (shiny) pushToast(toasts, `A shiny ${BIOMES[fish.b].fish[fish.i]}! That is a rare sparkle.`);
  if (claim) pushToast(toasts, "Fish of the Day! Double XP and a gold frame.");
  for (const b of donePages) pushToast(toasts, `${BIOMES[b].name} page complete! You earned a page sticker.`);
  const lastCatch: LastCatch = {
    name: item.name,
    rarity: fish.t,
    species: fish.i,
    biome: fish.b,
    mutation: fish.m,
    weight: fish.w,
    value: v,
    perfect: o.perfect && !o.auto,
    boss: fish.boss && !o.auto,
    frenzy: o.frenzy && !o.auto,
    discovered,
    record: !discovered && isBest,
    shiny,
    fotd: claim,
    page: donePages.length > 0,
    book,
  };
  return {
    dex,
    sideDex,
    ach,
    records,
    inv,
    c,
    tot,
    xp,
    lv,
    contracts,
    streak: o.auto ? s.streak : streak,
    bestStreak,
    caught: s.caught + 1,
    bosses: s.bosses + (fish.boss && !o.auto ? 1 : 0),
    perfects: s.perfects + (o.perfect && !o.auto ? 1 : 0),
    mastered,
    lineGear,
    derby,
    stickers,
    shiny: shinyList,
    fotdClaimed,
    events: countLanded(s.events, fish.m),
    taught: s.taught || !o.auto,
    lastCatch,
    toasts: toasts.slice(-3),
  };
}

/** The catch bookkeeping (dex, XP, stickers, shiny, Fish of the Day), exported so tests can drive it without a fight. */
export { withCatch as applyCatch };

/** What the cast looked like, for the record book. */
function castContext(): CatchContext | undefined {
  const c = sim.cast;
  if (!c) return undefined;
  return { spot: sim.castLair ? LAIR_SPOT : c.spotId, p: c.p, weather: c.weather, window: c.window };
}

function burst(x: number, y: number, n: number, kind: Particle["kind"]) {
  const motion = useGame.getState().motion;
  const count = motion ? n : Math.min(3, n);
  for (let i = 0; i < count; i++) {
    if (sim.particles.length >= sim.cap) sim.particles.shift();
    const a = loose() * Math.PI * 2;
    const sp = 0.05 + loose() * 0.18;
    sim.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp * (kind === "splash" ? 0.45 : 1),
      vy: kind === "splash" ? -loose() * 0.25 : Math.sin(a) * sp,
      life: 0.35 + loose() * 0.45,
      max: 0.8,
      kind,
      size: 1.5 + loose() * 2.5,
    });
  }
}

function buzz(ms: number) {
  if (!useGame.getState().motion) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

function ensureSwimmers() {
  if (sim.swimmers.length) return;
  for (let i = 0; i < 5; i++) {
    sim.swimmers.push({
      x: loose(),
      y: 0.7 + loose() * 0.12,
      v: 0.035 + loose() * 0.04,
      dir: loose() < 0.5 ? -1 : 1,
      species: i * 3,
      phase: loose() * 6,
      sc: 0.75 + loose() * 0.45,
    });
  }
}

export function resetSim() {
  sim.phase = "idle";
  sim.fish = null;
  sim.trauma = 0;
  sim.hitstop = 0;
  sim.hitFlash = 0;
  sim.frenzyLeft = 0;
  sim.autoAcc = 0;
  sim.leap = null;
  sim.particles.length = 0;
  sim.perfect = false;
  sim.bossCast = false;
  sim.spinT = 0;
  sim.misses = 0;
  sim.failedFights = 0;
  sim.wins = 0;
  sim.fight = null;
  sim.down = false;
  sim.tapLeft = 0;
  sim.partner = false;
  sim.partnerTapLeft = 0;
  sim.acc = 0;
  sim.trace.length = 0;
  sim.helpGlow = false;
  sim.castT = 1;
  sim.cast = null;
  sim.waited = 0;
  sim.hinted = false;
  sim.troll = null;
}

/** Re-read Helping Hand: the green zone, the strain and the warning follow the player's streak, live. */
function applyAssist() {
  const F = sim.fight;
  if (!F) return;
  const st = useGame.getState();
  const kid = kidOn(st);
  const help = fightHelp({
    assist: effAssist(st),
    misses: sim.misses,
    failedFights: sim.failedFights,
    wins: sim.wins,
    kid,
  });
  applyHelp(F, help);
  const helping = isHelping(help, kid);
  sim.helpGlow = helping;
  if (useGame.getState().helping !== helping) useGame.setState({ helping });
}

function assistNow() {
  const s = useGame.getState();
  return helpingHand({ assist: effAssist(s), misses: 0, failedFights: sim.failedFights, wins: sim.wins });
}

/** Helping Hand is on: switched on in Settings, or Kid Mode (where the mode allows it). */
function effAssist(s: { assist: boolean; kid: boolean }) {
  const rule = level().assist;
  return assistOn(rule === "on" ? true : rule === "off" ? false : s.assist, s.kid, modeRules());
}

/** Kid Mode is in force: switched on, and this mode allows it. */
function kidOn(s: { kid: boolean }) {
  return kidActive(s.kid, modeRules());
}

/** The time-of-day window the fish feed in: the one you picked for a trip, or the real clock's. */
export function windowFor(
  s: { trip: Trip | null; followClock: boolean; weather: number },
  now: Date = new Date(),
): Window {
  /* In an event the time of day is the event's: the UTC clock, the same for every angler (06 §2.3). */
  const run = isTournament(modeRules()) ? useGame.getState().tourney : null;
  if (run) return windowAt(Math.round(serverNow(run, now.getTime())), s.weather);
  const pick = pickedWindow(s);
  return pick ?? windowNow(s.followClock, s.weather, now);
}

/** The window a Recreational trip fixed, or null for the real clock. */
export function pickedWindow(s: { trip: Trip | null }): Window | null {
  /* Survival: the game clock decides dawn, day, dusk and night (05 §5). */
  if (modeRules().survival) {
    const run = useGame.getState().survival;
    return run ? survivalWindowAt(run.min) : null;
  }
  return modeRules().trips && s.trip && s.trip.window !== "clock" ? s.trip.window : null;
}

/** The clock hour the painting should be tinted for when a window is picked; null = the real time. */
export function pickedHour(s: { trip: Trip | null }): number | null {
  if (modeRules().survival) {
    const run = useGame.getState().survival;
    return run ? Math.floor(hourOf(run.min)) : null;
  }
  const w = pickedWindow(s);
  return w ? windowHour(w) : null;
}

const ARC_SECONDS = 0.5;
/* Where the rod tip is drawn on the stage (stage-paint.ts). */
const ROD_TIP = { x: 0.78, y: 0.4 };

/** The spot the line is aimed at: the chosen one while idle, the one that was cast to otherwise. */
function aimedSpot(s: Save): Spot {
  if (sim.phase !== "idle" && sim.cast) return spotById(s.biome, sim.cast.spotId) ?? defaultSpot(s.biome);
  return resolveSpot(s.biome, s.lastSpot[s.biome]);
}

function updateBobber(dt: number) {
  const s = useGame.getState();
  const spot = aimedSpot(s);
  sim.spotId = spot.id;
  let bx: number;
  let by: number;
  if (sim.phase === "reel") {
    /* The bobber shivers with the load on the line. */
    const load = sim.fight ? sim.fight.tension : 0;
    bx = spot.x + Math.sin(sim.t * 31) * 0.003 * load;
    by = spot.y + Math.sin(sim.t * 2.1) * 0.008;
  } else {
    bx = spot.x + Math.sin(sim.t * 1.3) * 0.012;
    by = spot.y + Math.sin(sim.t * 2.1) * 0.008;
  }
  if (sim.castT < 1) {
    sim.castT = Math.min(1, sim.castT + dt / ARC_SECONDS);
    const p = 1 - (1 - sim.castT) ** 2;
    bx = ROD_TIP.x + (bx - ROD_TIP.x) * p;
    by = ROD_TIP.y + (by - ROD_TIP.y) * p - 0.16 * Math.sin(Math.PI * sim.castT);
    if (sim.castT >= 1) burst(bx, by, 9, "splash");
  } else if (sim.phase === "idle") {
    /* Picking another spot slides the bobber over instead of teleporting it. */
    const k = Math.min(1, dt * 12);
    bx = sim.bnx + (bx - sim.bnx) * k;
    by = sim.bny + (by - sim.bny) * k;
  }
  const thrash = sim.phase === "bite" ? Math.sin(sim.t * 32) * 0.012 : 0;
  sim.bnx = bx;
  sim.bny = by + thrash;
}

const LEAP_SMALL = 0.8;

function tickLeap(dt: number) {
  if (!sim.leap) return;
  sim.leap.t += dt;
  if (sim.leap.t > (sim.leap.small ? LEAP_SMALL : 0.95)) sim.leap = null;
}

function tickSwimmers(dt: number) {
  ensureSwimmers();
  for (const fish of sim.swimmers) {
    fish.x += fish.v * fish.dir * dt;
    fish.phase += dt;
    if (fish.x > 1.15) fish.dir = -1;
    if (fish.x < -0.15) fish.dir = 1;
  }
}

function tickParticles(dt: number) {
  for (let i = sim.particles.length - 1; i >= 0; i--) {
    const p = sim.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === "splash" || p.kind === "spark") p.vy += 0.35 * dt;
    if (p.life <= 0) sim.particles.splice(i, 1);
  }
}

function tickWeatherFx(dt: number) {
  const s = useGame.getState();
  if (!s.motion) return;
  const biome = s.biome;
  const weather = s.weather;
  let kind: Particle["kind"] | null = null;
  let rate = 0;
  if (weather === 1 || weather === 2) {
    kind = "rain";
    rate = weather === 2 ? 50 : 28;
  } else if (weather === 4 && biome === 9) {
    kind = "snow";
    rate = 16;
  } else if (biome === 9) {
    kind = "snow";
    rate = 8;
  } else if (biome === 12) {
    kind = "ember";
    rate = 10;
  } else if (biome === 5 || biome === 7 || biome === 8 || biome === 10) {
    kind = "bubble";
    rate = 6;
  }
  if (!kind || loose() > rate * dt) return;
  if (sim.particles.length >= sim.cap * 0.8) return;
  if (kind === "rain") {
    sim.particles.push({
      x: loose(),
      y: -0.02,
      vx: -0.05,
      vy: 0.85,
      life: 0.7,
      max: 0.7,
      kind,
      size: 8,
    });
  } else if (kind === "snow") {
    sim.particles.push({
      x: loose(),
      y: -0.02,
      vx: Math.sin(sim.t + loose()) * 0.05,
      vy: 0.12,
      life: 3,
      max: 3,
      kind,
      size: 2,
    });
  } else if (kind === "ember") {
    sim.particles.push({
      x: loose(),
      y: 0.95,
      vx: (loose() - 0.5) * 0.05,
      vy: -0.12 - loose() * 0.08,
      life: 2.2,
      max: 2.2,
      kind,
      size: 2,
    });
  } else {
    sim.particles.push({
      x: 0.15 + loose() * 0.7,
      y: 0.82,
      vx: 0,
      vy: -0.06,
      life: 2,
      max: 2,
      kind: "bubble",
      size: 2,
    });
  }
}

/** Spot, presentation, time window and match for a cast made right now (04 §3.5). */
function castNow(s: Save, lureIdx: number, baitIdx: number, lair: boolean): CastInfo & { plan: CastPlan | null; spot: Spot } {
  const spot = resolveSpot(s.biome, s.lastSpot[s.biome]);
  const rig = s.rig[s.biome] ?? DEFAULT_RIG;
  const p = presentationOf({ lure: lureIdx, sig: s.sig, bait: lair ? -1 : baitIdx }, rig);
  const window = windowFor(s);
  /* The Boss Lair is its own place: the boss is not matched to a spot. */
  const plan = lair
    ? null
    : planCast(s.biome, spot, p, s.weather, window, luckTotal(s, lureIdx, new Date()), {
        stage: stageIn(modeRules(), stageBook(s), s.biome),
        sig: sigEffect(s.sig),
        bait: baitIdx,
      });
  return { spotId: spot.id, p, window, weather: s.weather, ms: plan?.ms ?? null, avg: plan?.avg ?? 0, plan, spot };
}

function beginBite() {
  const s = useGame.getState();
  const luck = luckTotal(s, sim.castLure, new Date());
  /* Update Three tutorial: a brand-new player's first catch is always the Bluegill — plain
     and unmutated. Never on the tournament path (server-rolled), never for the auto-reel. */
  const forced =
    !sim.troll &&
    s.biome === TUTORIAL_FIRST_CATCH.biome &&
    shouldForceFirstCatch({ tutored: s.tutored, caught: s.caught, tutorialActive: !!s.tutorial });
  /* In an event the fish was rolled at the cast, from the seed (replay.ts); the server rolls the same one. */
  const fish: Rolled = forced
    ? {
        b: TUTORIAL_FIRST_CATCH.biome,
        i: TUTORIAL_FIRST_CATCH.species,
        t: rarityOf(TUTORIAL_FIRST_CATCH.species),
        m: 0,
        name: BIOMES[TUTORIAL_FIRST_CATCH.biome].fish[TUTORIAL_FIRST_CATCH.species],
        w: baseWeight(TUTORIAL_FIRST_CATCH.biome, TUTORIAL_FIRST_CATCH.species),
        v: baseValue(TUTORIAL_FIRST_CATCH.biome, TUTORIAL_FIRST_CATCH.species),
        boss: false,
      }
    : sim.troll
      ? sim.troll.roll.fish
      : eventMutate(
          rollFish(s.biome, luck, {
            boss: sim.castLair,
            stage: stageIn(modeRules(), stageBook(s), s.biome),
            sig: sigEffect(s.sig),
            bait: sim.castBait,
            match: sim.cast?.ms ?? undefined,
            sizeMul: sizeMulOf(s.stewards, s.biome),
          }),
        );
  sim.fish = fish;
  sim.phase = "bite";
  sim.biteMax = sim.troll ? sim.troll.roll.biteMax : (1300 + RODS[s.rod].zone * 8) / 1000 + assistNow().biteBonus;
  sim.biteLeft = sim.biteMax;
  sim.trauma = Math.min(1, sim.trauma + (fish.boss ? 0.85 : 0.28));
  audio.bite();
  buzz(fish.boss ? 40 : 16);
  burst(sim.bnx, sim.bny, fish.boss ? 22 : 8, "splash");
  useGame.setState({
    phase: "bite",
    message: fish.boss ? `${fish.name} rises. Hook it!` : "Bite. Hook it.",
    detail: fish.boss ? "Three phases. Keep the needle green." : "Early hooks pay more.",
  });
}


/* ── Tournaments (WP-7, docs/architecture/06) ───────────────────────────────
   In an event every cast is rolled from the event's seed (replay.ts), the fight is built from the
   event's tackle, and when the cast ends the inputs go to the server as an envelope. The player never
   waits for the verdict. Everything that decides a catch lives in replay.ts; this is only the glue. */

/** The envelopes of the run in progress, sent one at a time. Survives leaving the water so nothing is lost. */
let tqueue: EnvelopeQueue | null = null;

const replayEvent = (run: TourneyRun): ReplayEvent => ({
  id: run.event.id,
  seed: run.seed,
  water: run.water,
  startsAt: run.event.startsAt,
  rulesVersion: tourneyRules(run),
});

/** The fight/line rules version an event was made under (an event from before WP-14 has none: version 1). */
function tourneyRules(run: TourneyRun | null): number {
  return rulesVersionOf(run?.event.rulesVersion);
}

function startTourneyCast() {
  const s = useGame.getState();
  const run = s.tourney;
  if (!run || sim.phase !== "idle") return;
  const why = cantCast(run);
  if (why) {
    useGame.setState({ message: why, detail: "" });
    return;
  }
  const spot = resolveSpot(s.biome, s.lastSpot[s.biome]);
  const rig = s.rig[s.biome] ?? DEFAULT_RIG;
  const p: Presentation = { family: run.family, depth: rig.depth, retrieve: rig.retrieve };
  const at = Math.round(serverNow(run));
  const roll = rollCast(replayEvent(run), run.playerId, run.castIndex, spot.id, p, at);
  if (!roll) return;
  sim.troll = { index: run.castIndex, at, spot: spot.id, p, roll, hookMs: MISSED };
  sim.castLure = -1;
  sim.castLair = false;
  sim.bossCast = false;
  sim.castBait = -1;
  sim.perfect = false;
  sim.fxAcc = 0;
  sim.cast = { spotId: spot.id, p, window: roll.window, weather: roll.weather, ms: null, avg: 0 };
  sim.waitLeft = roll.waitSec;
  sim.waited = 0;
  sim.hinted = true; // no spot hints in an event: that is the knowledge being tested
  sim.introT = 0;
  sim.phase = "wait";
  sim.trauma = Math.min(1, sim.trauma + 0.1);
  sim.castT = s.motion ? 0 : 1;
  if (!s.motion) burst(spot.x, spot.y, 7, "splash");
  audio.cast();
  useGame.setState({ phase: "wait", message: "Line in the water.", detail: "", weather: roll.weather });
}

/** The cast is over: build its envelope, count it locally, and hand it to the queue. */
function tourneyEnd(outcome: "landed" | "lost" | "missed", fish: Rolled | null) {
  const tr = sim.troll;
  sim.troll = null;
  const run = useGame.getState().tourney;
  if (!tr || !run) return;
  const missed = outcome === "missed";
  const steps = missed ? 0 : sim.trace.reduce((a, b) => a + b, 0);
  const env: Envelope = {
    castIndex: tr.index,
    at: tr.at,
    spot: tr.spot,
    p: tr.p,
    hook: missed ? MISSED : tr.hookMs,
    inputs: missed ? [] : [...sim.trace],
    drag: sim.dragAtHook,
    released: false,
    ...(tourneyRules(run) > 1 ? { rv: tourneyRules(run) } : {}),
    claim:
      outcome === "landed" && fish
        ? { out: "landed", i: fish.i, w: fish.w, v: fish.v }
        : { out: outcome, i: 0, w: 0, v: 0 },
  };
  const cost = missed ? tr.roll.waitSec + tr.roll.biteMax : tr.roll.waitSec + tr.hookMs / 1000 + steps * FIGHT_STEP;
  const mine =
    outcome === "landed" && fish
      ? [...run.mine, { castIndex: tr.index, species: fish.i, weight: fish.w, value: fish.v }]
      : run.mine;
  useGame.setState({
    tourney: {
      ...run,
      castIndex: tr.index + 1,
      castsUsed: run.castsUsed + 1,
      secondsUsed: run.secondsUsed + cost,
      pending: run.pending + 1,
      mine,
      note: outcome === "landed" ? "Checking that catch…" : "",
    },
  });
  tqueue?.push(env);
}

/** The server has judged one envelope. Its replay is the truth; fix the local picture to match. */
function tourneyReply(eventId: string, env: Envelope, r: CatchReply) {
  const cur = useGame.getState().tourney;
  if (!cur || cur.event.id !== eventId) return;
  const good = r.verdict === "ok";
  const pending = Math.max(0, cur.pending - 1);
  const mine = good ? cur.mine : cur.mine.filter((l) => l.castIndex !== env.castIndex);
  const settled = pending === 0 && typeof r.nextCast === "number";
  if (!good && env.claim.out === "landed") useGame.getState().notify("That catch didn't verify, so it doesn't count.");
  useGame.setState({
    tourney: {
      ...cur,
      pending,
      mine,
      score: typeof r.score === "number" ? r.score : cur.score,
      rank: r.rank ?? cur.rank,
      entrants: r.entrants ?? cur.entrants,
      castsUsed: settled ? r.castsUsed : cur.castsUsed,
      secondsUsed: settled ? r.secondsUsed : cur.secondsUsed,
      castIndex: settled ? r.nextCast : cur.castIndex,
      note: verdictNote(r),
      over: cur.over || r.verdict === "banned",
    },
  });
}

/** Envelopes the server can no longer line up (or a ban): forget them and start again from its count. */
function tourneyDrop(eventId: string, env: Envelope, r: CatchReply | null) {
  const cur = useGame.getState().tourney;
  if (!cur || cur.event.id !== eventId) return;
  const last = cur.pending <= 1;
  useGame.setState({
    tourney: {
      ...cur,
      pending: Math.max(0, cur.pending - 1),
      mine: cur.mine.filter((l) => l.castIndex !== env.castIndex),
      castIndex: r && last && typeof r.nextCast === "number" ? r.nextCast : cur.castIndex,
      castsUsed: r && last && typeof r.castsUsed === "number" ? r.castsUsed : cur.castsUsed,
      secondsUsed: r && last && typeof r.secondsUsed === "number" ? r.secondsUsed : cur.secondsUsed,
      note: "Some casts could not be counted.",
    },
  });
}

/** A fresh local picture of an event from the server's join answer. */
export function runFrom(j: JoinInfo, id: string, offset: number, queued: number): TourneyRun {
  return {
    event: {
      id: j.event.id,
      kind: j.event.kind,
      title: j.event.title,
      category: j.event.category,
      castBudget: j.event.castBudget,
      fishingSeconds: j.event.fishingSeconds,
      startsAt: j.startsAt,
      endsAt: j.endsAt,
      rulesVersion: j.event.rulesVersion,
    },
    seed: j.seed,
    water: j.water,
    playerId: id,
    offset,
    castIndex: j.nextCast + queued,
    castsUsed: j.castsUsed + queued,
    secondsUsed: j.secondsUsed,
    family: "minnow",
    team: j.team ?? null,
    pending: queued,
    mine: [],
    score: j.score,
    rank: j.rank,
    entrants: j.entrants,
    note: "",
    over: false,
  };
}

/** The score for the HUD: this device's own tally while casts are waiting for a verdict, the server's after. */
export function tourneyScore(run: TourneyRun): number {
  return run.pending > 0 ? Math.max(run.score, scoreEntry(run.event.category, run.mine).score) : run.score;
}

export { castsLeft, secondsLeft };

function succeed() {
  const s = useGame.getState();
  const fish = sim.fish;
  if (!fish) return;
  tourneyEnd("landed", fish);
  const next = withCatch(s, fish, { auto: false, perfect: sim.perfect, frenzy: sim.frenzyLeft > 0, ctx: castContext() });
  /* Survival: the fish goes in the larder (not a bag to sell from), and the fight costs game time. */
  const sv = modeRules().survival && s.survival ? s.survival : null;
  const fed = sv ? advance(landFish(sv, { name: fish.name, w: fish.w, t: fish.t }), fightMinutes(hookedSeconds())) : null;
  sim.phase = "idle";
  sim.leap = { t: 0, look: fish };
  sim.fish = null;
  endFight();
  sim.trauma = Math.min(1, sim.trauma + (fish.t >= 4 || fish.boss ? 0.55 : 0.2));
  sim.hitstop = fish.t >= 3 || fish.boss ? 0.07 : 0.04;
  if (s.flash) sim.hitFlash = fish.t >= 4 || fish.boss ? 0.4 : 0.16;
  burst(sim.bnx, sim.bny, 18, "splash");
  burst(sim.bnx, sim.bny, 24, "spark");
  audio.land(fish.t);
  if (fish.m >= FIRST_EVENT_MUTATION) audio.mutant();
  sim.wins += 1;
  sim.failedFights = 0;
  sim.misses = 0;
  buzz(12);
  const lc = next.lastCatch;
  if (lc && (fish.t >= 3 || lc.discovered || lc.boss || lc.page || lc.shiny || lc.fotd)) audio.fanfare();
  if (s.pet.kind && funOn()) sim.petT = 1.4;
  useGame.setState({
    ...next,
    ...(sv ? { inv: s.inv, toasts: next.lastCatch?.discovered ? pushToast([...s.toasts], `New species. ${fish.name}.`) : s.toasts } : {}),
    helping: false,
    tension: 0,
    celebration: lc ? { catch: lc, at: Date.now() } : null,
    trip:
      lc && s.trip && modeRules().trips
        ? tripCatch(
            s.trip,
            { name: lc.name, w: lc.weight, rarity: lc.rarity, discovered: lc.discovered, record: lc.record },
            Date.now(),
          )
        : s.trip,
    phase: "idle",
    message: fish.boss ? `${fish.name} landed!` : sv ? "Landed. It goes in the larder." : "Landed. Keep it or let it go?",
    detail: sim.cast && !fish.boss ? (missNote(habitOf(fish.b, fish.i), sim.cast.p) ?? "") : "",
    lair: fish.boss ? !!s.rush : s.lair,
  });
  bumpTutorial("reel");
  if (fed) commitRun(fed);
  storyAfterCatch();
  /* Online co-op: tell the room (multiplayer.ts listens for this). */
  window.dispatchEvent(new CustomEvent("fac:catch", { detail: { name: next.lastCatch?.name, v: next.lastCatch?.value, b: fish.b, i: fish.i, w: fish.w } }));
  /* Boss Rush: a boss in the current rush water advances the gauntlet. */
  const st = useGame.getState();
  if (fish.boss && st.rush && fish.b === st.rush.list[st.rush.pos]) {
    const pos = st.rush.pos + 1;
    if (pos >= st.rush.list.length) {
      const secs = Math.round((Date.now() - st.rush.t0) / 1000);
      const best = st.rushBest && st.rushBest < secs * 1000 ? st.rushBest : secs * 1000;
      const reward = 2500 * st.rush.list.length;
      useGame.setState({
        rush: null,
        lair: false,
        rushBest: best,
        c: st.c + reward,
        tot: st.tot + reward,
        message: "Boss Rush complete!",
        detail: `${st.rush.list.length} bosses in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")} · ${money(reward)} purse`,
        toasts: pushToast([...st.toasts], "Boss Rush complete."),
      });
    } else {
      const nextBiome = st.rush.list[pos];
      useGame.setState({
        rush: { ...st.rush, pos },
        biome: nextBiome,
        lair: true,
        message: `Next: ${BIOMES[nextBiome].fish[BOSS_INDEX]}.`,
        detail: `Boss ${pos + 1} of ${st.rush.list.length}`,
        toasts: pushToast([...st.toasts], `Rush ${pos}/${st.rush.list.length}. ${BIOMES[nextBiome].name} next.`),
      });
    }
  }
  persistSoon();
}

/** Story mode: after a catch, finish every chapter whose goals are done and pay what it promised (12 §4). */
function storyAfterCatch() {
  if (currentMode !== "story") return;
  const s = useGame.getState();
  const r = advanceStory(s.story, s.dex);
  if (!r.finished.length) return;
  let c = s.c;
  let tot = s.tot;
  let ub = s.ub;
  let baitBox = s.baitBox;
  let box = s.box;
  let toasts = s.toasts;
  let message = s.message;
  let detail = s.detail;
  for (const ch of r.finished) {
    const reward = chapterReward(ch);
    c += reward.coins;
    tot += reward.coins;
    if (reward.unlockWater !== null && !ub.includes(reward.unlockWater)) ub = [...ub, reward.unlockWater];
    baitBox = { ...baitBox, [String(BOSS_CHUM_INDEX)]: (baitBox[String(BOSS_CHUM_INDEX)] ?? 0) + reward.chum };
    if (reward.lurePack !== null) box = { ...box, [String(reward.lurePack)]: (box[String(reward.lurePack)] ?? 0) + 10 };
    toasts = pushToast([...toasts], `Chapter done: ${chapterInfo(ch).title}. ${reward.lines.join(", ")}.`);
    message = chapterInfo(ch).outro;
    detail = r.state.chapter < CHAPTER_COUNT ? `Next: ${chapterInfo(r.state.chapter).title}. ${chapterInfo(r.state.chapter).intro}` : "The Story is complete. You are a legend.";
  }
  useGame.setState({ story: r.state, c, tot, ub, baitBox, box, toasts: toasts.slice(-3), message, detail });
  persistSoon();
}

/** Why a fight was lost: the pill always names the cause (pillar 3). */
type Why = "bite" | "line" | "jump" | "snap" | "gear" | "worn";

function fail(kind: "slip" | "snap", why: Why = kind === "snap" ? "snap" : "bite", note?: { message: string; detail: string }) {
  /* An event cast that ends in a loss is still a cast: it goes to the server like any other. */
  tourneyEnd(sim.fight ? "lost" : "missed", null);
  const lostFish = sim.fish;
  const wasLair = sim.castLair;
  sim.phase = "idle";
  sim.fish = null;
  sim.castLair = false;
  endFight();
  sim.trauma = Math.min(1, sim.trauma + (kind === "snap" ? 0.6 : 0.22));
  burst(sim.bnx, sim.bny, 8, "splash");
  burst(sim.bnx, sim.bny, 24, "spark");
  sim.failedFights += 1;
  sim.wins = 0;
  sim.misses = 0;
  audio.fail(kind);
  buzz(kind === "snap" ? 24 : 10);
  const s = useGame.getState();
  useGame.setState({
    helping: false,
    tension: 0,
    phase: "idle",
    streak: 0,
    lair: wasLair && !s.rush ? false : s.lair,
    message: note ? note.message : wasLair
      ? kind === "snap"
        ? "The boss snapped your line."
        : why === "jump"
          ? "The boss threw the hook."
          : "The boss shook free."
      : why === "worn"
        ? "The line wore out."
        : kind === "snap"
        ? "The line snapped."
        : why === "jump"
          ? "It jumped and threw the hook."
          : why === "line"
            ? "It got away. You gave too much line."
            : "It shook free.",
    detail: note
      ? note.detail
      : why === "worn"
        ? "Long fights wear a line down. Reel in the green to save it, or craft a stronger line."
        : why === "snap"
        ? "Too long in the red. Let go when the needle turns red."
        : why === "jump"
          ? "Next time ease off when it leaps."
          : why === "line"
            ? "Keep reeling when the line goes slack."
            : "Hook sooner next time.",
  });
  /* Survival: even a lost fight takes game time (a snapped hand line took a few seconds). */
  if (modeRules().survival) survivalFightCost(why === "gear" ? 4 : hookedSeconds());
  /* WP-16: a snapped line can cost a lure, or even the rod (Legend, and a taste on Hard). It always says so. */
  const danger = hazardsNow(useGame.getState());
  if (kind === "snap" && (why === "snap" || why === "worn") && danger !== "none" && lostFish) {
    const now = useGame.getState();
    const out = onSnap(now.hz, danger, now, { rarity: lostFish.t, boss: lostFish.boss });
    if (out.hz !== now.hz) {
      useGame.setState({ hz: out.hz, ...out.gear });
      hazardSay(out.lines);
    }
  }
  persistSoon();
}

/** Tidy the fight's loose ends whatever the ending. */
function endFight() {
  sim.fight = null;
  sim.down = false;
  sim.tapLeft = 0;
  sim.partner = false;
  sim.partnerTapLeft = 0;
  sim.acc = 0;
  sim.helpGlow = false;
  sim.spinT = 0;
}

function autoCatch() {
  const s = useGame.getState();
  if (sim.phase !== "idle" || !s.auto || !s.autoOn || isTournament(modeRules())) return;
  const castLure = s.lure;
  const spent = consumeLure(s);
  const luck = luckTotal(s, castLure, new Date());
  /* The auto-reel fishes the spot and rig you set, so knowing fish pays there too. */
  const at = castNow(s, castLure, -1, false);
  const fish = eventMutate(
    rollFish(s.biome, luck, {
      stage: stageIn(modeRules(), stageBook(s), s.biome),
      sig: sigEffect(s.sig),
      match: at.ms ?? undefined,
      sizeMul: sizeMulOf(s.stewards, s.biome),
    }),
  );
  const next = withCatch({ ...s, ...spent }, fish, {
    auto: true,
    perfect: false,
    frenzy: sim.frenzyLeft > 0,
    ctx: { spot: at.spotId, p: at.p, weather: at.weather, window: at.window },
  });
  burst(at.spot.x, at.spot.y, 6, "splash");
  audio.land(Math.min(2, fish.t));
  useGame.setState({ ...spent, ...next });
  persistSoon();
}

const TRACE_MAX = 2400;

/** Keep the message pill from being overwritten by the zone line right after an event line. */
let msgHold = 0;

const ZONE_LINE: Record<string, string> = {
  slack: "Slack line. Reel it in.",
  green: "Nice and steady.",
  high: "Pulling hard. Ease off.",
  red: "Too tight! Let go!",
};

/** Turn real frame time into fixed 50 ms fight steps (04 §5.3, 06 §1.4), then react to what happened. */
function tickFight(dt: number) {
  const F = sim.fight;
  if (!F || !sim.fish) return;
  msgHold = Math.max(0, msgHold - dt);
  sim.acc = Math.min(sim.acc + dt, FIGHT_STEP * 6);
  let stepped = false;
  while (sim.acc >= FIGHT_STEP && !F.result) {
    sim.acc -= FIGHT_STEP;
    const held = sim.down || sim.tapLeft > 0;
    if (sim.tapLeft > 0) sim.tapLeft--;
    F.partner = sim.partner || sim.partnerTapLeft > 0;
    if (sim.partnerTapLeft > 0) sim.partnerTapLeft--;
    if (sim.trace.length < TRACE_MAX) pushTrace(sim.trace, held);
    stepFight(F, held, FIGHT_STEP);
    stepped = true;
  }
  if (stepped) reactToFight(F);
}

function say(message: string, detail?: string, hold = 1.3) {
  msgHold = hold;
  if (detail !== undefined) sim.shownDetail = "";
  useGame.setState(detail === undefined ? { message } : { message, detail });
}

/** Sounds, haptics, coaching and the pill: everything the player feels that is not the rules. */
function reactToFight(F: Fight) {
  const fish = sim.fish;
  if (!fish) return;
  const seen = sim.seen;
  if (F.style !== seen.style) {
    /* Boss phases 2 and 3: the ring spins half a turn so you can see the fake-out coming. */
    seen.style = F.style;
    sim.spinT = 0.22;
    sim.trauma = Math.min(1, sim.trauma + 0.15);
    buzz(30);
    say(F.style === "thrasher" ? `${fish.name} thrashes!` : "The run. Hold on!", COACH[F.style].warn, 1.6);
  }
  if (F.warns > seen.warns) {
    seen.warns = F.warns;
    buzz(30);
    audio.warn();
    if (sim.coach) say(COACH[F.warn === "jump" ? "jumper" : "runner"].warn);
  }
  if (F.runs > seen.runs) {
    seen.runs = F.runs;
    sim.trauma = Math.min(1, sim.trauma + 0.12);
    burst(sim.bnx, sim.bny, 6, "splash");
  }
  if (F.jumps > seen.jumps) {
    seen.jumps = F.jumps;
    sim.leap = { t: 0, look: fish, small: true };
    burst(sim.bnx, sim.bny, 10, "splash");
    audio.tick();
    if (sim.coach) say(COACH.jumper.warn, undefined, 1);
  }
  if (F.reds > seen.reds) {
    seen.reds = F.reds;
    sim.misses += 1;
    applyAssist();
    sim.trauma = Math.min(1, sim.trauma + 0.2);
    audio.miss();
    buzz(15);
  }
  if (F.ticks > seen.ticks) {
    seen.ticks = F.ticks;
    sim.bandFlash = 0.08;
    audio.tick();
    buzz(10);
    burst(sim.bnx, sim.bny, 4, "spark");
  }
  const frozen = F.freeze > 0;
  if (frozen && !seen.freeze) say("Frost grips the needle!", "It will thaw. Don't trust it.", 1.2);
  seen.freeze = frozen;
  const still = F.still > 0;
  if (still && !seen.still) say("The Emperor goes still…", "Something is coming.", 1.6);
  seen.still = still;
  const surge = F.surge > 0;
  if (surge && !seen.surge) {
    sim.trauma = Math.min(1, sim.trauma + 0.3);
    buzz(30);
    say("It erupts! Let go!", undefined, 1.2);
  }
  seen.surge = surge;

  /* The pill's colour follows the needle: calm · amber · red (09 §3.1). */
  const zone = zoneOf(F);
  const bucket: 0 | 1 | 2 = zone === "red" ? 2 : zone === "high" ? 1 : 0;
  const st = useGame.getState();
  if (bucket !== st.tension) useGame.setState({ tension: bucket });
  if (msgHold <= 0 && st.message !== ZONE_LINE[zone]) useGame.setState({ message: ZONE_LINE[zone] });
  const detail = `Line ${linePercent(F)}% · ${Math.round(progressOf(F) * 100)}% in`;
  if (msgHold <= 0 && detail !== sim.shownDetail) {
    sim.shownDetail = detail;
    useGame.setState({ detail });
  }

  if (F.result === "landed") succeed();
  else if (F.result === "snap") {
    if (F.worn) lossHooks().loseLure?.("worn");
    fail("snap", F.worn ? "worn" : "snap");
  }
  else if (F.result === "slip") fail("slip", F.dist >= 1.3 ? "line" : "jump");
}

export function frame(dt: number) {
  const s = useGame.getState();
  if (!s.hydrated) return;
  sim.t += dt;
  sim.cap = tierSpec(s.tier).particles;
  if (sim.spinT > 0) sim.spinT = Math.max(0, sim.spinT - dt);
  if (sim.bandFlash > 0) sim.bandFlash = Math.max(0, sim.bandFlash - dt);
  sim.trauma = Math.max(0, sim.trauma - dt * 1.7);
  sim.hitFlash = Math.max(0, sim.hitFlash - dt * 2.4);
  sim.flashA = Math.max(0, sim.flashA - dt * 1.6);
  updateBobber(dt);
  tickParticles(dt);
  tickWeatherFx(dt);
  tickLeap(dt);
  tickSwimmers(dt);
  if (sim.introT > 0) sim.introT = Math.max(0, sim.introT - dt);

  /* Aquarium settlement every ~30s of play (offline time settles at hydrate). */
  sim.evAcc += dt;
  if (sim.evAcc >= 1) {
    sim.evAcc = 0;
    stepEventsLive();
    sim.evSave += 1;
    if (sim.evSave >= 20) {
      sim.evSave = 0;
      persistSoon();
    }
  }
  sim.settleAcc += dt;
  if (sim.settleAcc >= 30) {
    sim.settleAcc = 0;
    const cur = useGame.getState();
    if (cur.tank.exhibits.length) {
      const { gain, tank } = settleTank(cur);
      if (gain > 0) useGame.setState({ tank, c: cur.c + gain, tot: cur.tot + gain });
      else if (tank.lastSettle !== cur.tank.lastSettle) useGame.setState({ tank });
    }
  }

  /* WP-16: the Legend-difficulty tank checks (a fish jumps out, a visitor complains or sues), about once a second. */
  sim.hzAcc += dt;
  if (sim.hzAcc >= 1) {
    sim.hzAcc = 0;
    tickTankHazards();
  }

  /* Derby: the Regulars cast over time (seeded, real fishing model); expiry pays the purse and files the head-to-head. */
  if (s.derby) {
    const now = Date.now();
    if (now >= s.derby.endsAt) {
      const done = stepDerby(s.derby, s.derby.endsAt);
      const rank = derbyRank(done.score, done.rivals);
      const won = rank === 1;
      const reward = won ? 400 + 60 * s.lv : 0;
      const fun = funOn();
      useGame.setState((st) => ({
        derby: null,
        derbiesWon: st.derbiesWon + (won ? 1 : 0),
        c: st.c + reward,
        tot: st.tot + reward,
        rivalRecord: fun ? recordDerby(st.rivalRecord, done.score, done.rivals) : st.rivalRecord,
        toasts: pushToast(
          pushToast([...st.toasts], won ? `Derby won! ${money(reward)} purse.` : `Derby over. You placed #${rank}.`),
          derbyEndLine(done.score, done.rivals),
        ),
      }));
      persistSoon();
    } else {
      sim.fxAcc += dt;
      if (sim.fxAcc >= 1) {
        sim.fxAcc = 0;
        useGame.setState((st) => (st.derby ? { derby: stepDerby(st.derby, Date.now()) } : {}));
      }
    }
  }
  if (s.flash && s.motion && s.weather === 2 && loose() < dt * 0.22) sim.flashA = 0.5;

  if (sim.frenzyLeft > 0) sim.frenzyLeft = Math.max(0, sim.frenzyLeft - dt);
  if (sim.petT > 0) sim.petT = Math.max(0, sim.petT - dt);
  const shown = Math.ceil(sim.frenzyLeft);
  if (shown !== sim.shownFrenzy) {
    sim.shownFrenzy = shown;
    useGame.setState({ frenzyLeft: sim.frenzyLeft });
  }

  if (sim.hitstop > 0) {
    sim.hitstop -= dt;
    return;
  }

  if (sim.phase === "wait") {
    sim.waitLeft -= dt;
    sim.waited += dt;
    /* A long quiet wait: one hint per cast about the best fish you have not caught here (04 §3.6). */
    if (!sim.hinted && sim.cast && !sim.castLair && sim.waited >= hintAfter(kidOn(s), HINT_AFTER) && sim.waitLeft > 0.6) {
      sim.hinted = true;
      const c = sim.cast;
      const spot = spotById(s.biome, c.spotId);
      const hint = spot
        ? hintForCast(s.biome, spot, c.p, c.weather, c.window, stageIn(modeRules(), stageBook(s), s.biome), (i) => !!s.dex[`${s.biome}-${i}`]?.c)
        : null;
      if (hint) useGame.setState({ message: hint, detail: "Quiet here." });
    }
    if (sim.waitLeft <= 0) beginBite();
  } else if (sim.phase === "bite") {
    sim.biteLeft -= dt;
    if (sim.biteLeft <= 0) fail("slip");
  } else if (sim.phase === "reel" && sim.fish && sim.fight) {
    tickFight(dt);
  }

  /* An event has one sky for everybody: the seeded chain, looked up once a second (06 §2.3). */
  if (s.tourney) {
    sim.tAcc += dt;
    if (sim.tAcc >= 1) {
      sim.tAcc = 0;
      const wx = weatherAt(s.tourney.seed, serverNow(s.tourney) - s.tourney.event.startsAt);
      if (wx !== s.weather && sim.phase === "idle") useGame.setState({ weather: wx });
    }
  }
  sim.weatherAcc += dt;
  /* Survival's sky comes from the run's seed (survival.ts), not from this timer. */
  if (sim.weatherAcc >= 45 && !modeRules().survival) {
    if (sim.phase === "bite" || sim.phase === "reel") sim.weatherAcc = 45;
    else {
      sim.weatherAcc = 0;
      const tr = modeRules().trips ? s.trip : null;
      /* A trip can fix the weather. A picked time of day also keeps "Night" weather out of daytime. */
      if (!s.tourney && (!tr || tr.weather < 0)) useGame.setState({ weather: (rng() * (tr && tr.window !== "clock" ? 4 : 5)) | 0 });
    }
  }

  if (sim.phase === "idle") {
    sim.calmAcc += dt;
    if (sim.calmAcc >= 70) {
      sim.calmAcc = 0;
      if (!s.tourney && sim.frenzyLeft <= 0 && !modeRules().survival && rng() < 0.42) {
        sim.frenzyLeft = 26;
        sim.shownFrenzy = 26;
        audio.frenzy();
        useGame.setState((st) => ({
          frenzyLeft: 26,
          toasts: pushToast([...st.toasts], "Feeding frenzy."),
        }));
      }
    }
    if (s.auto && s.autoOn) {
      sim.autoAcc += dt;
      const need = Math.max(2, 7 - REELS[s.reel].speed * 0.4);
      if (sim.autoAcc >= need) {
        sim.autoAcc = 0;
        autoCatch();
      }
    }
  }
}

/** The fish just landed has no decision yet, and this mode makes you decide (12 §7). */
function choicePending(): boolean {
  const s = useGame.getState();
  return !!s.celebration && choosesFish(modeRules()) && !s.autoKeep;
}

export const PENDING_FISH = "You haven't chosen what to do with this fish yet.";

/** Say so, in the pill and as a notice (never twice in a row). */
function nagChoice() {
  const st = useGame.getState();
  const last = st.toasts[st.toasts.length - 1];
  useGame.setState({
    message: PENDING_FISH,
    detail: "Keep it or let it go (K or R), then you can cast.",
    ...(last?.text === PENDING_FISH ? {} : { toasts: pushToast([...st.toasts], PENDING_FISH) }),
  });
}

/** How hard the water is for this save: the difficulty row in force (12 §2). */
function level(s: { difficulty: Difficulty } = useGame.getState()) {
  return difficultyRules(currentMode, s.difficulty);
}

/** Which Legend-difficulty dangers are on right now: none in Kid Mode, Tournament, Recreational, Survival, Co-op or Story. */
function hazardsNow(s: { difficulty: Difficulty; kid: boolean } = useGame.getState()) {
  return hazardLevelFor(currentMode, level(s).hazards, kidOn(s));
}

/** Tell the player what a danger took (pill and notices) in plain English. */
function hazardSay(lines: string[]) {
  if (!lines.length) return;
  const st = useGame.getState();
  let toasts = st.toasts;
  for (const line of lines) toasts = pushToast([...toasts], line);
  useGame.setState({ toasts, message: lines[lines.length - 1], detail: "" });
}

function startCast() {
  let s = useGame.getState();
  if (sim.phase !== "idle") return;
  noteActivity();
  audio.unlock();
  if (isTournament(modeRules())) return startTourneyCast();
  if (choicePending()) return nagChoice();
  /* Survival: no cast in the dark or after the run, and every cast rolls from the run's own seed. */
  if (modeRules().survival) {
    if (survivalBlocksCast()) return;
    const run = s.survival!;
    setRng(makeRng(seedFrom("cast", run.seed, run.casts)));
  }
  const inRush = !!s.rush;
  const lair = s.lair && (stageIn(modeRules(), stageBook(s), s.biome) >= 3 || inRush);
  if (s.lair && !lair) {
    useGame.setState((st) => ({
      lair: false,
      toasts: pushToast([...st.toasts], "The Lair is sealed — catch every other species here first."),
    }));
    return;
  }
  let baitBox = s.baitBox;
  if (lair && !inRush) {
    if (!((baitBox[String(BOSS_CHUM_INDEX)] || 0) > 0)) {
      useGame.setState((st) => ({
        toasts: pushToast([...st.toasts], "You need Boss Chum to fish the Lair."),
      }));
      return;
    }
    baitBox = { ...baitBox, [String(BOSS_CHUM_INDEX)]: baitBox[String(BOSS_CHUM_INDEX)] - 1 };
    if (baitBox[String(BOSS_CHUM_INDEX)] <= 0) delete baitBox[String(BOSS_CHUM_INDEX)];
  }
  /* WP-16: the boat and the wallet can be lost as you cast (Legend, and a taste on Hard). */
  const danger = hazardsNow(s);
  if (danger !== "none") {
    const out = onCast(s.hz, danger, s, { weather: s.weather, biome: s.biome });
    if (out.hz !== s.hz) {
      useGame.setState({ hz: out.hz, ...out.gear });
      hazardSay(out.lines);
      s = useGame.getState();
    }
  }
  sim.castLure = s.lure;
  sim.castLair = lair;
  sim.bossCast = lair;
  sim.castBait = lair ? -1 : s.bait;
  sim.perfect = false;
  sim.fxAcc = 0;
  const spentLure = consumeLure(s);
  const spent = lair ? { ...spentLure, baitBox } : { ...spentLure, ...consumeBait(s) };
  const lureSpeed = sim.castLure >= 0 ? LURES[sim.castLure].speed : 0;
  let factor = Math.max(0.25, 1 - REELS[s.reel].speed * 0.04 - s.boat * 0.04 - lureSpeed / 100 - WEATHER[s.weather].bite);
  const fx = sigEffect(s.sig);
  if (fx?.kind === "bite") factor *= fx.mult;
  if (sim.castBait === 0) factor *= 0.85;
  factor *= modeRules().biteSpeed * level(s).biteSpeed;
  if (s.survival && modeRules().survival) factor *= biteMul(s.survival);
  /* WP-2: the better the spot and rig suit the fish around, the sooner they bite. */
  const at = castNow(s, sim.castLure, sim.castBait, lair);
  sim.cast = { spotId: at.spotId, p: at.p, window: at.window, weather: at.weather, ms: at.ms, avg: at.avg };
  if (at.plan) factor *= at.plan.wait;
  sim.waitLeft = Math.max(0.7, ((1200 + rng() * 2800) / 1000) * factor);
  sim.waited = 0;
  sim.hinted = false;
  sim.hookT = -1;
  /* Survival: the cast costs game time, 12 minutes plus 4 for every second you wait. */
  if (modeRules().survival && !survivalChargeCast(sim.waitLeft)) return;
  sim.introT = lair ? sim.waitLeft + 1.2 : 0;
  sim.phase = "wait";
  sim.trauma = Math.min(1, sim.trauma + 0.1);
  /* The bobber flies from the rod tip to the spot, then splashes (updateBobber). */
  sim.castT = s.motion ? 0 : 1;
  if (!s.motion) burst(at.spot.x, at.spot.y, 7, "splash");
  audio.cast();
  useGame.setState({
    ...spent,
    phase: "wait",
    message: lair ? "Something enormous is circling…" : "Line in the water.",
    detail: lair ? "The Boss Chum is working." : "",
  });
  persistSoon();
}

function hook() {
  const s = useGame.getState();
  const fish = sim.fish;
  if (!fish || sim.phase !== "bite") return;
  const elapsed = sim.biteMax - sim.biteLeft;
  sim.perfect = elapsed < 0.4;
  sim.phase = "reel";
  sim.misses = 0;
  sim.spinT = 0;
  /* Survival: a hand line cannot hold a big fish. It snaps, and the pill says what to make. */
  const sv = modeRules().survival ? s.survival : null;
  const tooBig = sv ? gearGate(sv.gear, fish.t) : null;
  if (tooBig) {
    fail("snap", "gear", { message: tooBig, detail: GATE_TIP });
    return;
  }
  sim.hookT = sim.t;
  const habit = habitOf(fish.b, fish.i);
  const fx = sigEffect(s.sig);
  /* Gear still matters: a better rod widens the green, a better reel gains line faster, a
     stronger line takes more strain, and a calm lure takes some fight out of the fish. */
  let pullMul = 1;
  if (stageIn(modeRules(), stageBook(s), s.biome) === 2) pullMul *= 1.1;
  pullMul *= modeRules().fightSpeed * level(s).fightSpeed;
  let bandPad = Math.max(0, RODS[s.rod].zone - 18) * 0.0015 + level(s).forgiveness * 0.005;
  if (fx?.kind === "calm") {
    pullMul *= Math.sqrt(fx.speed);
    bandPad += fx.zone * 0.004;
  }
  /* In an event the fight is built from the event's tackle and the cast's seed, exactly as the server builds it. */
  if (sim.troll) sim.troll.hookMs = Math.max(0, Math.round(elapsed * 1000));
  /* Line wear (10 §1): the line's health, and how forgiving this mode is. `difficulty` is WP-16's hook (1 = normal). */
  const tierHealth = healthOf(s.line);
  const lineHealth = sv ? healthOf(0) * holdMulOfGear(sv.gear) : tierHealth;
  const wearMul = wearMulFor({ recreational: modeRules().id === "recreational", kid: kidOn(s), difficulty: difficultyRules(modeRules().id, s.difficulty).lineDrain * difficulty.wear });
  const F = sim.troll
    ? newFight(fightInitOf(sim.troll.roll, s.drag, tourneyRules(s.tourney)))
    : newFight({
        seed: (rng() * 4294967296) >>> 0,
        rarity: fish.t,
        style: habit.fight,
        stamina: habit.stamina,
        boss: fish.boss,
        biome: fish.b,
        hold: sv ? LINES[0].hold * holdMulOfGear(sv.gear) : LINES[s.line].hold,
        reelSpeed: REELS[s.reel].speed,
        drag: s.drag,
        pullMul,
        bandPad: sv ? bandPad + bandPadOfGear(sv.gear) : bandPad,
        lineHealth,
        wearMul,
      });
  sim.fight = F;
  sim.dragAtHook = s.drag;
  sim.down = false;
  sim.tapLeft = 0;
  sim.partner = false;
  sim.partnerTapLeft = 0;
  sim.acc = 0;
  sim.trace.length = 0;
  sim.seen = { warns: 0, runs: 0, jumps: 0, reds: 0, ticks: 0, freeze: false, still: false, surge: false, style: F.style };
  sim.shownDetail = "";
  msgHold = 0;
  const met = s.coached[habit.fight] ?? 0;
  const kid = kidOn(s);
  sim.coach = fish.boss ? kid || s.bosses < 3 : coachAlways(kid, met, COACH_FIGHTS);
  applyAssist();
  if (sim.perfect) {
    sim.hitstop = 0.06;
    sim.trauma = Math.min(1, sim.trauma + 0.4);
    audio.perfect();
  } else audio.hook();
  useGame.setState({
    phase: "reel",
    coached: fish.boss ? s.coached : { ...s.coached, [habit.fight]: met + 1 },
    message: sim.perfect ? "Perfect hook." : "Hooked.",
    detail: sim.coach && !fish.boss ? COACH[habit.fight].start : "Hold to reel. Let go when the needle turns red.",
  });
  msgHold = 2.2;
  if (!fish.boss) persistSoon();
}

/* ── The reel (04 §5.2): hold to reel, let go to give line, a tap is a short hold ─── */

/** Press: the reel is held until `reelUp`. A quick tap still holds for TAP_STEPS steps. */
export function reelDown() {
  audio.unlock();
  if (sim.phase !== "reel") return;
  sim.down = true;
  sim.tapLeft = TAP_STEPS;
}

export function reelUp() {
  sim.down = false;
}

/** A tap with no press/release pair (a programmatic nudge): a short hold. */
function reelTap() {
  if (sim.phase === "reel") sim.tapLeft = TAP_STEPS;
}

export function act() {
  audio.unlock();
  if (sim.phase === "idle") startCast();
  else if (sim.phase === "bite") hook();
  else if (sim.phase === "reel") reelTap();
}

/** Local co-op: player 2 holds the reel too (J key / Assist button) and adds 0.2 to the reel. */
export function partnerDown() {
  if (sim.phase !== "reel") return;
  sim.partner = true;
  sim.partnerTapLeft = TAP_STEPS;
}

export function partnerUp() {
  sim.partner = false;
}

/** A single tap from player 2. */
export function assistTap() {
  if (sim.phase !== "reel") return;
  sim.partnerTapLeft = TAP_STEPS;
  useGame.setState({ message: "Partner assist!" });
  msgHold = 0.8;
}

/** Looser or tighter drag, during a fight or between them ([ and ] keys, the −/+ buttons). */
export function nudgeDrag(delta: -1 | 1) {
  const s = useGame.getState();
  const drag = Math.min(2, Math.max(0, s.drag + delta)) as Drag;
  if (drag === s.drag) return;
  /* The drag a fight began with is the drag it is replayed with (06 §1.3). */
  if (sim.troll && sim.fight) return;
  if (sim.fight) sim.fight.drag = drag;
  useGame.setState({ drag });
  persistSoon();
}

/** The old panel names open the pause menu (the Hub) at the matching tab; "cast" closes it (WP-10). */
function syncHub(tab: Tab, lodgeView: LodgeView) {
  const target = hubTargetFor(tab, lodgeView);
  const hub = useHubUi.getState();
  if (!target) return hub.closeHub();
  /* The same request lands on the tab this mode (or the main menu) really has for it. */
  const st = useGame.getState();
  const to = resolveHubTarget(tabsFor(st.screen, st.mode), target.tab, target.item);
  hub.openHub(to.tab, to.item);
}

/* ── Graphics level (WP-10) ───────────────────────────────────────────────── */

/** What Auto settled on in this session (the speed test, or the governor stepping). Pinned levels never use it. */
let sessionLevel: Level | null = null;

function levelFor(pref: GfxPref): Level {
  if (pref !== "auto") return pref;
  if (sessionLevel) return sessionLevel;
  const d = readDevice();
  return resolveLevel("auto", formOf(d), d.mem, d.cores, probedLevel());
}

function levelPatch(level: Level): { level: Level; tier: Gfx } {
  setActiveLevel(level);
  return { level, tier: LEVEL_TIER[level] };
}

/** The start-up speed test finished: Auto takes its result, unless the governor has already moved it. */
export function applySpeedTest() {
  const s = useGame.getState();
  if (s.gfx !== "auto" || sessionLevel) return;
  const next = levelFor("auto");
  if (next !== s.level) useGame.setState(levelPatch(next));
}

type Ui = {
  hydrated: boolean;
  tab: Tab;
  phase: Phase;
  message: string;
  detail: string;
  armRebirth: boolean;
  armReset: boolean;
  toasts: Toast[];
  lastCatch: LastCatch | null;
  pull: string;
  frenzyLeft: number;
  screen: "menu" | "game";
  mode: Mode;
  lodgeView: LodgeView;
  welcomeBack: { gain: number; hours: number } | null;
  /** Update Three: what night fishing caught while the game was closed (or on Collect). */
  nightBack: NightReport | null;
  /** Update Three: the guided tutorial's step machine while it runs (never saved; only `tutored` is). */
  tutorial: TutorialState | null;
  /** WP-15: the "something is happening" announcement, shown for a few seconds when an event starts. */
  eventBanner: { id: string; at: number } | null;
  /* WP-1 */
  tier: Gfx;
  /** WP-10: the named quality level in force (the tier above is what it draws with). */
  level: Level;
  celebration: { catch: LastCatch; at: number } | null;
  photo: boolean;
  helping: boolean;
  /** Line strain, 0 calm · 1 strained · 2 about to snap (colours the message pill). */
  tension: 0 | 1 | 2;
  /* WP-4 */
  /** The card shown when a trip ends (Recreational). */
  tripCard: { trip: Trip; lines: string[] } | null;
  /** First launch: ask "Who's fishing today?". */
  askWho: boolean;
  /** Kid Mode "Are you sure?": which sale is waiting for its second tap. */
  armSell: string;
  /* WP-5 (Survival only; never part of the career Save, it lives in fac-ultra-survival) */
  /** The run in progress, or null when none has been started. */
  survival: SurvivalRun | null;
  /** Finished runs and the last water picked. */
  sMeta: SurvivalMeta;
  /* WP-7 */
  /** The event being fished (null outside the Tournament mode). Never saved: the server keeps the record. */
  tourney: TourneyRun | null;
  /** The event list is open over the menu. */
  lobby: boolean;
};

type Store = Save &
  Ui & {
    setTab: (tab: Tab) => void;
    /** Survival: start a run on a water, as today's daily challenge or a free run. */
    beginRun: (water: number, daily: boolean) => void;
    /** Survival: start the finished run again from the same seed. */
    retryRun: () => void;
    /** Survival: leave the finished run and pick a new one. */
    leaveRun: () => void;
    /** Survival: after the rescue boat, keep going. */
    continueRun: () => void;
    /** Survival camp: eat a fish from the larder, raw or cooked. */
    campEat: (index: number, how: Meal) => void;
    campSmoke: (index: number) => void;
    campLog: () => void;
    campGather: () => void;
    campSleep: () => void;
    campCraft: (id: RecipeId) => void;
    setScreen: (screen: "menu" | "game") => void;
    /** WP-12: save, drop any line in the water and go back to the main menu. Nothing in the save changes. */
    leaveToMenu: () => void;
    setLodgeView: (view: LodgeView) => void;
    switchMode: (mode: Mode) => void;
    dismissWelcome: () => void;
    dismissNightBack: () => void;
    /* Update Three */
    claimPromo: (raw: string) => { ok: boolean; message: string };
    startNightFishing: () => void;
    collectNight: () => void;
    prestigeNow: () => void;
    tutorialNext: () => void;
    finishTutorial: () => void;
    maybeStartTutorial: () => void;
    dismissEventBanner: () => void;
    dismissToast: (id: number) => void;
    notify: (text: string) => void;
    buyGear: (kind: GearKind, index: number) => void;
    buyAuto: () => void;
    toggleAuto: () => void;
    buyPack: (index: number) => void;
    /* WP-14: the line workshop. Lines are crafted and found in packs, never sold. */
    equipLine: (tier: number) => void;
    craftLine: (tier: number) => void;
    openLinePack: (kind: number) => void;
    equipLure: (index: number) => void;
    buySig: (index: number) => void;
    equipSig: (index: number) => void;
    buyBait: (index: number) => void;
    equipBait: (index: number) => void;
    setLair: (on: boolean) => void;
    /** Aim at another spot in this water (idle only). */
    setSpot: (id: string) => void;
    /** Change depth and/or retrieve for this water (idle only). */
    setRig: (patch: Partial<Rig>) => void;
    addExhibit: (key: string) => void;
    removeExhibit: (key: string) => void;
    togglePed: (key: string) => void;
    autoStock: () => void;
    feedTank: () => void;
    buyTankTier: () => void;
    buyGift: () => void;
    buyLight: (biome: number) => void;
    startDerby: () => void;
    startRush: () => void;
    sellOne: (index: number) => void;
    sellUpTo: (maxRarity: number) => void;
    travel: (index: number) => void;
    claim: (id: string) => void;
    pin: (key: string) => void;
    rebirth: () => void;
    wipe: () => void;
    toggleSetting: (key: "sound" | "motion" | "flash" | "assist" | "followClock" | "cb" | "autoKeep") => void;
    /* WP-16 (12 §5): save slots. The slot picker calls these; the cloud follows each slot by its own id. */
    /** Open a slot that has been made (Expedition and Story have three each). */
    openSlot: (mode: Mode, slot: number) => void;
    /** Make a new slot: a name and (Expedition only) a difficulty. Refuses a slot that already holds a game. */
    createSlot: (mode: Mode, slot: number, name: string, difficulty: Difficulty) => boolean;
    renameSlot: (mode: Mode, slot: number, name: string) => void;
    /** Delete a slot for good (the picker asks first). */
    deleteSlot: (mode: Mode, slot: number) => void;
    /* WP-16 (12 §3): answering the Legend-difficulty dangers. */
    /** Put the fish that jumped out of the tank back in. */
    putFishBack: () => void;
    /** Bring a sunk boat back up, for a price. */
    raiseBoat: () => void;
    /** Report something for the achievements by name (events and other systems call this; see achievements.ts). */
    signal: (name: string, by?: number) => void;
    /** WP-6: ambience volume, 0 to 100. */
    setVolume: (v: number) => void;
    /** WP-6: pick (or change) the pet. Opens at level 5. */
    choosePet: (kind: PetKind) => void;
    /** WP-6: take the lure the pet brought (once an hour). */
    claimGift: () => void;
    /** Kid Mode on or off (a device setting, shared by every mode that allows it). */
    setKid: (on: boolean) => void;
    /** First-launch answer to "Who's fishing today?". */
    answerWho: (who: "kid" | "grown" | "both") => void;
    /** Recreational: begin a trip on a water, at a time of day, in a weather. */
    beginTrip: (water: number, window: TripWindow, weather: number) => void;
    /** Recreational: pack up. Shows the trip card, empties the creel, files the trip in the logbook. */
    endTrip: () => void;
    dismissTripCard: () => void;
    setGfx: (pref: GfxPref) => void;
    /** WP-10: the governor moved Auto to another level (never called for a pinned level). */
    governLevel: (level: Level) => void;
    setDrag: (drag: Drag) => void;
    dismissCelebration: () => void;
    /** Keep the fish just landed (the default; the card also does this by itself after 6 s). */
    keepCatch: () => void;
    /** Let the fish just landed go: no bag, no sale, 20% more XP, and a step toward Steward. */
    releaseCatch: () => void;
    /** Open or close the event list over the menu. */
    openLobby: () => void;
    closeLobby: () => void;
    /** Go to the water for an event the server just let us join. */
    enterEvent: (join: JoinInfo, offset: number) => void;
    /** The tackle for the event (idle only). */
    setFamily: (family: TourneyRun["family"]) => void;
    /** Leave the event screen. The server keeps what it has counted. */
    leaveEvent: () => void;
    /** WP-8: ask the server how your finished events went and file the medals, titles and history. */
    syncTrophies: (quiet?: boolean) => Promise<void>;
    /** WP-8: pick a bobber skin you have earned. */
    setSkin: (id: SkinId) => void;
    importSave: (raw: unknown) => boolean;
    exportCode: () => string;
    importCode: (code: string) => boolean;
  };

export const useGame = create<Store>((set, get) => ({
  ...fresh(),
  hydrated: false,
  tab: "cast",
  phase: "idle",
  message: "Ready to cast.",
  detail: "",
  armRebirth: false,
  armReset: false,
  toasts: [],
  lastCatch: null,
  pull: "",
  frenzyLeft: 0,
  screen: "menu",
  mode: "expedition",
  lodgeView: "record",
  welcomeBack: null,
  nightBack: null,
  tutorial: null,
  eventBanner: null,
  tier: "full",
  level: "ultra",
  celebration: null,
  photo: false,
  helping: false,
  tension: 0,
  tripCard: null,
  askWho: false,
  armSell: "",
  survival: null,
  sMeta: freshMeta(),
  beginRun: (water, daily) => {
    if (!modeRules().survival || sim.phase !== "idle") return;
    const w = SURVIVAL_WATERS.includes(water) ? water : 0;
    const date = localDate();
    const seed = daily ? dailySeed(date, w) : (loose() * 4294967296) >>> 0;
    const run = newRun(w, seed, daily, date);
    resetSim();
    set({
      survival: run,
      sMeta: { ...get().sMeta, lastWater: w },
      biome: w,
      weather: run.weather,
      tab: "cast",
      celebration: null,
      message: "Day 1. You are on your own. Cast a line.",
      detail: daily ? "Today's challenge: everyone gets the same sky." : "A free run: your own sky.",
    });
    persistNow();
  },
  retryRun: () => {
    const r = get().survival;
    if (!modeRules().survival || !r?.over || sim.phase !== "idle") return;
    resetSim();
    const run = newRun(r.water, r.seed, r.daily, r.date);
    set({ survival: run, biome: run.water, weather: run.weather, tab: "cast", celebration: null, message: "Same water, same sky. Try again.", detail: "" });
    persistNow();
  },
  leaveRun: () => {
    if (!modeRules().survival || !get().survival?.over) return;
    resetSim();
    set({ survival: null, tab: "cast", celebration: null, message: "Pick a water to begin.", detail: "" });
    persistNow();
  },
  continueRun: () => {
    const r = get().survival;
    if (!r) return;
    commitRun(keepGoing(r), "You keep going. How long can you last?");
  },
  campEat: (index, how) => runCamp((r) => eat(r, index, how)),
  campSmoke: (index) => runCamp((r) => smoke(r, index)),
  campLog: () => runCamp((r) => addLog(r)),
  campGather: () => runCamp((r) => gatherWood(r)),
  campSleep: () => runCamp((r) => sleep(r), true),
  campCraft: (id) => runCamp((r) => craft(r, id)),
  tourney: null,
  lobby: false,
  openLobby: () => {
    /* Tournaments belong to the career side: opening the list from Relaxed Fishing goes back to the career first,
       so nothing from an event is ever filed in the Recreational save. */
    if (currentMode === "recreational" && sim.phase === "idle") {
      persistNow();
      loadSlot("expedition", false);
    }
    set({ lobby: true });
  },
  closeLobby: () => set({ lobby: false }),
  enterEvent: (j, offset) => {
    if (sim.phase !== "idle") return;
    persistNow();
    const id = playerId();
    loadSlot("tournament", true);
    const eventId = j.event.id;
    tqueue = new EnvelopeQueue({
      send: (env) => api.submit(eventId, id, env),
      onReply: (env, r) => tourneyReply(eventId, env, r),
      onDrop: (env, r) => tourneyDrop(eventId, env, r),
      store: queueStore(eventId),
    });
    const run = runFrom(j, id, offset, tqueue.size);
    set({
      tourney: run,
      lobby: false,
      tab: "cast",
      biome: j.water,
      weather: weatherAt(j.seed, Math.max(0, j.serverNow - run.event.startsAt)),
      message: "Pick a spot, then cast.",
      detail: "",
    });
    tqueue.resume();
  },
  setFamily: (family) => {
    const run = get().tourney;
    if (!run || sim.phase !== "idle") return;
    set({ tourney: { ...run, family } });
  },
  leaveEvent: () => {
    if (sim.phase !== "idle") return;
    useHubUi.getState().closeHub();
    get().setScreen("menu");
  },
  syncTrophies: async (quiet = false) => {
    /* Medals, titles and event history are the career's: Recreational never files them. */
    if (currentMode === "recreational") return;
    try {
      const { status, body } = await api.trophies(playerId());
      if (status !== 200 || !Array.isArray(body.results)) return;
      const results = readResults(body.results);
      const s = get();
      const fresh = newMedals(s, results);
      const cab = applyResults({ trophies: s.trophies, titles: s.titles, tourneyHistory: s.tourneyHistory, bobberSkin: s.bobberSkin }, results);
      set({ ...cab });
      persistSoon();
      if (!quiet) {
        for (const r of fresh.slice(0, 3)) {
          const t = titleFor(r);
          get().notify(`${MEDAL_NAMES[r.medal]} medal: ${r.title}.${t ? ` New title: ${t}.` : ""}`);
        }
      }
    } catch {
      /* offline: the cabinet keeps what it has */
    }
  },
  setSkin: (id) => {
    const s = get();
    if (!isSkinId(id) || !unlockedSkins(s.trophies).includes(id)) return;
    set({ bobberSkin: id });
    persistSoon();
  },
  setKid: (on) => {
    set({ kid: on });
    persistSoon();
  },
  setVolume: (v) => {
    set({ volume: clampVolume(v) });
    persistSoon();
  },
  choosePet: (kind) => {
    const s = get();
    if (!funOn() || !isPetKind(kind) || !petUnlocked(s.lv)) return;
    set({
      pet: adopt(s.pet, kind, Date.now()),
      toasts: pushToast([...s.toasts], `${PETS[kind].label} is your fishing buddy now.`),
    });
    persistNow();
  },
  claimGift: () => {
    const s = get();
    const now = Date.now();
    if (!funOn() || !s.pet.kind || !giftReady(s.pet, now)) return;
    const g = chooseGift({ biome: s.biome, spotId: s.lastSpot[s.biome], dex: s.dex, gifts: s.pet.gifts, kind: s.pet.kind });
    const box = { ...s.box, [String(g.lure)]: Math.min(99999, (s.box[String(g.lure)] || 0) + g.qty) };
    audio.coin();
    set({ box, pet: takeGift(s.pet, now), message: g.say, detail: "", toasts: pushToast([...s.toasts], `${PETS[s.pet.kind].label} brought you ${g.qty} lures.`) });
    persistNow();
  },
  answerWho: (who) => {
    try {
      localStorage.setItem(WHO_KEY, "1");
    } catch {
      /* private mode */
    }
    set({ askWho: false, kid: who !== "grown" });
    persistNow();
  },
  beginTrip: (water, window, weather) => {
    const s = get();
    if (!modeRules().trips || sim.phase !== "idle") return;
    const w = Math.min(BIOMES.length - 1, Math.max(0, water));
    const trip = startTrip(Date.now(), w, window, weather);
    /* Starting a trip empties whatever was left in the creel (the old Sandbox bag). */
    set({
      trip,
      inv: [],
      biome: w,
      ub: s.ub.includes(w) ? s.ub : [...s.ub, w],
      lair: false,
      weather: trip.weather >= 0 ? trip.weather : s.weather,
      tab: "cast",
      tripCard: null,
      message: "Line in when you are ready.",
      detail: "",
    });
    persistSoon();
  },
  endTrip: () => {
    const s = get();
    if (!s.trip || sim.phase !== "idle") return;
    set(closeTrip(s, Date.now()));
    persistSoon();
  },
  dismissTripCard: () => set({ tripCard: null }),
  setDrag: (drag) => {
    if (sim.troll && sim.fight) return;
    if (sim.fight) sim.fight.drag = drag;
    set({ drag });
    persistSoon();
  },
  setGfx: (pref) => {
    /* Going back to Auto forgets what Auto settled on, so it starts from the speed test again. */
    if (pref === "auto") sessionLevel = null;
    set({ gfx: pref, ...levelPatch(levelFor(pref)) });
    persistSoon();
  },
  governLevel: (level) => {
    sessionLevel = level;
    set(levelPatch(level));
  },
  dismissCelebration: () => {
    /* WP-16: where the choice is yours, nothing but Keep or Release closes the card (12 §7). */
    if (choicePending()) return nagChoice();
    set({ celebration: null });
  },
  keepCatch: () => {
    /* A mode that only lets fish go turns every Keep into a release. */
    if (!canKeep(modeRules())) return get().releaseCatch();
    set({ celebration: null });
  },
  releaseCatch: () => {
    const s = get();
    const cel = s.celebration;
    if (!cel) return;
    if (!canRelease(modeRules())) return set({ celebration: null });
    const lc = cel.catch;
    const gone = releaseFish(
      s,
      { name: lc.name, t: lc.rarity, v: lc.value, w: lc.weight, i: lc.species, b: lc.biome, m: lc.mutation },
      catchXp(lc.rarity, lc.mutation, lc.biome, lc.boss, new Date()),
    );
    if (!gone.ok) {
      /* Already sold: it cannot be let go. Just close the card. */
      set({ celebration: null, toasts: pushToast([...s.toasts], "That one is already sold.") });
      return;
    }
    const note = releaseNote(gone, lc.name, lc.biome);
    const toasts = [...s.toasts];
    if (gone.levelsGained) pushToast(toasts, `Level ${gone.lv}. ${rankName(gone.lv)}.`);
    for (const t of note.toasts) pushToast(toasts, t);
    audio.release();
    burst(sim.bnx, sim.bny, 10, "splash");
    set({
      inv: gone.inv,
      xp: gone.xp,
      lv: gone.lv,
      released: gone.released,
      stewards: gone.stewards,
      trip: modeRules().trips && s.trip ? tripRelease(s.trip, lc.weight, Date.now()) : s.trip,
      celebration: null,
      toasts: toasts.slice(-3),
      message: note.message,
      detail: note.detail,
    });
    persistSoon();
  },
  openSlot: (mode, slot) => {
    if (!hasSlots(mode)) return;
    const to = clampSlot(mode, slot);
    if (get().hydrated && mode === currentMode && to === activeSlot(mode) && cardAt(mode, to).empty === false) {
      set({ screen: "game" });
      return;
    }
    if (cardAt(mode, to).empty) return;
    persistNow();
    activeSlots = { ...activeSlots, [mode]: to };
    saveActiveSlots();
    loadSlot(mode, true);
  },
  createSlot: (mode, slot, name, difficulty) => {
    if (!hasSlots(mode)) return false;
    const to = clampSlot(mode, slot);
    if (!cardAt(mode, to).empty) return false;
    persistNow();
    const base = fresh();
    base.slotName = slotName(name, mode, to);
    base.created = Date.now();
    base.difficulty = mode === "story" ? "easy" : isDifficulty(difficulty) ? difficulty : "normal";
    /* Story: the first boss's Chum is a gift, so chapter one can end with its boss. */
    if (mode === "story") base.baitBox = { [String(BOSS_CHUM_INDEX)]: 1 };
    activeSlots = { ...activeSlots, [mode]: to };
    saveActiveSlots();
    try {
      localStorage.setItem(slotKey(mode, to), JSON.stringify(snapshot(base)));
      localStorage.removeItem(slotKey(mode, to) + "-bak");
    } catch {
      /* private mode: the slot lives for this visit */
    }
    loadSlot(mode, true);
    return true;
  },
  renameSlot: (mode, slot, name) => {
    if (!hasSlots(mode)) return;
    const to = clampSlot(mode, slot);
    const nm = slotName(name, mode, to);
    if (get().hydrated && mode === currentMode && to === activeSlot(mode)) {
      set({ slotName: nm });
      persistNow();
      return;
    }
    try {
      const key = slotKey(mode, to);
      const raw = JSON.parse(localStorage.getItem(key) || "null") as Record<string, unknown> | null;
      if (!raw || typeof raw !== "object") return;
      raw.slotName = nm;
      const json = JSON.stringify(raw);
      localStorage.setItem(key, json);
      for (const fn of persistListeners) fn(syncId(mode, to), json);
    } catch {
      /* nothing to rename */
    }
  },
  deleteSlot: (mode, slot) => {
    if (!hasSlots(mode)) return;
    const to = clampSlot(mode, slot);
    try {
      const key = slotKey(mode, to);
      localStorage.removeItem(key);
      localStorage.removeItem(key + "-bak");
      if (mode === "expedition" && to === 0) localStorage.removeItem("facultra");
    } catch {
      /* nothing to delete */
    }
    for (const fn of removeListeners) fn(syncId(mode, to));
    /* If it was the open game, the title screen shows the slot empty. */
    if (get().hydrated && mode === currentMode && to === activeSlot(mode)) {
      resetSim();
      loadSlot(mode, false);
    }
  },
  putFishBack: () => {
    const s = get();
    const r = putBack(s.hz, Date.now());
    if (!r.ok) return;
    audio.release();
    set({ hz: r.hz, toasts: pushToast([...s.toasts], "Back in the tank. Phew.") });
    persistSoon();
  },
  raiseBoat: () => {
    const s = get();
    if (s.hz.sunk < 0) return;
    const cost = salvageCost(s.hz.sunk);
    if (s.c < cost) {
      audio.fail("slip");
      set({ toasts: pushToast([...s.toasts], `You need ${cost} coins to raise the boat.`) });
      return;
    }
    audio.coin();
    set({ c: s.c - cost, boat: s.hz.sunk, hz: { ...s.hz, sunk: -1 }, toasts: pushToast([...s.toasts], "Your boat is back on the water.") });
    persistSoon();
  },
  signal: (name, by = 1) => {
    set((s) => ({ ach: bumpCounter(s.ach, name, by) }));
    persistSoon();
  },
  setTab: (tab) => {
    if (isTournament(modeRules()) && !TOURNAMENT_TABS.includes(tab)) return;
    set({ tab, armRebirth: false, armReset: false, armSell: "" });
    syncHub(tab, get().lodgeView);
  },
  setScreen: (screen) => {
    /* The main menu is the career's front door: leaving another mode for it saves that mode and
       shows the career again (rank, bosses and locks on the cards are the career's, not the side mode's). */
    if (screen === "menu" && currentMode !== "expedition" && sim.phase === "idle") {
      persistNow();
      loadSlot("expedition", false);
      return;
    }
    set({ screen });
  },
  leaveToMenu: () => {
    if (get().screen !== "game") return;
    /* Save first, so nothing is lost; then drop any cast or fight in the air (a fish on the line gets away). */
    flushSave();
    resetSim();
    useHubUi.getState().closeHub();
    set({ tab: "cast", phase: "idle", celebration: null, helping: false, lobby: false, message: "Ready to cast.", detail: "" });
    get().setScreen("menu");
  },
  setLodgeView: (view) => {
    set({ lodgeView: view, tab: "lodge" });
    syncHub("lodge", view);
  },
  dismissWelcome: () => set({ welcomeBack: null }),
  dismissNightBack: () => set({ nightBack: null }),
  /* ── Update Three actions: the rules live in the pure packages; these only wire them. ── */
  claimPromo: (raw) => {
    const s = get();
    if (isTournament(modeRules()) || modeRules().survival) return { ok: false, message: "Codes do not work in this mode." };
    const r = redeemCode(snapshot(s), raw, Date.now());
    if (r.ok) {
      const patch: Partial<Store> = { c: r.s.c, baitBox: r.s.baitBox, promo: r.s.promo, events: r.s.events };
      const act = r.s.events.active;
      if (act && (s.events.active?.id !== act.id || s.events.active?.startedAt !== act.startedAt)) {
        const def = eventById(act.id);
        if (def) {
          patch.eventBanner = { id: def.id, at: Date.now() };
          audio.event(def.rarity);
          emitEventStarted(def);
        }
      }
      set(patch);
      persistSoon();
    }
    return { ok: r.ok, message: r.message };
  },
  startNightFishing: () => {
    const s = get();
    if (s.night.on) return;
    const out = startNight(snapshot(s), Date.now());
    if (!out.night.on) {
      const p = nightProgress(s);
      set((st) => ({
        toasts: pushToast([...st.toasts], `Night fishing unlocks after 5 bosses and level 45. So far: ${p.bosses} of 5 bosses, level ${p.level}.`),
      }));
      return;
    }
    set({ night: out.night, toasts: pushToast([...s.toasts], "Night fishing is on. Fish will bite while you are away.") });
    persistSoon();
  },
  collectNight: () => {
    const s = get();
    if (!s.night.on) return;
    const { s: settled, report, gainedLv, found } = applyNightSettled(snapshot(s), Date.now());
    const toasts = [...s.toasts];
    if (gainedLv) pushToast(toasts, `Level ${settled.lv}. ${rankName(settled.lv)}.`);
    if (found.length)
      pushToast(toasts, `You found ${found.length === 1 ? `a ${LINE_PACKS[found[0]].name}` : `${found.length} line packs`}. Open ${found.length === 1 ? "it" : "them"} in Tackle.`);
    set({
      night: settled.night,
      dex: settled.dex,
      c: settled.c,
      tot: settled.tot,
      xp: settled.xp,
      lv: settled.lv,
      caught: settled.caught,
      lineGear: settled.lineGear,
      toasts: toasts.slice(-3),
      nightBack: report.count > 0 ? report : null,
    });
    persistSoon();
  },
  prestigeNow: () => {
    const s = get();
    const out = doPrestige(snapshot(s));
    if (out.prestige === s.prestige) {
      set((st) => ({ toasts: pushToast([...st.toasts], `Prestige unlocks at level 100. You are level ${s.lv}.`) }));
      return;
    }
    audio.fanfare();
    set({ prestige: out.prestige, toasts: pushToast([...s.toasts], `Prestige ${out.prestige}! The First Water is open.`) });
    persistSoon();
  },
  tutorialNext: () => bumpTutorial("next"),
  finishTutorial: () => {
    stopSpeaking();
    set({ tutored: true, tutorial: null });
    persistNow();
  },
  maybeStartTutorial: () => {
    const s = get();
    if (s.tutorial || s.tutored || s.caught > 0) return;
    if (s.mode !== "expedition" || s.screen !== "game") return;
    set({ tutorial: startTutorial() });
  },
  dismissEventBanner: () => set({ eventBanner: null }),
  switchMode: (mode) => {
    if (mode === currentMode) {
      set({ screen: "game" });
      return;
    }
    persistNow();
    currentMode = mode;
    loadSlot(mode, true);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  notify: (text) => set((s) => ({ toasts: pushToast([...s.toasts], text) })),
  buyGear: (kind, index) => {
    const s = get();
    const item = GEAR[kind][index];
    /* Lines are no longer sold (docs/architecture/10 §1.3): they are crafted and found in packs. */
    if (kind === "line") return;
    if (!item || index <= s[kind]) return;
    const gate = gateOf(s, kind, index);
    if (!gate.ok) {
      audio.fail("slip");
      set((st) => ({ toasts: pushToast([...st.toasts], gate.text) }));
      return;
    }
    if (s.c < item.price) {
      audio.fail("slip");
      return;
    }
    audio.coin();
    set({ c: s.c - item.price, [kind]: index });
    persistSoon();
  },
  equipLine: (tier) => {
    const s = get();
    if (!Number.isInteger(tier) || tier < 0 || tier >= LINES.length || !canUse(s.lineGear, tier)) return;
    set({ line: tier });
    persistSoon();
  },
  craftLine: (tier) => {
    const s = get();
    if (isTournament(modeRules()) || modeRules().survival) return;
    const gear = craftLineGear(s.lineGear, tier, s.lv, new Set(s.mastered).size);
    if (!gear) {
      audio.fail("slip");
      return;
    }
    audio.coin();
    /* The line in use is replaced by the new one when crafting used up its last copy. */
    const line = canUse(gear, s.line) ? s.line : tier;
    set((st) => ({ lineGear: gear, line, toasts: pushToast([...st.toasts], `Crafted ${LINES[tier].name}.`) }));
    persistSoon();
  },
  openLinePack: (kind) => {
    const s = get();
    const gear = applyOpen(s.lineGear, kind, loose);
    if (!gear) return;
    audio.coin();
    set((st) => ({
      lineGear: gear,
      toasts: pushToast([...st.toasts], `${LINE_PACKS[kind].name}: ${gear.last.map((t) => LINES[t].name).join(", ")}.`),
    }));
    bumpTutorial("pack");
    persistSoon();
  },
  buyAuto: () => {
    const s = get();
    if (s.auto || s.c < AUTO_PRICE) return;
    audio.coin();
    set({ c: s.c - AUTO_PRICE, auto: true, autoOn: true });
    persistSoon();
  },
  toggleAuto: () => {
    const s = get();
    if (!s.auto) return;
    set({ autoOn: !s.autoOn });
    persistSoon();
  },
  buyPack: (index) => {
    const s = get();
    const pack = PACKS[index];
    if (!pack || s.c < pack.price) return;
    const gate = gateOf(s, "pack", index);
    if (!gate.ok) {
      audio.fail("slip");
      set((st) => ({ toasts: pushToast([...st.toasts], gate.text) }));
      return;
    }
    const box = { ...s.box };
    const names: string[] = [];
    for (let n = 0; n < 3; n++) {
      const x = pack.min + ((loose() * (pack.max - pack.min)) | 0);
      box[String(x)] = (box[String(x)] || 0) + 12 + ((loose() * 14) | 0);
      names.push(LURES[x].name);
    }
    audio.coin();
    set({ c: s.c - pack.price, box, pull: names.join(", ") });
    bumpTutorial("pack");
    persistSoon();
  },
  equipLure: (index) => {
    const s = get();
    if (index >= 0 && !(s.box[String(index)] > 0)) return;
    set({ lure: index });
    persistSoon();
  },
  buySig: (index) => {
    const s = get();
    const item = SIG_LURES[index];
    if (!item || s.sigBox.includes(index)) return;
    const cost = priceIn(modeRules(), item.price);
    if (s.c < cost) {
      audio.fail("slip");
      return;
    }
    audio.coin();
    set({ c: s.c - cost, sigBox: [...s.sigBox, index], sig: index });
    persistSoon();
  },
  equipSig: (index) => {
    const s = get();
    if (index >= 0 && !s.sigBox.includes(index)) return;
    set({ sig: index });
    persistSoon();
  },
  buyBait: (index) => {
    const s = get();
    const item = BAITS[index];
    if (!item) return;
    const price = index === BOSS_CHUM_INDEX ? bossChumPrice(s.biome) : item.price;
    const cost = priceIn(modeRules(), price);
    if (s.c < cost) {
      audio.fail("slip");
      return;
    }
    audio.coin();
    const baitBox = { ...s.baitBox, [String(index)]: (s.baitBox[String(index)] || 0) + 1 };
    set({ c: s.c - cost, baitBox });
    persistSoon();
  },
  equipBait: (index) => {
    const s = get();
    if (index >= 0 && !(s.baitBox[String(index)] > 0)) return;
    set({ bait: index });
    persistSoon();
  },
  setLair: (on) => {
    set({ lair: on });
    persistSoon();
  },
  setSpot: (id) => {
    const s = get();
    if (sim.phase !== "idle" || !spotById(s.biome, id) || s.lastSpot[s.biome] === id) return;
    set({ lastSpot: { ...s.lastSpot, [s.biome]: id } });
    persistSoon();
  },
  setRig: (patch) => {
    const s = get();
    if (sim.phase !== "idle") return;
    const now = s.rig[s.biome] ?? DEFAULT_RIG;
    const next: Rig = {
      depth: isDepth(patch.depth) ? patch.depth : now.depth,
      retrieve: isRetrieve(patch.retrieve) ? patch.retrieve : now.retrieve,
    };
    if (next.depth === now.depth && next.retrieve === now.retrieve && s.rig[s.biome]) return;
    set({ rig: { ...s.rig, [s.biome]: next } });
    persistSoon();
  },
  addExhibit: (key) => {
    const s = get();
    const slots = TANK_TIERS[s.tank.tier].slots;
    if (!s.dex[key]?.c || s.tank.exhibits.includes(key) || s.tank.exhibits.length >= slots) return;
    const away = mayExhibit(s.hz, key, Date.now());
    if (!away.ok) return set({ toasts: pushToast([...s.toasts], `That fish is still getting over its jump. Try again in ${away.minutes} min.`) });
    set({ tank: { ...s.tank, exhibits: [...s.tank.exhibits, key] } });
    bumpTutorial("tank");
    persistSoon();
  },
  removeExhibit: (key) => {
    const s = get();
    set({
      tank: {
        ...s.tank,
        exhibits: s.tank.exhibits.filter((k) => k !== key),
        ped: s.tank.ped.filter((k) => k !== key),
      },
    });
    persistSoon();
  },
  togglePed: (key) => {
    const s = get();
    if (!s.tank.exhibits.includes(key)) return;
    const ped = s.tank.ped.includes(key)
      ? s.tank.ped.filter((k) => k !== key)
      : s.tank.ped.length >= SHOWCASE_SLOTS
        ? [...s.tank.ped.slice(1), key]
        : [...s.tank.ped, key];
    set({ tank: { ...s.tank, ped } });
    persistSoon();
  },
  autoStock: () => {
    const s = get();
    const slots = TANK_TIERS[s.tank.tier].slots;
    const ranked = Object.keys(s.dex)
      .filter((k) => s.dex[k]?.c && mayExhibit(s.hz, k, Date.now()).ok)
      .map((k) => {
        const [b, i] = k.split("-").map(Number);
        return { k, v: exhibitValue(s.dex[k], b, i) };
      })
      .sort((a, b) => b.v - a.v);
    const exhibits = ranked.slice(0, slots).map((r) => r.k);
    const ped = ranked.slice(0, SHOWCASE_SLOTS).map((r) => r.k);
    set({ tank: { ...s.tank, exhibits, ped } });
    persistSoon();
  },
  feedTank: () => {
    const s = get();
    const now = Date.now();
    if (now < s.tank.feedUntil || s.tank.exhibits.length === 0) return;
    audio.frenzy();
    set({
      tank: { ...s.tank, feedUntil: now + 3_600_000 },
      toasts: pushToast([...s.toasts], "Feed Frenzy — the tank earns half again for an hour."),
    });
    persistSoon();
  },
  buyTankTier: () => {
    const s = get();
    const next = TANK_TIERS[s.tank.tier + 1];
    if (!next || s.c < next.price) return;
    audio.coin();
    set({ c: s.c - next.price, tank: { ...s.tank, tier: s.tank.tier + 1 } });
    persistSoon();
  },
  buyGift: () => {
    const s = get();
    const price = GIFT_PRICES[s.tank.gift];
    if (price == null || s.c < price) return;
    audio.coin();
    set({ c: s.c - price, tank: { ...s.tank, gift: s.tank.gift + 1 } });
    persistSoon();
  },
  buyLight: (biome) => {
    const s = get();
    if (s.tank.lights.includes(biome) || s.c < LIGHT_PRICE) return;
    audio.coin();
    set({ c: s.c - LIGHT_PRICE, tank: { ...s.tank, lights: [...s.tank.lights, biome] } });
    persistSoon();
  },
  startDerby: () => {
    const s = get();
    if (s.derby) return;
    const now = new Date();
    const derby = newDerby(now.getTime(), {
      seed: (loose() * 4294967296) >>> 0,
      biome: s.biome,
      luck: luckTotal(s, s.lure),
      stage: stageIn(modeRules(), stageBook(s), s.biome),
      weather: s.weather,
      window: derbyWindow(now.getHours() + now.getMinutes() / 60, s.weather),
    });
    const names = derby.rivals.map((r) => rivalById(r.id)?.name).filter(Boolean).join(", ");
    audio.frenzy();
    set({
      derby,
      tab: "cast",
      toasts: pushToast([...s.toasts], `Derby started with ${names}. Most catch value in 10 minutes wins.`),
    });
    persistSoon();
  },
  startRush: () => {
    const s = get();
    if (s.rush) return;
    if (s.bosses < 3 || s.mastered.length === 0) {
      set((st) => ({ toasts: pushToast([...st.toasts], "Boss Rush unlocks after 3 bosses fall.") }));
      return;
    }
    const list = [...s.mastered];
    audio.land(4);
    set({
      rush: { list, pos: 0, t0: Date.now() },
      biome: list[0],
      lair: true,
      tab: "cast",
      toasts: pushToast([...s.toasts], `Boss Rush — ${list.length} bosses, back to back.`),
    });
    persistSoon();
  },
  sellOne: (index) => {
    const s = get();
    if (!modeRules().economy) {
      set((st) => ({ toasts: pushToast([...st.toasts], `Nothing is sold in ${modeRules().title}.`) }));
      return;
    }
    const item = s.inv[index];
    if (!item) return;
    /* Kid Mode: a rare or better fish asks "Are you sure?" first. */
    const armKey = `one:${index}:${item.name}`;
    if (needsSure(kidOn(s), { kind: "sell", rarity: item.t }) && s.armSell !== armKey) {
      set({ armSell: armKey, toasts: pushToast([...s.toasts], `Are you sure? Tap again to sell ${item.name}.`) });
      return;
    }
    const inv = s.inv.filter((_, j) => j !== index);
    const gained = Math.round(item.v * multOf(s.dex, s.rb));
    audio.coin();
    set({ inv, c: s.c + gained, tot: s.tot + gained, contracts: bumpBank(s.contracts, gained), armSell: "" });
    persistSoon();
  },
  sellUpTo: (maxRarity) => {
    const s = get();
    if (!modeRules().economy) {
      set((st) => ({ toasts: pushToast([...st.toasts], `Nothing is sold in ${modeRules().title}.`) }));
      return;
    }
    const top = s.inv.reduce((m, f) => (f.t <= maxRarity ? Math.max(m, f.t) : m), -1);
    const armKey = `up:${maxRarity}`;
    if (top >= 0 && needsSure(kidOn(s), { kind: "sellMany", topRarity: top }) && s.armSell !== armKey) {
      set({ armSell: armKey, toasts: pushToast([...s.toasts], "Are you sure? Some of these are rare. Tap again to sell.") });
      return;
    }
    let sum = 0;
    const inv = s.inv.filter((fish) => {
      if (fish.t <= maxRarity) {
        sum += fish.v;
        return false;
      }
      return true;
    });
    if (!sum) return;
    const gained = Math.round(sum * multOf(s.dex, s.rb));
    audio.coin();
    set({ inv, c: s.c + gained, tot: s.tot + gained, contracts: bumpBank(s.contracts, gained), armSell: "" });
    persistSoon();
  },
  travel: (index) => {
    const s = get();
    if (sim.phase !== "idle" || index === s.biome || s.rush || isTournament(modeRules())) return;
    const owned = s.ub.includes(index);
    const price = BIOMES[index].price;
    if (!owned) {
      /* Update Three: the final water opens at Prestige 1, never for gold. */
      if (index === finalBiomeIndex(BIOMES.length) && !canUnlockFinalBiome(s)) {
        audio.fail("slip");
        set((st) => ({ toasts: pushToast([...st.toasts], "The First Water opens at Prestige 1.") }));
        return;
      }
      const gate = gateOf(s, "map", index);
      if (!gate.ok) {
        audio.fail("slip");
        set((st) => ({ toasts: pushToast([...st.toasts], gate.text) }));
        return;
      }
    }
    if (!owned && s.c < price) return;
    audio.coin();
    if (modeRules().trips && s.trip) {
      /* Leaving the water ends the trip: the creel empties, the trip goes in the logbook,
         and a new one starts on the new water with the same time and weather picks. */
      const now = Date.now();
      const closed = closeTrip(s, now, false);
      const trip = startTrip(now, index, s.trip.window, s.trip.weather);
      const toasts = [...s.toasts];
      pushToast(toasts, `Left ${BIOMES[s.biome].name}. ${creelLine(s.inv.length, creelWeight(s.inv))}`);
      set({
        ...closed,
        trip,
        biome: index,
        weather: trip.weather >= 0 ? trip.weather : s.weather,
        toasts: toasts.slice(-3),
      });
      persistSoon();
      return;
    }
    set({
      c: owned ? s.c : s.c - price,
      ub: owned ? s.ub : [...s.ub, index],
      biome: index,
    });
    persistSoon();
  },
  claim: (id) => {
    const s = get();
    const contract = s.contracts.find((c) => c.id === id);
    if (!contract || contract.prog < contract.goal) return;
    const kept = s.contracts.filter((c) => c.id !== id);
    const contracts = [...kept, nextContract(s, kept)];
    audio.coin();
    const packs = modeRules().economy ? { lineGear: givePack(s.lineGear, PACK_SOURCES.contract) } : {};
    set({ c: s.c + contract.reward, tot: s.tot + contract.reward, contracts, ...packs });
    persistSoon();
  },
  pin: (key) => {
    const s = get();
    if (s.pins.includes(key)) {
      set({ pins: s.pins.filter((k) => k !== key) });
    } else if (s.dex[key]?.c) {
      const pins = s.pins.length >= 8 ? [...s.pins.slice(1), key] : [...s.pins, key];
      set({ pins });
    } else return;
    persistSoon();
  },
  rebirth: () => {
    const s = get();
    if (!modeRules().rebirth || s.tot < 1e7 || s.ub.length < BIOMES.length || sim.phase !== "idle") return;
    if (!s.armRebirth) {
      set({ armRebirth: true });
      return;
    }
    resetSim();
    audio.land(4);
    const base = fresh();
    set({
      ...base,
      hydrated: true,
      xp: s.xp,
      lv: s.lv,
      dex: s.dex,
      caught: s.caught,
      rb: s.rb + 1,
      bosses: s.bosses,
      perfects: s.perfects,
      bestStreak: s.bestStreak,
      taught: true,
      /* Update Three: prestige is meta-progress and claimed codes stay claimed across a rebirth;
         a rebirthed angler is never re-tutored. */
      prestige: s.prestige,
      promo: s.promo,
      tutored: true,
      pins: s.pins.filter((k) => s.dex[k]?.c),
      sound: s.sound,
      motion: s.motion,
      flash: s.flash,
      gfx: s.gfx,
      assist: s.assist,
      followClock: s.followClock,
      kid: s.kid,
      lastSpot: s.lastSpot,
      rig: s.rig,
      records: s.records,
      released: s.released,
      stewards: s.stewards,
      coached: s.coached,
      drag: s.drag,
      tank: { ...s.tank, lastSettle: Date.now() },
      mastered: s.mastered,
      sigBox: s.sigBox,
      sig: s.sigBox.includes(s.sig) ? s.sig : -1,
      derbiesWon: s.derbiesWon,
      rushBest: s.rushBest,
      pet: s.pet,
      stickers: s.stickers,
      shiny: s.shiny,
      fotdClaimed: s.fotdClaimed,
      rivalRecord: s.rivalRecord,
      volume: s.volume,
      cb: s.cb,
      trophies: s.trophies,
      titles: s.titles,
      bobberSkin: s.bobberSkin,
      tourneyHistory: s.tourneyHistory,
      lineGear: s.lineGear,
      line: s.line,
      events: s.events,
      tab: s.tab,
      phase: "idle",
      message: "The ledger turns. Dex and level stay.",
      detail: "",
      frenzyLeft: 0,
      lastCatch: null,
      pull: "",
      toasts: pushToast([], `Rebirth ${s.rb + 1}. Sale prices rose.`),
    });
    persistNow();
  },
  wipe: () => {
    const s = get();
    if (!s.armReset) {
      set({ armReset: true });
      return;
    }
    resetSim();
    const tab = s.tab;
    set({
      ...(modeRules().allUnlocked ? unlockedSave() : fresh()),
      survival: null,
      sMeta: freshMeta(),
      sound: s.sound,
      motion: s.motion,
      flash: s.flash,
      gfx: s.gfx,
      assist: s.assist,
      followClock: s.followClock,
      kid: s.kid,
      volume: s.volume,
      cb: s.cb,
      drag: s.drag,
      slotName: s.slotName,
      created: s.created,
      difficulty: s.difficulty,
      autoKeep: s.autoKeep,
      hydrated: true,
      tab,
      phase: "idle",
      message: "Ready to cast.",
      detail: "",
      toasts: [],
      lastCatch: null,
      pull: "",
      frenzyLeft: 0,
    });
    persistNow();
  },
  toggleSetting: (key) => {
    const s = get();
    const value = !s[key];
    if (key === "sound") audio.setEnabled(value);
    set({ [key]: value });
    persistSoon();
  },
  importSave: (raw) => {
    if (!raw || typeof raw !== "object") return false;
    if (modeRules().survival) {
      /* A Survival ledger is its own shape: the run, the history and the Survival dex. */
      const sv = sanitizeSurvival(raw);
      resetSim();
      set({
        dex: sv.dex,
        records: sv.records,
        lastSpot: sv.lastSpot,
        rig: sv.rig,
        coached: sv.coached,
        drag: sv.drag,
        survival: sv.run,
        sMeta: { history: sv.history, lastWater: sv.lastWater },
        biome: sv.run?.water ?? sv.lastWater,
        weather: sv.run?.weather ?? 0,
        phase: "idle",
        message: "Ledger restored.",
        detail: "",
        tab: "cast",
        toasts: pushToast([], "Save imported."),
      });
      persistNow();
      return true;
    }
    const save = sanitize(raw);
    resetSim();
    audio.setEnabled(save.sound);
    set({
      ...save,
      hydrated: true,
      phase: "idle",
      message: "Ledger restored.",
      detail: "",
      armRebirth: false,
      armReset: false,
      lastCatch: null,
      pull: "",
      frenzyLeft: 0,
      toasts: pushToast([], "Save imported."),
    });
    persistNow();
    return true;
  },
  exportCode: () => {
    const json = JSON.stringify(modeRules().survival ? toSurvivalSave(get()) : snapshot(get()));
    return btoa(unescape(encodeURIComponent(json)));
  },
  importCode: (code) => {
    try {
      const raw = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      return get().importSave(raw);
    } catch {
      return false;
    }
  },
}));

/** One thing the player does at camp: only between fish, and the game says plainly when it can't be done. */
function runCamp(fn: (r: SurvivalRun) => Step, morning = false) {
  const s = useGame.getState();
  if (!s.survival) return;
  if (sim.phase !== "idle") {
    useGame.setState({ toasts: pushToast([...s.toasts], "Finish this fish first.") });
    return;
  }
  const step = fn(s.survival);
  if (!step.ok) {
    useGame.setState({ message: step.say, detail: "", toasts: pushToast([...s.toasts], step.say) });
    return;
  }
  commitRun(step.run, step.say);
  if (morning && !step.run.over) useGame.setState({ tab: "cast", detail: "A new day. Check the sky and cast a line." });
}

/** What a slot holds, read straight from storage (the slot picker and the guards above use it). */
function cardAt(mode: Mode, slot: number) {
  return slotCards(mode, (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  })[slot];
}

function loadSlot(mode: Mode, toGame: boolean) {
  currentMode = mode;
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(modeKey(mode)) || "null");
  } catch {
    raw = null;
  }
  if (!raw && mode === "expedition" && activeSlot(mode) === 0) {
    try {
      raw = JSON.parse(localStorage.getItem("facultra") || "null");
    } catch {
      raw = null;
    }
  }
  let save: Save;
  /* Survival's slot has its own shape (survival.ts): its run, its history and its own dex. */
  const sv = MODES[mode].survival ? sanitizeSurvival(raw) : null;
  if (sv) {
    save = {
      ...fresh(),
      dex: sv.dex,
      records: sv.records,
      lastSpot: sv.lastSpot,
      rig: sv.rig,
      coached: sv.coached,
      drag: sv.drag,
      biome: sv.run?.water ?? sv.lastWater,
      ub: [...SURVIVAL_WATERS],
      weather: sv.run?.weather ?? 0,
    };
  } else if (!raw && MODES[mode].allUnlocked) save = unlockedSave();
  else save = sanitize(raw);
  /* A mode with no contracts has none (a save is never trusted to say so). */
  if (!MODES[mode].contracts) save.contracts = [];
  /* A trip left open for a long time was over when you left: file it. */
  if (save.trip && tripIsStale(save.trip, Date.now())) {
    const t = save.trip;
    const done = finishTrip(t, t.last);
    save.trips = addTrip(save.trips, done);
    save.trip = null;
    save.inv = [];
  }
  let device: ReturnType<typeof readDeviceSettings> = {};
  try {
    device = readDeviceSettings(JSON.parse(localStorage.getItem(DEVICE_KEY) || "null"));
  } catch {
    device = {};
  }
  if (!raw && !Object.keys(device).length && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    save.motion = false;
    save.flash = false;
  }
  save = overlayDevice(save, device);
  if (!isSkinId(save.bobberSkin)) save.bobberSkin = "plain";
  if (dexCount(save.dex) >= TOTAL_SPECIES) {
    save.contracts = save.contracts.map((c) =>
      c.kind === "discover" && c.prog < c.goal ? makeContract(save, "count") : c,
    );
  }
  /* The Aquarium kept earning while you were away — settle it now. */
  const { gain, hours, tank } = settleTank(save);
  save.tank = tank;
  let welcomeBack: { gain: number; hours: number } | null = null;
  if (gain >= 10) {
    save.c += gain;
    save.tot += gain;
    welcomeBack = { gain, hours };
  }
  /* Update Three: a night left fishing settles too — summary-level, like the tank. */
  let nightBack: NightReport | null = null;
  if (save.night.on) {
    const settled = applyNightSettled(save, Date.now());
    save = settled.s;
    if (settled.report.count > 0) nightBack = settled.report;
  }
  audio.setEnabled(save.sound);
  resetSim();
  /* Leaving Survival: its seeded dice stop, casual play is unpredictable again. */
  if (useGame.getState().mode === "survival" && mode !== "survival") setRng(makeRng((loose() * 4294967296) >>> 0));
  useGame.setState({
    ...save,
    survival: sv?.run ?? null,
    sMeta: sv ? { history: sv.history, lastWater: sv.lastWater } : freshMeta(),
    ...levelPatch(levelFor(save.gfx)),
    celebration: null,
    helping: false,
    hydrated: true,
    mode,
    screen: toGame ? "game" : "menu",
    tripCard: null,
    armSell: "",
    tourney: null,
    lobby: false,
    phase: "idle",
    message: "Ready to cast.",
    detail: "",
    frenzyLeft: 0,
    armRebirth: false,
    armReset: false,
    lastCatch: null,
    pull: "",
    welcomeBack,
    nightBack,
    tutorial: null,
    eventBanner: null,
  });
  noteActivity();
  persistNow();
  /* A brand-new Expedition save meets the guided tutorial (Update Three). */
  if (toGame) useGame.getState().maybeStartTutorial();
}

/** Set once the "Who's fishing today?" question has been answered. */
const WHO_KEY = "fac-ultra-who";

export function hydrate(mode: Mode = "expedition") {
  loadActiveSlots();
  /* A brand-new device (no save in any slot, question never answered) gets asked who is fishing. */
  let first = false;
  try {
    first = !localStorage.getItem(WHO_KEY) && !localStorage.getItem("facultra") && !Object.values(MODE_KEYS).some((k) => localStorage.getItem(k));
  } catch {
    first = false;
  }
  loadSlot(mode, false);
  if (first) useGame.setState({ askWho: true });
  bindLifecycle();
}

/** The mode a stored name means (old names like "career" and "sandbox" included). */
export { legacyMode };

export function downloadSave() {
  const st = useGame.getState();
  const blob = new Blob([JSON.stringify(modeRules().survival ? toSurvivalSave(st) : snapshot(st))], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fac-ultra.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

