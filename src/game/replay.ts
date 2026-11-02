/* Replaying a cast (docs/architecture/06 §1.3–1.4).

   A tournament cast is a seed plus the player's choices. The client plays it with the
   functions in this file; the server replays the envelope with the SAME functions and
   accepts the catch only if its own replay produces it. Pure and isomorphic: no store,
   no browser, no database, so it runs in Node, in the browser and in the tests.

   The order of every random draw is fixed here and nowhere else:
     1. the wait for a bite            (one draw)
     2. the fish and its weight/value   (rollFish: species, mutation, weight, value)
     3. the seed of the fight's own stream (one draw)
   After that the fight is `stepFight` on a stream of its own, so the player's inputs
   are the only thing left to decide the result.

   Tackle is fixed for everyone (EVENT_GEAR), which is what lets the server know it. */

import { BOATS, LINES, REELS, rollFish, RODS, WEATHER, type Rolled } from "./content.ts";
import { FIGHT_STEP, newFight, pushTrace, replayFight, TAP_STEPS, stepFight, type Drag, type Fight, type FightInit } from "./fight.ts";
import { habitOf } from "./habits.ts";
import { planCast, windowOf } from "./match.ts";
import { FAMILIES, isDepth, isRetrieve, type Presentation, type Window } from "./presentation.ts";
import { makeRng, rng, seedFrom, setRng } from "./rng.ts";
import { spotById } from "./spots.ts";
import { weatherAt } from "./weather.ts";

/** What everyone fishes with in an event: Pro Qualifier rod, Shimano Elite reel, Braid 50lb, the shore. */
export const EVENT_GEAR = { rod: 6, reel: 4, line: 4, boat: 0 } as const;

/** Every species in the water can bite (the boss does not: no Lair in events). */
export const EVENT_STAGE = 3;

/** Most fight steps a replay will run (200 s of fighting), and the most trace entries accepted. */
export const MAX_FIGHT_STEPS = 4000;
export const MAX_TRACE_ENTRIES = 2400;
/** An envelope's `hook` is milliseconds after the bite began; -1 means the bite was missed. */
export const MISSED = -1;

/** The event facts a replay needs. */
export type ReplayEvent = { id: string; seed: number; water: number; startsAt: number };

export type Claim = { out: "missed" | "lost" | "landed"; i: number; w: number; v: number };

export type Envelope = {
  /** Which cast of the entry, counting from 0. */
  castIndex: number;
  /** Server-clock milliseconds when the line went in. */
  at: number;
  spot: string;
  p: Presentation;
  /** Milliseconds after the bite began that the player hooked it; -1 when missed. */
  hook: number;
  /** Fight input trace: [released, held, released, held, …] in 50 ms steps (fight.ts pushTrace). */
  inputs: number[];
  drag: Drag;
  released: boolean;
  /** What the client says happened. The server checks it against its own replay. */
  claim: Claim;
};

export function castSeed(eventId: string, playerId: string, castIndex: number): number {
  return seedFrom(eventId, playerId, castIndex);
}

/** The time of day for an event: the UTC clock, the same for everyone. Night weather is not used. */
export function windowAt(at: number, weather: number): Window {
  const d = new Date(at);
  return windowOf(d.getUTCHours() + d.getUTCMinutes() / 60, weather);
}

/** Luck in an event is the fixed rod, the fixed boat and the sky. No levels, no rebirths, no dex. */
export function eventLuck(weather: number): number {
  return RODS[EVENT_GEAR.rod].luck + BOATS[EVENT_GEAR.boat].luck + WEATHER[weather].luck;
}

/** Everything one cast decides before the first reel turn. */
export type CastRoll = {
  weather: number;
  window: Window;
  luck: number;
  /** Seconds from the cast until the bite. */
  waitSec: number;
  /** Seconds the bite waits for a hook. */
  biteMax: number;
  fish: Rolled;
  /** Seeds the fight's own stream. */
  fightSeed: number;
};

/** Roll a cast: null if the spot is not in this water. Draws from a stream of its own, so it
    never disturbs (or is disturbed by) anything else that uses `rng()`. */
