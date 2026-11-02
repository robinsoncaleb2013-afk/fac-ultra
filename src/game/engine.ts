import { create } from "zustand";
import { audio } from "@/game/audio";
import {
  AUTO_PRICE,
  BAITS,
  BIOMES,
  BOATS,
  BOSS_CHUM_INDEX,
  BOSS_INDEX,
  bossChumPrice,
  type Contract,
  dexCount,
  exhibitValue,
  GEAR,
  type GearKind,
  GIFT_PRICES,
  LIGHT_PRICE,
  LINES,
  luckTotal,
  LURES,
  money,
  multOf,
  PACKS,
  rankName,
  REELS,
  RODS,
  rollFish,
  type Rolled,
  SHOWCASE_SLOTS,
  SIG_LURES,
  sigEffect,
  SPECIES_PER_BIOME,
  stageOf,
  TANK_TIERS,
  type TankState,
  tankRatePerHour,
  TOTAL_SPECIES,
  WEATHER,
  xpNeed,
} from "@/game/content";

export type Tab = "cast" | "bag" | "gear" | "lures" | "waters" | "dex" | "lodge";
export type Phase = "idle" | "wait" | "bite" | "reel";
export type Mode = "career" | "sandbox" | "coop";
export type LodgeView = "record" | "tank" | "derby" | "crew" | "settings";

export type DerbyState = {
  endsAt: number;
  score: number;
  rivals: { n: string; s: number }[];
} | null;

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
};

type Toast = { id: number; text: string };

const SAVE_VERSION = 3;
const MARKS = [10, 25, 50, 100, 150, 200, 250, 300, 375];

export const MODE_KEYS: Record<Mode, string> = {
  career: "fac-ultra",
  sandbox: "fac-ultra-sandbox",
  coop: "fac-ultra-coop",
};

let currentMode: Mode = "career";

export function modeKey(mode: Mode = currentMode) {
  return MODE_KEYS[mode];
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

export const hud = {
  track: null as HTMLDivElement | null,
  zone: null as HTMLDivElement | null,
  cursor: null as HTMLDivElement | null,
};

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
  cp: 50,
  cd: 1,
  zc: 50,
  zone: 18,
  hits: 0,
  need: 2,
  tz: 0,
  hold: 3,
  reelSpeed: 0,
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
  leap: null as null | { t: number; look: Rolled },
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
  };
}

/** Sandbox — Zen Waters: everything unlocked, no economy, its own dex. */
export function sandboxSave(): Save {
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
  return Math.random().toString(36).slice(2, 9);
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
        m: Math.max(prev?.m || 0, int(e?.m, 0, 0, 5)),
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
        m: int(it.m, 0, 0, 5),
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
  let derby: DerbyState = null;
  if (o.derby && typeof o.derby === "object") {
    const d = o.derby as Record<string, unknown>;
    if (Array.isArray(d.rivals)) {
      derby = {
        endsAt: num(d.endsAt, 0, 0, 1e16),
        score: num(d.score, 0, 0, 1e15),
        rivals: d.rivals.slice(0, 4).map((r) => {
          const row = (r ?? {}) as Record<string, unknown>;
          return { n: typeof row.n === "string" ? row.n.slice(0, 24) : "Rival", s: num(row.s, 0, 0, 1e15) };
        }),
      };
    }
  }
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
  return {
    ...base,
    version: SAVE_VERSION,
    c: num(o.c, 50, 0, 1e15),
    xp: num(o.xp, 0, 0, 1e12),
    lv: int(o.lv, 1, 1, 9999),
    rod: int(o.rod, 0, 0, RODS.length - 1),
    reel: int(o.reel, 0, 0, REELS.length - 1),
    line: int(o.line, 0, 0, LINES.length - 1),
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
  };
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
  };
}

function persistNow() {
  try {
    const key = modeKey();
    const json = JSON.stringify(snapshot(useGame.getState()));
    const prev = localStorage.getItem(key);
    if (prev) localStorage.setItem(key + "-bak", prev);
    localStorage.setItem(key, json);
  } catch {
    /* private mode or quota */
  }
}

function persistSoon() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persistNow, 400);
}

