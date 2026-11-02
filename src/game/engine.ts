import { create } from "zustand";
import { audio } from "@/game/audio";
import {
  AUTO_PRICE,
  BIOMES,
  BOATS,
  type Contract,
  dexCount,
  GEAR,
  type GearKind,
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
  WEATHER,
  xpNeed,
} from "@/game/content";

export type Tab = "cast" | "bag" | "gear" | "lures" | "waters" | "dex" | "lodge";
export type Phase = "idle" | "wait" | "bite" | "reel";

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

const KEY = "fac-ultra";
const SAVE_VERSION = 1;
const MARKS = [10, 25, 50, 100, 150, 200];

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
      biome: c.biome == null ? undefined : int(c.biome, 0, 0, 9),
    });
  }
  return out.length ? out : fallback;
}

export function sanitize(raw: unknown): Save {
  const base = fresh();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const dex: Save["dex"] = {};
  if (o.dex && typeof o.dex === "object") {
    for (const [k, val] of Object.entries(o.dex as object)) {
      if (!/^\d+-\d+$/.test(k)) continue;
      const [b, i] = k.split("-").map(Number);
      if (b < 0 || b > 9 || i < 0 || i > 19) continue;
      const e = val as { c?: number; w?: number; m?: number };
      const c = int(e?.c, 0, 0, 1e9);
      if (!c) continue;
      dex[k] = { c, w: num(e?.w, 0, 0, 1e6), m: int(e?.m, 0, 0, 5) };
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
        i: int(it.i, 0, 0, 19),
        b: int(it.b, 0, 0, 9),
        m: int(it.m, 0, 0, 5),
      });
    }
  }
  let ub = Array.isArray(o.ub) ? [...new Set(o.ub.map((n) => int(n, -1, 0, 9)).filter((n) => n >= 0))] : [0];
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
      if (typeof item !== "string" || !dex[item]?.c || pins.includes(item)) continue;
      pins.push(item);
      if (pins.length >= 8) break;
    }
  }
  const biome = int(o.biome ?? o.bi, 0, 0, 9);
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
    contracts: readContracts(o.contracts, base.contracts),
    pins,
    sound: bool(o.sound, true),
    motion: bool(o.motion, true),
    flash: bool(o.flash, true),
  };
}

function snapshot(s: Save): Save {
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
  };
}

