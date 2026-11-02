/* What the water draws at each graphics tier, and the small pure rules behind
   the living-water effects (docs/architecture/03 §3, §7 and 09 §1.2). */

import { LEVELS, LEVEL_TIER, autoCeiling, levelDown, levelIndex, levelUp, type Form, type Gfx, type Level } from "./device.ts";

export type TierSpec = {
  /** Height in px of each ripple strip. */
  strip: number;
  /** Redraw the ripple every Nth frame (the cached frame is reused between). */
  rippleEvery: number;
  /** Ripple only the water region (mobile) instead of the whole picture. */
  waterOnly: boolean;
  glints: number;
  rays: boolean;
  plankton: boolean;
  /** Particle cap for the whole stage. */
  particles: number;
  swimmers: number;
  /** Swimmers are drawn onto the buffer so they shimmer with the surface. */
  swimmersThroughWater: boolean;
  /** Share of the normal rain-ring rate. */
  rainRings: number;
  confetti: number;
  /** Painting width to load, in px. */
  art: 1600 | 800;
  dprCap: number;
};

export const TIERS: Record<Gfx, TierSpec> = {
  full: {
    strip: 2, rippleEvery: 1, waterOnly: false, glints: 40, rays: true, plankton: true,
    particles: 90, swimmers: 5, swimmersThroughWater: true, rainRings: 1, confetti: 60, art: 1600, dprCap: 2,
  },
  lite: {
    strip: 4, rippleEvery: 1, waterOnly: false, glints: 20, rays: false, plankton: false,
    particles: 60, swimmers: 5, swimmersThroughWater: true, rainRings: 1, confetti: 40, art: 1600, dprCap: 2,
  },
  mobile: {
    strip: 6, rippleEvery: 2, waterOnly: true, glints: 12, rays: false, plankton: false,
    particles: 30, swimmers: 3, swimmersThroughWater: false, rainRings: 0.5, confetti: 24, art: 800, dprCap: 1.5,
  },
};

export function tierDown(g: Gfx): Gfx {
  return g === "full" ? "lite" : "mobile";
}

/* ── The five named levels (09 §1.4) ──────────────────────────────────────
   Ultra and High both draw with the `full` tier, Medium with `lite`, Low and Potato with `mobile`. The levels that share a
   tier differ by a small trim, so the tier table above stays the one place that says what a tier draws. */

const TRIM: Partial<Record<Level, Partial<TierSpec>>> = {
  high: { glints: 30, particles: 70, confetti: 48, plankton: false },
  potato: {
    strip: 8, rippleEvery: 3, glints: 4, particles: 12, swimmers: 1, rainRings: 0.25, confetti: 8, dprCap: 1,
  },
};

const specCache = new Map<string, TierSpec>();
let activeLevel: Level = "ultra";

/** Tell the drawing code which level is in force (the store calls this whenever the level changes). */
export function setActiveLevel(level: Level) {
  activeLevel = level;
}

/** What the water draws for `tier` at the level in force. Always read this, never `TIERS[tier]` directly. */
export function tierSpec(tier: Gfx): TierSpec {
  const trim = LEVEL_TIER[activeLevel] === tier ? TRIM[activeLevel] : undefined;
  if (!trim) return TIERS[tier];
  const key = `${tier}:${activeLevel}`;
  let spec = specCache.get(key);
  if (!spec) {
    spec = { ...TIERS[tier], ...trim };
    specCache.set(key, spec);
  }
  return spec;
}

/** Plain-English lines for Settings: what each level changes. */
export const LEVEL_INFO: Record<Level, { label: string; line: string }> = {
  ultra: { label: "Ultra", line: "Everything on: sun rays, floating specks, lots of sparkle and the smoothest water." },
  high: { label: "High", line: "Almost everything. A few less sparkles and no floating specks." },
  medium: { label: "Medium", line: "Simpler water ripples, no sun rays, fewer sparkles and fewer bubbles." },
  low: { label: "Low", line: "Chunkier water, much fewer sparkles and bubbles. Great for phones and older computers." },
  potato: { label: "Potato", line: "As light as it gets: very simple water, almost no sparkles. For very old devices." },
};

export { LEVELS };

/* ── Ripples (03 §3.2) ───────────────────────────────────────────────────── */

/** Sunny, Rain, Storm, Fog, Night — same order as WEATHER in content.ts. */
export const RIPPLE_WEATHER = [1.0, 1.3, 1.9, 0.7, 0.8] as const;

/** Sideways push in px for a strip at relative depth (0 at the waterline, 1 at the bottom). */
export function rippleAmp(depth: number, weather: number): number {
  const d = Math.min(1, Math.max(0, depth));
  return (1.5 + d * 6) * (RIPPLE_WEATHER[weather] ?? 1);
}

export function rippleDx(y: number, t: number, amp: number): number {
  return Math.sin(y * 0.035 + t * 1.7) * amp + Math.sin(y * 0.11 - t * 2.3) * amp * 0.35;
}

/** Rain ring spawns per second: a third of the rain particle rate, thinned by tier. */
export function rainRingRate(weather: number, tier: Gfx): number {
  const base = weather === 2 ? 50 : weather === 1 ? 28 : 0;
  return (base / 3) * tierSpec(tier).rainRings;
}

/* ── Time of day (03 §3.6) ───────────────────────────────────────────────── */

export type TimeTint = { color: string | null; alpha: number; night: boolean };

