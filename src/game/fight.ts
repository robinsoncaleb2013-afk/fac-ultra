/* The fight v2: a tension-and-position game (docs/architecture/04 §5).

   Hold to reel, let go to give line. Keep the needle in the green: too slack and
   you gain nothing, too tight and the line strains until it snaps. The fish tires
   when it pulls against you, so the whole fight is patience and feel.

   Everything here is PURE. `stepFight(F, held, 0.05)` advances one fixed 50 ms step
   and is the only thing that changes a fight. The engine feeds it from an
   accumulator, so the result does not depend on frame rate, and the server
   (WP-7, docs/architecture/06 §1.4) can replay the same fight from the same seed
   and the same input trace and land on the same result.

   The fight owns its own tiny random stream (`F.rs`, seeded once at the hook), so
   a run of steps never touches the shared model stream and replays exactly.

   Numbers are in FIGHT below. They are the spec's formulas with the constants
   re-tuned until the targets in 04 §5.7 held (see fight.test.ts); the PR
   description lists where and why they moved. */

import type { FightHelp } from "./assist.ts";
import type { FightStyle } from "./habits.ts";
import { tickPoints, WEAR, wearFactor } from "./line-wear.ts";

/** Fixed step, seconds. Client and server both tick at this rate. */
export const FIGHT_STEP = 0.05;
/** A tap is a 120 ms hold: three steps (150 ms), the nearest whole number of steps. */
export const TAP_STEPS = 3;

export type Drag = 0 | 1 | 2;
export type FightResult = null | "landed" | "snap" | "slip";
/** What a telegraphed warning is about. */
export type Warn = "none" | "run" | "jump";

/** The tuning table. Edit here, run fight.test.ts. */
export const FIGHT = {
  /** Base pull = BASE + PER_RARITY · rarity, times (0.5 + stamina). */
  base: 0.35,
  perRarity: 0.25,
  /** Held: tension heads for TARGET_0 + TARGET_1 · pull. Released: for SLACK_0 + SLACK_1 · pull. */
  target0: 0.34,
  target1: 0.55,
  slack0: 0.05,
  slack1: 0.1,
  /** How fast tension follows its target (per second). */
  rateUp: 2.4,
  rateDown: 1.6,
  thrashRate: 2.2,
  /** Drag: loose 0 · normal 1 · tight 2. Tight lands faster and snaps easier. */
  dragRate: [0.7, 1, 1.35],
  dragTarget: [0.92, 1, 1.1],
  dragReel: [0.85, 1, 1.18],
  /** Distance: the fish takes AWAY · pull per second; a held reel gives back REEL · GAIN. */
  away: 0.05,
  /** A fish always drifts a little, whatever it is doing. */
  drift: 0,
  /** How much of a run's or thrash's extra pull also takes line (the rest only loads the line). */
  surgeAway: 0.35,
  reel: 0.55,
  reelPerSpeed: 0.04,
  gain: 0.3,
  /** Below this tension the line is slack and the reel mostly spins. */
  slackLine: 0.25,
  slackGain: 0.4,
  /** The fish tires faster the harder it pulls against you. */
  tire0: 0.04,
  tire1: 0.2,
  /** Red zone: above this the line strains. */
  red: 0.92,
  strainRate: 3,
  strainRecover: 0.5,
  /** Green band, and Helping Hand's widest version of it (04 §5.5, §5.6). */
  band: [0.35, 0.78] as const,
  bandHelp: [0.28, 0.85] as const,
  /** Run / jump timing (04 §5.4). */
  runEvery: [4, 7] as const,
  runFor: 1.5,
  runMul: 2.2,
  jumpEvery: [5, 8] as const,
  jumpFor: 0.8,
  jumpThrow: 0.35,
  /** Seconds of held reel through a jump before the throw can happen. */
  jumpGrace: 0.2,
  telegraph: 0.4,
  telegraphHelp: 0.8,
  startDist: 1,
  slipDist: 1.3,
  startTension: 0.3,
  bossMul: 1.3,
} as const;