function persistNow() {
  try {
    const json = JSON.stringify(snapshot(useGame.getState()));
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(KEY + "-bak", prev);
    localStorage.setItem(KEY, json);
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
  if (dexCount(s.dex) < 200) pool.push("discover");
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
  let untilBoss = s.untilBoss;
  if (!o.auto) untilBoss = fish.boss ? 12 : Math.max(0, s.untilBoss - 1);
  const toasts = [...s.toasts];
  if (discovered) pushToast(toasts, `New species. ${BIOMES[fish.b].fish[fish.i]}.`);
  if (gainedLv) pushToast(toasts, `Level ${lv}. ${rankName(lv)}.`);
  const count = dexCount(dex);
  if (discovered && MARKS.includes(count)) pushToast(toasts, `Dex ${count} of 200.`);
  if (fish.boss && !o.auto) pushToast(toasts, "Tide beast landed.");
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
    untilBoss,
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
  } else if (weather === 4 && biome === 6) {
    kind = "snow";
    rate = 16;
  } else if (biome === 6) {
    kind = "snow";
    rate = 8;
  } else if (biome === 8) {
    kind = "ember";
    rate = 10;
  } else if (biome === 5 || biome === 7) {
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
  const fish = rollFish(s.biome, luck, sim.bossCast);
  sim.fish = fish;
  sim.phase = "bite";
  sim.biteMax = (1300 + RODS[s.rod].zone * 8) / 1000;
  sim.biteLeft = sim.biteMax;
  sim.trauma = Math.min(1, sim.trauma + (fish.boss ? 0.62 : 0.28));
  audio.bite();
  buzz(fish.boss ? 28 : 16);
  burst(sim.bnx, sim.bny, fish.boss ? 16 : 8, "splash");
  useGame.setState({
    phase: "bite",
    message: fish.boss ? "Tide beast. Hook it." : "Bite. Hook it.",
    detail: "Early hooks pay more.",
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
    message: fish.boss ? "Tide beast landed." : "Landed.",
    detail: "",
  });
  persistSoon();
}

function fail(kind: "slip" | "snap") {
  sim.phase = "idle";
  sim.fish = null;
  sim.trauma = Math.min(1, sim.trauma + (kind === "snap" ? 0.6 : 0.22));
  burst(sim.bnx, sim.bny, 8, "splash");
  audio.fail(kind);
  buzz(kind === "snap" ? 24 : 10);
  useGame.setState({
    phase: "idle",
    streak: 0,
    message: kind === "snap" ? "The line snapped." : "It shook free.",
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
  const fish = rollFish(s.biome, luck, false);
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
    const speed = (70 + fish.t * 28 + fish.i * 1.5) / (1 + sim.reelSpeed * 0.07);
    const boss = fish.boss ? 1.32 : 1;
    sim.cp += sim.cd * speed * boss * dt;
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
  sim.castLure = s.lure;
  sim.bossCast = s.untilBoss <= 0;
  sim.perfect = false;
  const spent = consumeLure(s);
  const lureSpeed = sim.castLure >= 0 ? LURES[sim.castLure].speed : 0;
  const factor = Math.max(0.25, 1 - REELS[s.reel].speed * 0.04 - s.boat * 0.04 - lureSpeed / 100 - WEATHER[s.weather].bite);
  sim.waitLeft = ((1200 + Math.random() * 2800) / 1000) * factor;
  sim.phase = "wait";
  sim.trauma = Math.min(1, sim.trauma + 0.1);
  burst(sim.bnx, sim.bny, 7, "splash");
  audio.cast();
  useGame.setState({
    ...spent,
    phase: "wait",
    message: sim.bossCast ? "Something heavy is circling." : "Line in the water.",
    detail: "",
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
  sim.need = 2 + fish.t + (fish.boss ? 2 : 0);
  sim.zone = RODS[s.rod].zone;
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
    sim.tz += (1 + fish.t * 0.5 + fish.i / 20) * (fish.boss ? 1.15 : 1);
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
};

type Store = Save &
  Ui & {
    setTab: (tab: Tab) => void;
    dismissToast: (id: number) => void;
    notify: (text: string) => void;
    buyGear: (kind: GearKind, index: number) => void;
    buyAuto: () => void;
    toggleAuto: () => void;
    buyPack: (index: number) => void;
    equipLure: (index: number) => void;
    sellOne: (index: number) => void;
    sellUpTo: (maxRarity: number) => void;
    travel: (index: number) => void;
    claim: (id: string) => void;
    pin: (key: string) => void;
    rebirth: () => void;
    wipe: () => void;
    toggleSetting: (key: "sound" | "motion" | "flash") => void;
    importSave: (raw: unknown) => boolean;
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
  setTab: (tab) => set({ tab, armRebirth: false, armReset: false }),
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
  sellOne: (index) => {
    const s = get();
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
    if (sim.phase !== "idle" || index === s.biome) return;
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
      ...fresh(),
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
}));

export function hydrate() {
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    raw = null;
  }
  if (!raw) {
    try {
      raw = JSON.parse(localStorage.getItem("facultra") || "null");
    } catch {
      raw = null;
    }
  }
  const save = sanitize(raw);
  if (!raw && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    save.motion = false;
    save.flash = false;
  }
  if (dexCount(save.dex) >= 200) {
    save.contracts = save.contracts.map((c) =>
      c.kind === "discover" && c.prog < c.goal ? makeContract(save, "count") : c,
    );
  }
  audio.setEnabled(save.sound);
  resetSim();
  useGame.setState({
    ...save,
    hydrated: true,
    phase: "idle",
    message: "Ready to cast.",
    detail: "",
    frenzyLeft: 0,
    armRebirth: false,
    armReset: false,
  });
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