function bindLifecycle() {
  if (bound) return;
  bound = true;
  const flush = () => {
    if (document.visibilityState === "hidden") persistNow();
  };
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("pagehide", persistNow);
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
  const rate = currentMode === "sandbox" ? 0 : tankRatePerHour(s.tank, s.dex, now);
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
  const kind = (open.length ? open : pool)[(Math.random() * (open.length || pool.length)) | 0];
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

function withCatch(s: Save & { toasts: Toast[] }, fish: Rolled, o: { auto: boolean; perfect: boolean; frenzy: boolean }) {
  let streak = s.streak;
  let bestStreak = s.bestStreak;
  let scale = o.auto ? 0.4 : 1;
  if (!o.auto) {
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    if (o.perfect) scale *= 1.28;
    if (o.frenzy) scale *= 1.5;
    scale *= 1 + Math.min(streak, 12) * 0.03;
  }
  const v = Math.round(fish.v * scale);
  const key = `${fish.b}-${fish.i}`;
  const prev = s.dex[key];
  const discovered = !prev?.c;
  const dex = {
    ...s.dex,
    [key]: { c: (prev?.c || 0) + 1, w: Math.max(prev?.w || 0, fish.w), m: Math.max(prev?.m || 0, fish.m) },
  };
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
  if (overflow) {
    const gained = Math.round(overflow * multOf(dex, s.rb));
    c += gained;
    tot += gained;
    contracts = bumpBank(contracts, gained);
  }
  let xp = s.xp + 3 + fish.t * 8 + fish.m * 5 + fish.b * 2 + (fish.boss ? 12 : 0);
  let lv = s.lv;
  let gainedLv = 0;
  while (xp >= xpNeed(lv)) {
    xp -= xpNeed(lv);
    lv += 1;
    gainedLv += 1;
  }
  let mastered = s.mastered;
  if (fish.boss && !o.auto && !mastered.includes(fish.b)) mastered = [...mastered, fish.b];
  let derby = s.derby;
  if (derby && !o.auto && Date.now() < derby.endsAt) derby = { ...derby, score: derby.score + v };
  const toasts = [...s.toasts];
  if (discovered) pushToast(toasts, `New species. ${BIOMES[fish.b].fish[fish.i]}.`);
  if (gainedLv) pushToast(toasts, `Level ${lv}. ${rankName(lv)}.`);
  const count = dexCount(dex);
  if (discovered && MARKS.includes(count)) pushToast(toasts, `Dex ${count} of ${TOTAL_SPECIES}.`);
  if (fish.boss && !o.auto) pushToast(toasts, `${BIOMES[fish.b].name} mastered. The boss is yours.`);
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
  };
  return {
    dex,
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
    derby,
    taught: s.taught || !o.auto,
    lastCatch,
    toasts: toasts.slice(-3),
  };
}

