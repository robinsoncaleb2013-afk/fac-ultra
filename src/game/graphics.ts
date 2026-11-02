/* What the water draws at each graphics tier, and the small pure rules behind
   the living-water effects (docs/architecture/03 §3, §7 and 09 §1.2). */

import type { Gfx } from "./device.ts";

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
  return (base / 3) * TIERS[tier].rainRings;
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

export type Governor = { lowFor: number };
export const GOV_FPS = 45;
export const GOV_SECONDS = 3;

/** One decision per frame. Steps DOWN only, and never when the player pinned a tier. */
export function governorStep(
  gov: Governor,
  input: { fps: number; dt: number; ready: boolean; pinned: boolean; tier: Gfx },
): { gov: Governor; down: Gfx | null } {
  if (input.pinned || input.tier === "mobile" || !input.ready) return { gov: { lowFor: 0 }, down: null };
  if (input.fps >= GOV_FPS) return { gov: { lowFor: 0 }, down: null };
  const lowFor = gov.lowFor + input.dt;
  if (lowFor >= GOV_SECONDS) return { gov: { lowFor: 0 }, down: tierDown(input.tier) };
  return { gov: { lowFor }, down: null };
}

/** Mobile drops to 30 fps after 60 s with no input and no cast in progress. */
export function shouldSkipFrame(tier: Gfx, idleMs: number, phase: string, frameNo: number): boolean {
  return tier === "mobile" && phase === "idle" && idleMs >= 60_000 && frameNo % 2 === 1;
}

/* ── Catch celebration (03 §4) ───────────────────────────────────────────── */

export type CelebrationInput = { rarity: number; discovered: boolean; record: boolean; boss: boolean; perfect: boolean };

export function confettiFor(tier: Gfx, rarity: number): number {
  return rarity >= 2 ? TIERS[tier].confetti : 0;
}

/** Epic and up, or any new species, gets the brass fanfare. */
export function wantsFanfare(c: CelebrationInput): boolean {
  return c.rarity >= 3 || c.discovered || c.boss;
}

export const RARITY_COLORS = ["#9bb0b8", "#3dbe86", "#4aa3e8", "#e07a9a", "#e2a23a"] as const;