export type FightInit = {
  /** Seeds the fight's own random stream. */
  seed: number;
  /** 0 common … 3 epic · 4 legendary (bosses). */
  rarity: number;
  style: FightStyle;
  /** Habit stamina, 0.6–1.8. */
  stamina: number;
  boss: boolean;
  /** Which water; picks the boss's signature trick. */
  biome: number;
  /** Line strength: seconds-of-strain budget (LINES[i].hold). */
  hold: number;
  /** REELS[i].speed. */
  reelSpeed: number;
  drag: Drag;
  /** Multiplies the fish's pull: modes, deep-water stage, calm lures. Default 1. */
  pullMul?: number;
  /** Extra width on both sides of the green band (calm lures). Default 0. */
  bandPad?: number;
  /** Line wear (WP-14, rules version 2): the line's health in points. 0 or missing = the line never wears out. */
  lineHealth?: number;
  /** Multiplies the wear: mode, Kid Mode, difficulty (docs/architecture/10 §1.5). Default 1. */
  wearMul?: number;
};

export type Fight = {
  /** 0–1 line load. The needle. */
  tension: number;
  /** 1 → 0 fish distance; 0 is landed, 1.3 is lost. */
  dist: number;
  /** 1 → 0 fish energy. */
  stamina: number;
  /** Seconds left of a run (>0 while the fish is running). */
  run: number;
  style: FightStyle;
  reeling: boolean;
  drag: Drag;
  /* the line */
  strain: number;
  hold: number;
  /* the green band and the help */
  lo: number;
  hi: number;
  strainMul: number;
  tele: number;
  pullMul: number;
  /** The gear's and the mode's share of `pullMul` and of the band, before Helping Hand. */
  basePull: number;
  bandPad: number;
  /* the fish */
  rarity: number;
  habitStamina: number;
  boss: boolean;
  biome: number;
  reelSpeed: number;
  /** Local co-op: player two is also holding the reel (adds 0.2 reel). */
  partner: boolean;
  /* the schedule */
  t: number;
  steps: number;
  next: number;
  /** Seconds until the warned-about run or jump begins. */
  telegraph: number;
  warn: Warn;
  jump: number;
  jumpRoll: boolean;
  jumpHeld: number;
  /** Boss trick clocks. */
  trickNext: number;
  /** Frost Dragon: seconds the needle is frozen on screen. */
  freeze: number;
  /** What the needle shows (equals `tension` unless frozen). */
  shown: number;
  /** Marble Emperor: seconds of statue stillness, then of the surge. */
  still: number;
  surge: number;
  /* edge counters the engine reads for sound, haptics and coaching */
  runs: number;
  jumps: number;
  warns: number;
  reds: number;
  red: boolean;
  /** 0–8: how many eighths of the way to landed (a "tick" each). */
  ticks: number;
  /** Seconds the line has been in the red, in total. */
  redTime: number;
  rs: number;
  result: FightResult;
  /* line wear (10 §1): health in points left and at the start (0 max = no wear), the base multiplier and the one
     Helping Hand has eased it to, and whether the fight ended because the line wore out. */
  life: number;
  lifeMax: number;
  wearBase: number;
  wearMul: number;
  worn: boolean;
};

/* ── The fight's own random stream (mulberry32 on F.rs) ──────────────────── */