export function rollCast(
  ev: ReplayEvent,
  playerId: string,
  castIndex: number,
  spotId: string,
  p: Presentation,
  at: number,
): CastRoll | null {
  const spot = spotById(ev.water, spotId);
  if (!spot) return null;
  const weather = weatherAt(ev.seed, at - ev.startsAt);
  const window = windowAt(at, weather);
  const luck = eventLuck(weather);
  const plan = planCast(ev.water, spot, p, weather, window, luck, { stage: EVENT_STAGE });
  const rs = makeRng(castSeed(ev.id, playerId, castIndex));
  /* The wait, exactly as the career's startCast works it out, without the lure, bait and mode terms. */
  const factor = Math.max(0.25, 1 - REELS[EVENT_GEAR.reel].speed * 0.04 - EVENT_GEAR.boat * 0.04 - WEATHER[weather].bite);
  const waitSec = Math.max(0.7, ((1200 + rs() * 2800) / 1000) * factor * plan.wait);
  const before = rng;
  setRng(rs);
  let fish: Rolled;
  try {
    fish = rollFish(ev.water, luck, { stage: EVENT_STAGE, match: plan.ms });
  } finally {
    setRng(before);
  }
  const fightSeed = (rs() * 4294967296) >>> 0;
  return { weather, window, luck, waitSec, biteMax: (1300 + RODS[EVENT_GEAR.rod].zone * 8) / 1000, fish, fightSeed };
}

/** The fight for a rolled cast. No Helping Hand, no calm lures, no partner. */
export function fightInitOf(roll: CastRoll, drag: Drag): FightInit {
  const habit = habitOf(roll.fish.b, roll.fish.i);
  return {
    seed: roll.fightSeed,
    rarity: roll.fish.t,
    style: habit.fight,
    stamina: habit.stamina,
    boss: false,
    biome: roll.fish.b,
    hold: LINES[EVENT_GEAR.line].hold,
    reelSpeed: REELS[EVENT_GEAR.reel].speed,
    drag,
    pullMul: 1,
    bandPad: Math.max(0, RODS[EVENT_GEAR.rod].zone - 18) * 0.0015,
  };
}

/* ── The envelope as untrusted data ──────────────────────────────────────── */

const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
const isNum = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

export type Parsed = { ok: true; env: Envelope } | { ok: false; reason: string };

/** An envelope from anything the network handed us. Strict: unknown shapes are refused, not repaired. */
export function parseEnvelope(v: unknown): Parsed {
  const bad = (reason: string): Parsed => ({ ok: false, reason });
  if (!v || typeof v !== "object" || Array.isArray(v)) return bad("not_an_object");
  const o = v as Record<string, unknown>;
  if (!isInt(o.castIndex, 0, 100_000)) return bad("castIndex");
  if (!isNum(o.at, 0, 4e12)) return bad("at");
  if (typeof o.spot !== "string" || o.spot.length < 1 || o.spot.length > 48) return bad("spot");
  const p = o.p as Record<string, unknown> | undefined;
  if (!p || typeof p !== "object") return bad("p");
  if (typeof p.family !== "string" || !(FAMILIES as readonly string[]).includes(p.family)) return bad("p.family");
  if (!isDepth(p.depth)) return bad("p.depth");
  if (!isRetrieve(p.retrieve)) return bad("p.retrieve");
  if (!isInt(o.hook, -1, 10_000)) return bad("hook");
  if (!Array.isArray(o.inputs) || o.inputs.length > MAX_TRACE_ENTRIES) return bad("inputs");
  for (let i = 0; i < o.inputs.length; i++) {
    const n = o.inputs[i];
    if (!isInt(n, i === 0 ? 0 : 1, MAX_FIGHT_STEPS)) return bad("inputs");
  }
  if (!(o.drag === 0 || o.drag === 1 || o.drag === 2)) return bad("drag");
  if (typeof o.released !== "boolean") return bad("released");
  const c = o.claim as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object") return bad("claim");
  if (c.out !== "missed" && c.out !== "lost" && c.out !== "landed") return bad("claim.out");
  if (!isInt(c.i, 0, 99) || !isNum(c.w, 0, 1e6) || !isNum(c.v, 0, 1e12)) return bad("claim.fish");
  return {
    ok: true,
    env: {
      castIndex: o.castIndex,
      at: o.at,
      spot: o.spot,
      p: { family: p.family as Presentation["family"], depth: p.depth, retrieve: p.retrieve },
      hook: o.hook,
      inputs: o.inputs as number[],
      drag: o.drag,
      released: o.released,
      claim: { out: c.out, i: c.i, w: c.w, v: c.v },
    },
  };
}

/* ── Replay ──────────────────────────────────────────────────────────────── */

export type Replayed =
  | {
      ok: true;
      outcome: "missed" | "lost" | "landed";
      /** Why a fight was lost. */
      why?: "snap" | "slip";
      fish: Rolled;
      /** Seconds the cast used: the wait, the hook, the fight. */
      seconds: number;
      steps: number;
      roll: CastRoll;
    }
  | { ok: false; reason: string };

/** Could a person have made this trace? A tap is a 150 ms hold (three steps), so a held run shorter than
    that can only be the last one, cut off when the fight ended. */