/** `hour` is local hours + minutes/60. Night weather forces the night window. */
export function timeTint(hour: number, weather: number, followClock: boolean): TimeTint {
  const night = { color: "#0b1a33", alpha: 0.32, night: true };
  if (weather === 4) return night;
  if (!followClock) return { color: null, alpha: 0, night: false };
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 7) return { color: "#ffb37a", alpha: 0.12, night: false };
  if (h >= 7 && h < 17) return { color: null, alpha: 0, night: false };
  if (h >= 17 && h < 19) return { color: "#ff8c5a", alpha: 0.16, night: false };
  return night;
}

/* ── fps governor (03 §7) ────────────────────────────────────────────────── */

/** Rolling average over the last 60 frame times. No allocation after creation. */
export class FpsMeter {
  private buf = new Float32Array(60);
  private n = 0;
  private i = 0;
  push(dt: number) {
    this.buf[this.i] = dt;
    this.i = (this.i + 1) % 60;
    if (this.n < 60) this.n++;
  }
  get full() {
    return this.n >= 60;
  }
  get fps() {
    if (!this.n) return 60;
    let sum = 0;
    for (let k = 0; k < this.n; k++) sum += this.buf[k];
    return sum > 0 ? this.n / sum : 60;
  }
  reset() {
    this.n = 0;
    this.i = 0;
  }
}

/* ── Speed test (the main signal) and the GPU hint (only a hint) ─────────── */

/** The level a measured frame rate earns. `fps` comes from the start-up speed test (probe.ts). */
export function levelFromFps(fps: number): Level {
  if (!(fps > 0)) return "low";
  if (fps >= 55) return "ultra";
  if (fps >= 46) return "high";
  if (fps >= 34) return "medium";
  if (fps >= 22) return "low";
  return "potato";
}

/** The GPU name is only a hint: it can hold the level back (software drawing, weak built-in chips), never push it up. */
export function levelCapFromRenderer(renderer: string | null | undefined): Level {
  const r = (renderer ?? "").toLowerCase();
  if (!r) return "ultra";
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(r)) return "low";
  if (/intel.*(hd graphics|uhd|iris)|mali-4|mali-t|adreno \(tm\) [1-5]\d\d|powervr|videocore/.test(r)) return "high";
  return "ultra";
}

/** The level Auto starts a session at: the speed test, held back by the GPU hint and by what this kind of device may do. */
export function levelFromProbe(fps: number, renderer: string | null | undefined): Level {
  const byFps = levelFromFps(fps);
  const cap = levelCapFromRenderer(renderer);
  return levelIndex(byFps) < levelIndex(cap) ? cap : byFps;
}

/* ── The governor (03 §7, 09 §1.4) ───────────────────────────────────────
   Quick down, slow up. Down: the frame rate stays under GOV_FPS for GOV_SECONDS and we drop one level. Up: only in Auto, only when the
   game has stayed smooth for UP_SECONDS, only once a session, never above what this kind of device may use, and never again after the
   player has pinned a level by hand. */

export type Governor = { lowFor: number; smoothFor: number; upDone: boolean; pinnedEver: boolean };
export const freshGovernor = (): Governor => ({ lowFor: 0, smoothFor: 0, upDone: false, pinnedEver: false });
export const GOV_FPS = 45;
export const GOV_SECONDS = 3;
export const UP_FPS = 57;
export const UP_SECONDS = 30;

export type GovInput = { fps: number; dt: number; ready: boolean; pinned: boolean; level: Level; form: Form };
export type GovOutput = { gov: Governor; change: Level | null; why: "slow" | "smooth" | null };

/** One decision per frame. `dt` is the real frame time in seconds. */
export function governorStep(gov: Governor, input: GovInput): GovOutput {
  if (input.pinned) return { gov: { ...gov, lowFor: 0, smoothFor: 0, pinnedEver: true }, change: null, why: null };
  if (!input.ready) return { gov: { ...gov, lowFor: 0, smoothFor: 0 }, change: null, why: null };
  if (input.fps < GOV_FPS) {
    const lowFor = gov.lowFor + input.dt;
    if (lowFor >= GOV_SECONDS && input.level !== "potato") {
      return { gov: { ...gov, lowFor: 0, smoothFor: 0 }, change: levelDown(input.level), why: "slow" };
    }
    return { gov: { ...gov, lowFor, smoothFor: 0 }, change: null, why: null };
  }
  if (input.fps < UP_FPS) return { gov: { ...gov, lowFor: 0, smoothFor: 0 }, change: null, why: null };
  const smoothFor = gov.smoothFor + input.dt;
  const room = levelIndex(input.level) > levelIndex(autoCeiling(input.form));
  if (smoothFor >= UP_SECONDS && !gov.upDone && !gov.pinnedEver && room) {
    return { gov: { ...gov, lowFor: 0, smoothFor: 0, upDone: true }, change: levelUp(input.level), why: "smooth" };
  }
  return { gov: { ...gov, lowFor: 0, smoothFor }, change: null, why: null };
}

/** Mobile drops to 30 fps after 60 s with no input and no cast in progress. */
export function shouldSkipFrame(tier: Gfx, idleMs: number, phase: string, frameNo: number): boolean {
  return tier === "mobile" && phase === "idle" && idleMs >= 60_000 && frameNo % 2 === 1;
}

/* ── Catch celebration (03 §4) ───────────────────────────────────────────── */

export type CelebrationInput = { rarity: number; discovered: boolean; record: boolean; boss: boolean; perfect: boolean };

export function confettiFor(tier: Gfx, rarity: number): number {
  return rarity >= 2 ? tierSpec(tier).confetti : 0;
}

/** Epic and up, or any new species, gets the brass fanfare. */
export function wantsFanfare(c: CelebrationInput): boolean {
  return c.rarity >= 3 || c.discovered || c.boss;
}

export const RARITY_COLORS = ["#9bb0b8", "#3dbe86", "#4aa3e8", "#e07a9a", "#e2a23a"] as const;