function rand(F: Fight): number {
  F.rs = (F.rs + 0x6d2b79f5) >>> 0;
  let t = F.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function between(F: Fight, [lo, hi]: readonly [number, number]) {
  return lo + rand(F) * (hi - lo);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── Boss fights (04 §5.4) ───────────────────────────────────────────────── */

/** Boss style by thirds of the distance left: runner → thrasher → bulldog. */
export function bossStyle(dist: number): FightStyle {
  return dist > 2 / 3 ? "runner" : dist > 1 / 3 ? "thrasher" : "bulldog";
}

/** The two bosses with a signature trick (EXPANSION-DESIGN §2): Arctic's Frost Dragon and Sunken City's Marble Emperor. */
export type Trick = "freeze" | "statue" | "none";
export const ARCTIC = 9;
export const SUNKEN_CITY = 11;
export function trickOf(boss: boolean, biome: number): Trick {
  if (!boss) return "none";
  return biome === ARCTIC ? "freeze" : biome === SUNKEN_CITY ? "statue" : "none";
}

/* ── Create ──────────────────────────────────────────────────────────────── */

export function newFight(init: FightInit): Fight {
  const pad = init.bandPad ?? 0;
  const F: Fight = {
    tension: FIGHT.startTension,
    dist: FIGHT.startDist,
    stamina: 1,
    run: 0,
    style: init.boss ? bossStyle(FIGHT.startDist) : init.style,
    reeling: false,
    drag: init.drag,
    strain: 0,
    hold: Math.max(0.5, init.hold),
    lo: FIGHT.band[0] - pad,
    hi: FIGHT.band[1] + pad,
    strainMul: 1,
    tele: FIGHT.telegraph,
    pullMul: init.pullMul ?? 1,
    basePull: init.pullMul ?? 1,
    bandPad: pad,
    rarity: init.rarity,
    habitStamina: Math.max(0.3, init.stamina),
    boss: init.boss,
    biome: init.biome,
    reelSpeed: init.reelSpeed,
    partner: false,
    t: 0,
    steps: 0,
    next: 0,
    telegraph: 0,
    warn: "none",
    jump: 0,
    jumpRoll: false,
    jumpHeld: 0,
    trickNext: 0,
    freeze: 0,
    shown: FIGHT.startTension,
    still: 0,
    surge: 0,
    runs: 0,
    jumps: 0,
    warns: 0,
    reds: 0,
    red: false,
    ticks: 0,
    redTime: 0,
    rs: init.seed >>> 0,
    result: null,
    life: Math.max(0, init.lineHealth ?? 0),
    lifeMax: Math.max(0, init.lineHealth ?? 0),
    wearBase: Math.max(0, init.wearMul ?? 1),
    wearMul: Math.max(0, init.wearMul ?? 1),
    worn: false,
  };
  F.next = between(F, F.style === "jumper" ? FIGHT.jumpEvery : FIGHT.runEvery);
  F.trickNext = 4 + rand(F) * 3;
  return F;
}

/* ── Help (Helping Hand, 04 §5.6) ────────────────────────────────────────── */

/** Put Helping Hand on a fight, or take it off with `null`: a wider green, half the strain at
    full strength, a longer warning before a run, and a fish that pulls a little less. Safe to call
    again mid-fight as the player's streak changes. */
export function applyHelp(F: Fight, help: FightHelp | null) {
  const s = help ? clamp(help.strength, 0, 1) : 0;
  F.lo = FIGHT.band[0] + (FIGHT.bandHelp[0] - FIGHT.band[0]) * s - F.bandPad;
  F.hi = FIGHT.band[1] + (FIGHT.bandHelp[1] - FIGHT.band[1]) * s + F.bandPad;
  F.strainMul = 1 - 0.5 * s;
  F.tele = FIGHT.telegraph + (FIGHT.telegraphHelp - FIGHT.telegraph) * s;
  F.pullMul = F.basePull * (help ? help.pullMul : 1);
  F.wearMul = F.wearBase * (1 - WEAR.helpEase * s);
}

/* ── One step ────────────────────────────────────────────────────────────── */

/** How much the fish pulls, before stamina. */
function styleMod(F: Fight): number {
  let m = 1;
  switch (F.style) {
    case "runner":
      m = F.run > 0 ? FIGHT.runMul : 1;
      break;
    case "diver":
      m = 1.3;
      break;
    case "jumper":
      m = F.jump > 0 ? 0 : 1;
      break;
    case "bulldog":
      m = F.dist < 0.3 ? 1.8 : 0.9;
      break;
    case "thrasher":
      m = 1 + 0.8 * Math.sin(F.t * 9);
      break;
  }
  if (F.boss) {
    m *= FIGHT.bossMul;
    if (F.still > 0) m = 0;
    else if (F.surge > 0) m *= 3;
  }
  return m;
}

/** Stamina drain divisor for the style: divers hold on longer, bulldogs have a huge tank. */
function tank(F: Fight): number {
  const base = F.habitStamina;
  if (F.style === "diver") return base / 0.8;
  if (F.style === "bulldog") return base * 1.5;
  return base;
}

function schedule(F: Fight, dt: number) {
  /* A boss that has moved on from running stops running. */
  const scheduled = F.style === "runner" || F.style === "jumper";
  if (!scheduled) {
    F.run = 0;
    F.telegraph = 0;
    F.warn = "none";
  }
  if (scheduled) {
    if (F.run > 0) {
      F.run -= dt;
      if (F.run <= 0) {
        F.run = 0;
        F.next = between(F, FIGHT.runEvery);
      }
    } else if (F.jump > 0) {
      F.jump -= dt;
      if (F.reeling) F.jumpHeld += dt;
      if (F.jumpRoll && F.jumpHeld >= FIGHT.jumpGrace && !F.result) F.result = "slip";
      if (F.jump <= 0) {
        F.jump = 0;
        F.next = between(F, FIGHT.jumpEvery);
      }
    } else if (F.telegraph > 0) {
      F.telegraph -= dt;
      if (F.telegraph <= 0) {
        F.telegraph = 0;
        if (F.warn === "jump") {
          F.jump = FIGHT.jumpFor;
          F.jumps++;
          F.tension = 0;
          F.jumpRoll = rand(F) < FIGHT.jumpThrow;
          F.jumpHeld = 0;
        } else {
          F.run = FIGHT.runFor;
          F.runs++;
        }
        F.warn = "none";
      }
    } else {
      F.next -= dt;
      if (F.next <= 0) {
        F.telegraph = F.tele;
        F.warn = F.style === "jumper" ? "jump" : "run";
        F.warns++;
      }
    }
  }
  /* Boss signature tricks. */
  const trick = trickOf(F.boss, F.biome);
  if (trick === "freeze") {
    if (F.freeze > 0) F.freeze = Math.max(0, F.freeze - dt);
    else {
      F.trickNext -= dt;
      if (F.trickNext <= 0) {
        F.freeze = 0.6;
        F.trickNext = 5 + rand(F) * 3;
        F.shown = F.tension;
      }
    }
  } else if (trick === "statue") {
    if (F.still > 0) {
      F.still -= dt;
      if (F.still <= 0) {
        F.still = 0;
        F.surge = 1.2;
      }
    } else if (F.surge > 0) F.surge = Math.max(0, F.surge - dt);
    else {
      F.trickNext -= dt;
      if (F.trickNext <= 0) {
        F.still = 2;
        F.trickNext = 9 + rand(F) * 4;
      }
    }
  }
}

/** Advance the fight by one fixed step. `held` is whether the reel is held down for this step. */
export function stepFight(F: Fight, held: boolean, dt: number = FIGHT_STEP): void {
  if (F.result) return;
  F.reeling = held;
  F.t += dt;
  F.steps++;
  if (F.boss) {
    F.style = bossStyle(F.dist);
  }
  schedule(F, dt);
  if (F.result) return;

  const mod = styleMod(F);
  const body = (FIGHT.base + FIGHT.perRarity * F.rarity) * (0.5 + F.stamina) * F.pullMul;
  const pull = body * mod;
  /* A run loads the line hard; it takes less line than it looks like, so giving line is survivable. */
  const takes = body * (mod >= 1 ? 1 + (mod - 1) * FIGHT.surgeAway : mod);

  /* tension follows what the fish is doing to a held or a loose line */
  const target = held
    ? clamp(FIGHT.target0 + FIGHT.target1 * pull, 0, 1.1) * FIGHT.dragTarget[F.drag]
    : FIGHT.slack0 + FIGHT.slack1 * pull;
  /* A thrasher's wobble is faster than the line normally answers, so the line answers it faster. */
  const quick = F.style === "thrasher" ? FIGHT.thrashRate : 1;
  const rate = (held ? FIGHT.rateUp * FIGHT.dragRate[F.drag] : FIGHT.rateDown) * quick;
  F.tension = clamp(F.tension + (target - F.tension) * (1 - Math.exp(-rate * dt)), 0, 1);
  if (F.freeze <= 0) F.shown = F.tension;

  /* distance: the fish takes line, the reel gets it back, but only with some tension on */
  const reelIn =
    ((held ? FIGHT.reel * (1 + F.reelSpeed * FIGHT.reelPerSpeed) : 0) + (F.partner ? 0.2 : 0)) *
    FIGHT.dragReel[F.drag];
  const grip = F.tension > FIGHT.slackLine ? 1 : FIGHT.slackGain;
  F.dist = clamp(F.dist + dt * (FIGHT.drift + takes * FIGHT.away - reelIn * FIGHT.gain * grip), 0, FIGHT.slipDist);

  /* the fish tires when it pulls against a tight line */
  F.stamina = clamp(F.stamina - (dt * (FIGHT.tire0 + FIGHT.tire1 * F.tension)) / tank(F), 0, 1);

  /* the line */
  if (F.tension > FIGHT.red) {
    F.strain += dt * FIGHT.strainRate * F.strainMul;
    F.redTime += dt;
    if (!F.red) {
      F.red = true;
      F.reds++;
    }
  } else {
    if (F.tension < FIGHT.red - 0.07) F.red = false;
    F.strain = Math.max(0, F.strain - dt * FIGHT.strainRecover);
  }

  /* progress ticks, one per eighth of the way in */
  const eighths = clamp(Math.floor((1 - F.dist) * 8), 0, 8);
  if (eighths > F.ticks) F.ticks = eighths;

  /* the line wears: one tick of the fish's rate every WEAR.tickSteps steps (whole steps, so a replay is exact) */
  if (F.lifeMax > 0 && F.steps % WEAR.tickSteps === 0) {
    F.life = Math.max(0, F.life - tickPoints(F.rarity, F.boss) * wearFactor(F) * F.wearMul);
  }

  if (!F.result) {
    if (F.strain >= F.hold) F.result = "snap";
    else if (F.dist <= 0) F.result = "landed";
    else if (F.dist >= FIGHT.slipDist) F.result = "slip";
    else if (F.lifeMax > 0 && F.life <= 0) {
      F.result = "snap";
      F.worn = true;
    }
  }
}

/* ── Reading a fight (the ring, the pill, the coach) ─────────────────────── */

export type Zone = "slack" | "green" | "high" | "red";
export function zoneOf(F: Pick<Fight, "tension" | "lo" | "hi">): Zone {
  const t = F.tension;
  return t > FIGHT.red ? "red" : t > F.hi ? "high" : t < F.lo ? "slack" : "green";
}

/** 0 → 1 as the fish comes in. */
export function progressOf(F: Pick<Fight, "dist">): number {
  return clamp(1 - F.dist, 0, 1);
}

/** Line left, 0–100: the lower of what the strain and the wear have left. */
export function linePercent(F: Pick<Fight, "strain" | "hold"> & Partial<Pick<Fight, "life" | "lifeMax">>): number {
  const strain = 100 * (1 - F.strain / Math.max(0.01, F.hold));
  const wear = F.lifeMax && F.lifeMax > 0 ? (100 * (F.life ?? 0)) / F.lifeMax : 100;
  return Math.max(0, Math.round(Math.min(strain, wear)));
}

/* ── Input traces (the envelope in 06 §1.3) ──────────────────────────────── */

/** Record one step's input as alternating run lengths (in steps), starting with a RELEASED run
    (which may be 0 long): [released, held, released, held, …]. */
export function pushTrace(trace: number[], held: boolean) {
  if (trace.length === 0) trace.push(0);
  const wantHeld = held;
  const lastIsHeld = trace.length % 2 === 0;
  if (lastIsHeld === wantHeld) trace[trace.length - 1]++;
  else trace.push(1);
}

/** Expand a trace back to one boolean per step. */
export function expandTrace(trace: readonly number[]): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i < trace.length; i++) {
    const held = i % 2 === 1;
    for (let k = 0; k < trace[i]; k++) out.push(held);
  }
  return out;
}