function burst(x: number, y: number, n: number, kind: Particle["kind"]) {
  const motion = useGame.getState().motion;
  const count = motion ? n : Math.min(3, n);
  for (let i = 0; i < count; i++) {
    if (sim.particles.length > 110) sim.particles.shift();
    const a = Math.random() * Math.PI * 2;
    const sp = 0.05 + Math.random() * 0.18;
    sim.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp * (kind === "splash" ? 0.45 : 1),
      vy: kind === "splash" ? -Math.random() * 0.25 : Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.45,
      max: 0.8,
      kind,
      size: 1.5 + Math.random() * 2.5,
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

function placeZone() {
  const z = sim.zone;
  sim.zc = z / 2 + 5 + Math.random() * Math.max(8, 90 - z);
}

function linePct() {
  return Math.max(0, Math.round(100 * (1 - sim.tz / Math.max(0.01, sim.hold))));
}

function ensureSwimmers() {
  if (sim.swimmers.length) return;
  for (let i = 0; i < 5; i++) {
    sim.swimmers.push({
      x: Math.random(),
      y: 0.7 + Math.random() * 0.12,
      v: 0.035 + Math.random() * 0.04,
      dir: Math.random() < 0.5 ? -1 : 1,
      species: i * 3,
      phase: Math.random() * 6,
      sc: 0.75 + Math.random() * 0.45,
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
}

function paintHud() {
  const track = hud.track;
  const zone = hud.zone;
  const cursor = hud.cursor;
  if (!track || !zone || !cursor) return;
  const on = sim.phase === "reel";
  track.style.opacity = on ? "1" : "0";
  track.style.height = on ? "1.75rem" : "0px";
  track.style.marginTop = on ? "0.5rem" : "0px";
  zone.style.left = `${sim.zc - sim.zone / 2}%`;
  zone.style.width = `${sim.zone}%`;
  cursor.style.left = `${sim.cp}%`;
}

function updateBobber() {
  if (sim.phase === "reel") sim.bnx = 0.1 + 0.8 * (sim.cp / 100);
  else sim.bnx = 0.46 + Math.sin(sim.t * 1.3) * 0.018;
  const thrash = sim.phase === "bite" ? Math.sin(sim.t * 32) * 0.012 : 0;
  sim.bny = 0.73 + Math.sin(sim.t * 2.1) * 0.008 + thrash;
}

function tickLeap(dt: number) {
  if (!sim.leap) return;
  sim.leap.t += dt;
  if (sim.leap.t > 0.95) sim.leap = null;
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
  if (!kind || Math.random() > rate * dt) return;
  if (sim.particles.length > 90) return;
  if (kind === "rain") {
    sim.particles.push({
      x: Math.random(),
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
      x: Math.random(),
      y: -0.02,
      vx: Math.sin(sim.t + Math.random()) * 0.05,
      vy: 0.12,
      life: 3,
      max: 3,
      kind,
      size: 2,
    });
  } else if (kind === "ember") {
    sim.particles.push({
      x: Math.random(),
      y: 0.95,
      vx: (Math.random() - 0.5) * 0.05,
      vy: -0.12 - Math.random() * 0.08,
      life: 2.2,
      max: 2.2,
      kind,
      size: 2,
    });
  } else {
    sim.particles.push({
      x: 0.15 + Math.random() * 0.7,
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

function beginBite() {
  const s = useGame.getState();
  const luck = luckTotal(s, sim.castLure);
  const fish = rollFish(s.biome, luck, {
    boss: sim.castLair,
    stage: stageOf(s.dex, s.biome),
    sig: sigEffect(s.sig),
    bait: sim.castBait,
  });
  sim.fish = fish;
  sim.phase = "bite";
  sim.biteMax = (1300 + RODS[s.rod].zone * 8) / 1000;
  sim.biteLeft = sim.biteMax;
  sim.trauma = Math.min(1, sim.trauma + (fish.boss ? 0.85 : 0.28));
  audio.bite();
  buzz(fish.boss ? 40 : 16);
  burst(sim.bnx, sim.bny, fish.boss ? 22 : 8, "splash");
  useGame.setState({
    phase: "bite",
    message: fish.boss ? `${fish.name} rises. Hook it!` : "Bite. Hook it.",
    detail: fish.boss ? "Three phases. Hold the line." : "Early hooks pay more.",
  });
}

function succeed() {
  const s = useGame.getState();
  const fish = sim.fish;
  if (!fish) return;
  const next = withCatch(s, fish, { auto: false, perfect: sim.perfect, frenzy: sim.frenzyLeft > 0 });
  sim.phase = "idle";
  sim.leap = { t: 0, look: fish };
  sim.fish = null;
  sim.trauma = Math.min(1, sim.trauma + (fish.t >= 4 || fish.boss ? 0.55 : 0.2));
  sim.hitstop = fish.t >= 3 || fish.boss ? 0.07 : 0.04;
  if (s.flash) sim.hitFlash = fish.t >= 4 || fish.boss ? 0.4 : 0.16;
  burst(sim.bnx, sim.bny, 18, "splash");
  if (sim.perfect || fish.t >= 3) burst(sim.bnx, sim.bny - 0.05, 10, "spark");
  audio.land(fish.t);
  buzz(12);
  useGame.setState({
    ...next,
    phase: "idle",
    message: fish.boss ? `${fish.name} landed!` : "Landed.",
    detail: "",
    lair: fish.boss ? !!s.rush : s.lair,
  });
  /* Online co-op: tell the room (multiplayer.ts listens for this). */
  window.dispatchEvent(new CustomEvent("fac:catch", { detail: { name: next.lastCatch?.name, v: next.lastCatch?.value, b: fish.b } }));
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

function fail(kind: "slip" | "snap") {
  const wasLair = sim.castLair;
  sim.phase = "idle";
  sim.fish = null;
  sim.castLair = false;
  sim.trauma = Math.min(1, sim.trauma + (kind === "snap" ? 0.6 : 0.22));
  burst(sim.bnx, sim.bny, 8, "splash");
  audio.fail(kind);
  buzz(kind === "snap" ? 24 : 10);
  const s = useGame.getState();
  useGame.setState({
    phase: "idle",
    streak: 0,
    lair: wasLair && !s.rush ? false : s.lair,
    message: wasLair
      ? kind === "snap"
        ? "The boss snapped your line."
        : "The boss shook free."
      : kind === "snap"
        ? "The line snapped."
        : "It shook free.",
    detail: "",
  });
  persistSoon();
}

function autoCatch() {
  const s = useGame.getState();
  if (sim.phase !== "idle" || !s.auto || !s.autoOn) return;
  const castLure = s.lure;
  const spent = consumeLure(s);
  const luck = luckTotal(s, castLure);
  const fish = rollFish(s.biome, luck, { stage: stageOf(s.dex, s.biome), sig: sigEffect(s.sig) });
  const next = withCatch({ ...s, ...spent }, fish, { auto: true, perfect: false, frenzy: sim.frenzyLeft > 0 });
  burst(0.5, 0.74, 6, "splash");
  audio.land(Math.min(2, fish.t));
  useGame.setState({ ...spent, ...next });
  persistSoon();
}

export function frame(dt: number) {
  const s = useGame.getState();
  if (!s.hydrated) return;
  sim.t += dt;
  sim.trauma = Math.max(0, sim.trauma - dt * 1.7);
  sim.hitFlash = Math.max(0, sim.hitFlash - dt * 2.4);
  sim.flashA = Math.max(0, sim.flashA - dt * 1.6);
  updateBobber();
  tickParticles(dt);
  tickWeatherFx(dt);
  tickLeap(dt);
  tickSwimmers(dt);
  if (sim.introT > 0) sim.introT = Math.max(0, sim.introT - dt);

  /* Aquarium settlement every ~30s of play (offline time settles at hydrate). */
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

  /* Derby: rivals land fish over time; expiry pays the purse. */
  if (s.derby) {
    const now = Date.now();
    if (now >= s.derby.endsAt) {
      const rank = 1 + s.derby.rivals.filter((r) => r.s > s.derby!.score).length;
      const won = rank === 1;
      const reward = won ? 400 + 60 * s.lv : 0;
      useGame.setState((st) => ({
        derby: null,
        derbiesWon: st.derbiesWon + (won ? 1 : 0),
        c: st.c + reward,
        tot: st.tot + reward,
        toasts: pushToast(
          [...st.toasts],
          won ? `Derby won! ${money(reward)} purse.` : `Derby over — you placed #${rank}.`,
        ),
      }));
    } else {
      sim.fxAcc += dt;
      if (sim.fxAcc >= 1) {
        sim.fxAcc = 0;
        const pace = 14 + s.lv * 5 + s.biome * 9;
        useGame.setState((st) =>
          st.derby
            ? {
                derby: {
                  ...st.derby,
                  rivals: st.derby.rivals.map((r) => ({
                    ...r,
                    s: r.s + Math.round(Math.random() * pace * (0.4 + Math.random())),
                  })),
                },
              }
            : {},
        );
      }
    }
  }
  if (s.flash && s.motion && s.weather === 2 && Math.random() < dt * 0.22) sim.flashA = 0.5;

  if (sim.frenzyLeft > 0) sim.frenzyLeft = Math.max(0, sim.frenzyLeft - dt);
  const shown = Math.ceil(sim.frenzyLeft);
  if (shown !== sim.shownFrenzy) {
    sim.shownFrenzy = shown;
    useGame.setState({ frenzyLeft: sim.frenzyLeft });
  }

  if (sim.hitstop > 0) {
    sim.hitstop -= dt;
    paintHud();
    return;
  }

  if (sim.phase === "wait") {
    sim.waitLeft -= dt;
    if (sim.waitLeft <= 0) beginBite();
  } else if (sim.phase === "bite") {
    sim.biteLeft -= dt;
    if (sim.biteLeft <= 0) fail("slip");
  } else if (sim.phase === "reel" && sim.fish) {
    const fish = sim.fish;
    let speed = (70 + fish.t * 28 + fish.i * 1.5) / (1 + sim.reelSpeed * 0.07);
    const stage = stageOf(s.dex, s.biome);
    if (stage === 2) speed *= 1.3;
    if (currentMode === "sandbox") speed *= 0.6;
    const fx = sigEffect(s.sig);
    if (fx?.kind === "calm") speed *= fx.speed;
    const bossPhase = fish.boss ? Math.floor((sim.hits / Math.max(1, sim.need)) * 3) : 0;
    if (fish.boss) {
      speed *= bossPhase === 1 ? 1.5 : 1.32;
      /* Phase 2: the boss reverses and throws fake-outs. */
      if (bossPhase === 1) {
        sim.fxAcc += dt;
        if (sim.fxAcc > 0.7) {
          sim.fxAcc = 0;
          if (Math.random() < 0.55) {
            sim.cd = sim.cd > 0 ? -1 : 1;
            placeZone();
            sim.trauma = Math.min(1, sim.trauma + 0.15);
          }
        }
      }
    }
    sim.cp += sim.cd * speed * dt;
    if (sim.cp > 100) {
      sim.cp = 100;
      sim.cd = -1;
    }
    if (sim.cp < 0) {
      sim.cp = 0;
      sim.cd = 1;
    }
  }

  sim.weatherAcc += dt;
  if (sim.weatherAcc >= 45) {
    if (sim.phase === "bite" || sim.phase === "reel") sim.weatherAcc = 45;
    else {
      sim.weatherAcc = 0;
      useGame.setState({ weather: (Math.random() * 5) | 0 });
    }
  }

  if (sim.phase === "idle") {
    sim.calmAcc += dt;
    if (sim.calmAcc >= 70) {
      sim.calmAcc = 0;
      if (sim.frenzyLeft <= 0 && Math.random() < 0.42) {
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
  paintHud();
}

function startCast() {
  const s = useGame.getState();
  if (sim.phase !== "idle") return;
  audio.unlock();
  const inRush = !!s.rush;
  const lair = s.lair && (stageOf(s.dex, s.biome) >= 3 || inRush);
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
  sim.waitLeft = ((1200 + Math.random() * 2800) / 1000) * factor;
  sim.introT = lair ? sim.waitLeft + 1.2 : 0;
  sim.phase = "wait";
  sim.trauma = Math.min(1, sim.trauma + 0.1);
  burst(sim.bnx, sim.bny, 7, "splash");
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
  sim.hits = 0;
  sim.tz = 0;
  sim.need = fish.boss ? 6 + Math.floor(s.biome / 3) : 2 + fish.t;
  const calmFx = sigEffect(s.sig);
  sim.zone = RODS[s.rod].zone + (calmFx?.kind === "calm" ? calmFx.zone : 0);
  sim.hold = LINES[s.line].hold;
  sim.reelSpeed = REELS[s.reel].speed;
  sim.cd = Math.random() < 0.5 ? -1 : 1;
  sim.cp = 8 + Math.random() * 84;
  placeZone();
  if (sim.perfect) {
    sim.hitstop = 0.06;
    sim.trauma = Math.min(1, sim.trauma + 0.4);
    audio.perfect();
  } else audio.hook();
  useGame.setState({
    phase: "reel",
    message: sim.perfect ? "Perfect hook." : "Hooked.",
    detail: `0/${sim.need} · line 100%`,
  });
}

function reelTap() {
  const fish = sim.fish;
  if (!fish || sim.phase !== "reel") return;
  if (Math.abs(sim.cp - sim.zc) <= sim.zone / 2) {
    sim.hits += 1;
    sim.trauma = Math.min(1, sim.trauma + 0.12);
    audio.tick();
    burst(sim.bnx, sim.bny, 5, "spark");
    if (sim.hits >= sim.need) {
      succeed();
      return;
    }
    placeZone();
    useGame.setState({
      message: "In the band.",
      detail: `${sim.hits}/${sim.need} · line ${linePct()}%`,
    });
  } else {
    /* Boss phase 3 (the run): misses strain the line 60% harder. */
    const phase3 = fish.boss && sim.hits >= Math.ceil(sim.need * (2 / 3));
    sim.tz += (1 + fish.t * 0.5 + fish.i / 20) * (fish.boss ? 1.15 : 1) * (phase3 ? 1.6 : 1);
    sim.trauma = Math.min(1, sim.trauma + 0.2);
    audio.miss();
    if (sim.tz >= sim.hold) {
      fail("snap");
      return;
    }
    useGame.setState({
      message: "Miss. The line strains.",
      detail: `${sim.hits}/${sim.need} · line ${linePct()}%`,
    });
  }
}

export function act() {
  audio.unlock();
  if (sim.phase === "idle") startCast();
  else if (sim.phase === "bite") hook();
  else if (sim.phase === "reel") reelTap();
}

/** Local co-op: player 2's reel tap (J key / Assist button). Same band,
    shared glory — a hit landed by either angler counts. */
export function assistTap() {
  if (sim.phase !== "reel") return;
  const before = sim.hits;
  reelTap();
  if (sim.phase === "reel" && sim.hits > before) {
    useGame.setState({ message: "Partner assist!", detail: `${sim.hits}/${sim.need} · line ${linePct()}%` });
  }
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
};

type Store = Save &
  Ui & {
    setTab: (tab: Tab) => void;
    setScreen: (screen: "menu" | "game") => void;
    setLodgeView: (view: LodgeView) => void;
    switchMode: (mode: Mode) => void;
    dismissWelcome: () => void;
    dismissToast: (id: number) => void;
    notify: (text: string) => void;
    buyGear: (kind: GearKind, index: number) => void;
    buyAuto: () => void;
    toggleAuto: () => void;
    buyPack: (index: number) => void;
    equipLure: (index: number) => void;
    buySig: (index: number) => void;
    equipSig: (index: number) => void;
    buyBait: (index: number) => void;
    equipBait: (index: number) => void;
    setLair: (on: boolean) => void;
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
    toggleSetting: (key: "sound" | "motion" | "flash") => void;
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
  mode: "career",
  lodgeView: "record",
  welcomeBack: null,
  setTab: (tab) => set({ tab, armRebirth: false, armReset: false }),
  setScreen: (screen) => set({ screen }),
  setLodgeView: (view) => set({ lodgeView: view, tab: "lodge" }),
  dismissWelcome: () => set({ welcomeBack: null }),
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
    if (!item || index <= s[kind]) return;
    if (s.c < item.price) {
      audio.fail("slip");
      return;
    }
    audio.coin();
    set({ c: s.c - item.price, [kind]: index });
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
    const box = { ...s.box };
    const names: string[] = [];
    for (let n = 0; n < 3; n++) {
      const x = pack.min + ((Math.random() * (pack.max - pack.min)) | 0);
      box[String(x)] = (box[String(x)] || 0) + 12 + ((Math.random() * 14) | 0);
      names.push(LURES[x].name);
    }
    audio.coin();
    set({ c: s.c - pack.price, box, pull: names.join(", ") });
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
    if (currentMode !== "sandbox" && s.c < item.price) {
      audio.fail("slip");
      return;
    }
    audio.coin();
    set({ c: currentMode === "sandbox" ? s.c : s.c - item.price, sigBox: [...s.sigBox, index], sig: index });
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
    if (currentMode !== "sandbox" && s.c < price) {
      audio.fail("slip");
      return;
    }
    audio.coin();
    const baitBox = { ...s.baitBox, [String(index)]: (s.baitBox[String(index)] || 0) + 1 };
    set({ c: currentMode === "sandbox" ? s.c : s.c - price, baitBox });
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
  addExhibit: (key) => {
    const s = get();
    const slots = TANK_TIERS[s.tank.tier].slots;
    if (!s.dex[key]?.c || s.tank.exhibits.includes(key) || s.tank.exhibits.length >= slots) return;
    set({ tank: { ...s.tank, exhibits: [...s.tank.exhibits, key] } });
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
      .filter((k) => s.dex[k]?.c)
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
    const names = ["Maren", "Old Cobb", "Pike Queen", "Juno", "The Professor", "Silent Sam"];
    const rivals = [...names].sort(() => Math.random() - 0.5).slice(0, 3).map((n) => ({ n, s: 0 }));
    audio.frenzy();
    set({
      derby: { endsAt: Date.now() + 10 * 60_000, score: 0, rivals },
      tab: "cast",
      toasts: pushToast([...s.toasts], "Derby started — most value in 10 minutes wins."),
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
    if (currentMode === "sandbox") {
      set((st) => ({ toasts: pushToast([...st.toasts], "Nothing is sold in Zen Waters.") }));
      return;
    }
    const item = s.inv[index];
    if (!item) return;
    const inv = s.inv.filter((_, j) => j !== index);
    const gained = Math.round(item.v * multOf(s.dex, s.rb));
    audio.coin();
    set({ inv, c: s.c + gained, tot: s.tot + gained, contracts: bumpBank(s.contracts, gained) });
    persistSoon();
  },
  sellUpTo: (maxRarity) => {
    const s = get();
    if (currentMode === "sandbox") {
      set((st) => ({ toasts: pushToast([...st.toasts], "Nothing is sold in Zen Waters.") }));
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
    set({ inv, c: s.c + gained, tot: s.tot + gained, contracts: bumpBank(s.contracts, gained) });
    persistSoon();
  },
  travel: (index) => {
    const s = get();
    if (sim.phase !== "idle" || index === s.biome || s.rush) return;
    const owned = s.ub.includes(index);
    const price = BIOMES[index].price;
    if (!owned && s.c < price) return;
    audio.coin();
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
    set({ c: s.c + contract.reward, tot: s.tot + contract.reward, contracts });
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
    if (s.tot < 1e7 || s.ub.length < BIOMES.length || sim.phase !== "idle") return;
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
      pins: s.pins.filter((k) => s.dex[k]?.c),
      sound: s.sound,
      motion: s.motion,
      flash: s.flash,
      tank: { ...s.tank, lastSettle: Date.now() },
      mastered: s.mastered,
      sigBox: s.sigBox,
      sig: s.sigBox.includes(s.sig) ? s.sig : -1,
      derbiesWon: s.derbiesWon,
      rushBest: s.rushBest,
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
      ...(currentMode === "sandbox" ? sandboxSave() : fresh()),
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
    const save = sanitize(raw);
    if (!raw || typeof raw !== "object") return false;
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
    const json = JSON.stringify(snapshot(get()));
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

function loadSlot(mode: Mode, toGame: boolean) {
  currentMode = mode;
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(modeKey(mode)) || "null");
  } catch {
    raw = null;
  }
  if (!raw && mode === "career") {
    try {
      raw = JSON.parse(localStorage.getItem("facultra") || "null");
    } catch {
      raw = null;
    }
  }
  let save: Save;
  if (!raw && mode === "sandbox") save = sandboxSave();
  else save = sanitize(raw);
  if (!raw && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    save.motion = false;
    save.flash = false;
  }
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
  audio.setEnabled(save.sound);
  resetSim();
  useGame.setState({
    ...save,
    hydrated: true,
    mode,
    screen: toGame ? "game" : "menu",
    phase: "idle",
    message: "Ready to cast.",
    detail: "",
    frenzyLeft: 0,
    armRebirth: false,
    armReset: false,
    lastCatch: null,
    pull: "",
    welcomeBack,
  });
  persistNow();
}

export function hydrate(mode: Mode = "career") {
  loadSlot(mode, false);
  bindLifecycle();
}

export function downloadSave() {
  const blob = new Blob([JSON.stringify(snapshot(useGame.getState()))], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fac-ultra.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