export function traceReason(inputs: readonly number[]): string | null {
  let steps = 0;
  for (let i = 0; i < inputs.length; i++) {
    steps += inputs[i];
    const held = i % 2 === 1;
    if (held && inputs[i] < TAP_STEPS && i !== inputs.length - 1) return "impossible_input";
  }
  if (steps > MAX_FIGHT_STEPS) return "too_long";
  return null;
}

/** Run the cast from its seed and the player's choices. Does not look at the claim. */
export function replayCast(ev: ReplayEvent, playerId: string, env: Envelope): Replayed {
  const roll = rollCast(ev, playerId, env.castIndex, env.spot, env.p, env.at);
  if (!roll) return { ok: false, reason: "unknown_spot" };
  if (env.hook === MISSED) {
    if (env.inputs.length) return { ok: false, reason: "input_without_hook" };
    return { ok: true, outcome: "missed", fish: roll.fish, seconds: roll.waitSec + roll.biteMax, steps: 0, roll };
  }
  if (env.hook > roll.biteMax * 1000 + 1) return { ok: false, reason: "hook_too_late" };
  const why = traceReason(env.inputs);
  if (why) return { ok: false, reason: why };
  const total = env.inputs.reduce((a, b) => a + b, 0);
  const F = replayFight(fightInitOf(roll, env.drag), env.inputs, MAX_FIGHT_STEPS);
  if (!F.result) return { ok: false, reason: "unfinished" };
  /* An honest trace ends on the step that ended the fight, never before it and never after. */
  if (F.steps !== total) return { ok: false, reason: "trace_length" };
  const seconds = roll.waitSec + env.hook / 1000 + F.steps * FIGHT_STEP;
  const landed = F.result === "landed";
  return {
    ok: true,
    outcome: landed ? "landed" : "lost",
    why: landed ? undefined : (F.result as "snap" | "slip"),
    fish: roll.fish,
    seconds,
    steps: F.steps,
    roll,
  };
}

/** The claim an honest client would make for a replayed cast. */
export function claimOf(r: Extract<Replayed, { ok: true }>): Claim {
  return r.outcome === "landed"
    ? { out: "landed", i: r.fish.i, w: r.fish.w, v: r.fish.v }
    : { out: r.outcome, i: 0, w: 0, v: 0 };
}

export function claimMatches(c: Claim, r: Extract<Replayed, { ok: true }>): boolean {
  const want = claimOf(r);
  return c.out === want.out && c.i === want.i && Math.abs(c.w - want.w) < 1e-6 && c.v === want.v;
}

/* ── An honest player, headless (tests, the dev bot, the Unverified-free smoke) ─────────────────── */

export type Choice = { spot: string; p: Presentation; drag: Drag; hookMs: number };

/** What a decent angler does: reel while the line is easy, let go when it is tight or the fish runs. */
export function decentPlayer(): (F: Fight) => boolean {
  let down = false;
  return (F) => {
    if (F.tension > 0.8 || F.warn !== "none" || F.run > 0 || F.jump > 0) down = false;
    else if (F.tension < 0.6) down = true;
    return down;
  };
}

/** The button masher: always reel. */
export const masher = (): (() => boolean) => () => true;

/** Play one cast the way the live client does (the same press/hold/step rules as engine.ts) and write the
    envelope it would send. `want(F)` says whether the reel is pressed at the start of each step. */
export function recordCast(
  ev: ReplayEvent,
  playerId: string,
  castIndex: number,
  at: number,
  choice: Choice,
  want: (F: Fight) => boolean = decentPlayer(),
): Envelope {
  const roll = rollCast(ev, playerId, castIndex, choice.spot, choice.p, at);
  if (!roll) throw new Error(`no spot ${choice.spot} in water ${ev.water}`);
  const base = { castIndex, at, spot: choice.spot, p: choice.p, drag: choice.drag, released: false };
  if (choice.hookMs < 0 || choice.hookMs > roll.biteMax * 1000) {
    return { ...base, hook: MISSED, inputs: [], claim: { out: "missed", i: 0, w: 0, v: 0 } };
  }
  const F = newFight(fightInitOf(roll, choice.drag));
  const inputs: number[] = [];
  let down = false;
  let tapLeft = 0;
  for (let s = 0; s < MAX_FIGHT_STEPS && !F.result; s++) {
    const now = want(F);
    if (now && !down) tapLeft = TAP_STEPS;
    down = now;
    const held = down || tapLeft > 0;
    if (tapLeft > 0) tapLeft--;
    pushTrace(inputs, held);
    stepFight(F, held, FIGHT_STEP);
  }
  const landed = F.result === "landed";
  const claim: Claim = landed
    ? { out: "landed", i: roll.fish.i, w: roll.fish.w, v: roll.fish.v }
    : { out: "lost", i: 0, w: 0, v: 0 };
  return { ...base, hook: Math.round(choice.hookMs), inputs, claim };
}