/** Replay a whole fight from its init and input trace (what the server does). A trace that
    ends before the fight does leaves the reel released until it does. */
export function replayFight(init: FightInit, trace: readonly number[], maxSteps = 4000): Fight {
  const F = newFight(init);
  const inputs = expandTrace(trace);
  for (let i = 0; i < maxSteps && !F.result; i++) stepFight(F, inputs[i] ?? false, FIGHT_STEP);
  return F;
}

/* ── Coaching (04 §5.5): the first three fights per style, then silence ──── */

export const COACH_FIGHTS = 3;

export const COACH: Record<FightStyle, { start: string; warn: string }> = {
  runner: { start: "A runner. When it's about to run, let go.", warn: "It's running — let go!" },
  diver: { start: "A diver. It pulls hard but steady. Short pulls.", warn: "It's diving deep. Stay steady." },
  jumper: { start: "A jumper. When it leaps, ease off the reel.", warn: "It's jumping — ease off!" },
  bulldog: { start: "A bulldog. It holds on. Pull, rest, pull.", warn: "Heavy fish. Rest, then pull." },
  thrasher: { start: "A thrasher. Aim for the middle of the green.", warn: "It's thrashing. Don't chase the needle." },
};

export const STYLE_NAME: Record<FightStyle, string> = {
  runner: "Runner",
  diver: "Diver",
  jumper: "Jumper",
  bulldog: "Bulldog",
  thrasher: "Thrasher",
};
