/* The living-water effects stack (docs/architecture/03 §3, 09 §1.2).
   Canvas 2D only. The painting (plus tint and swimmers) is drawn once per
   frame into an offscreen buffer, then blitted to the stage in thin strips
   with a sine push — that is the ripple. Nothing here allocates per frame
   except the occasional gradient when the stage is resized. */

import { rainRingRate, rippleAmp, rippleDx, TIERS, timeTint } from "@/game/graphics";
import type { Gfx } from "@/game/device";
import { waterLineOf, sunXOf } from "@/game/water";

declare global {
  interface Window {
    __facDraw?: number;
  }
}

/** Dev-only draw-call counter (window.__facDraw), reset each frame by paint(). */
export function countDraw(n = 1) {
  if (import.meta.env.DEV) window.__facDraw = (window.__facDraw ?? 0) + n;
}

type Layer = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

function makeLayer(): Layer | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  return ctx ? { canvas, ctx } : null;
}

/* Module state: one stage at a time. */
let buf: Layer | null = null;
let cache: Layer | null = null;
let cacheKey = "";
let frameNo = 0;
let rayGrad: CanvasGradient | null = null;
let rayKey = "";

const SPARK = 40;
const sparkX = new Float32Array(SPARK);
const sparkY = new Float32Array(SPARK);
const sparkSeed = new Float32Array(SPARK);
const STARS = 18;
const starX = new Float32Array(STARS);
const starY = new Float32Array(STARS);
const starSeed = new Float32Array(STARS);
for (let i = 0; i < SPARK; i++) {
  sparkX[i] = (i * 0.6180339 + 0.13) % 1;
  sparkY[i] = (i * 0.7548776 + 0.31) % 1;
  sparkSeed[i] = i * 1.7;
}
for (let i = 0; i < STARS; i++) {
  starX[i] = (i * 0.5698403 + 0.07) % 1;
  starY[i] = (i * 0.3247179 + 0.11) % 1;
  starSeed[i] = i * 2.3;
}

const RINGS = 24;
const ringX = new Float32Array(RINGS);
const ringY = new Float32Array(RINGS);
const ringAge = new Float32Array(RINGS).fill(-1);
let ringAcc = 0;

export function sizeBuffers(wPx: number, hPx: number): boolean {
  if (!buf) buf = makeLayer();
  if (!buf) return false;
  if (buf.canvas.width !== wPx || buf.canvas.height !== hPx) {
    buf.canvas.width = wPx;
    buf.canvas.height = hPx;
  }
  return true;
}

export function bufferCtx(): CanvasRenderingContext2D | null {
  return buf?.ctx ?? null;
}

/** Hand back a context scaled so callers can draw in CSS px. */
export function beginBuffer(dpr: number): CanvasRenderingContext2D | null {
  const c = buf?.ctx;
  if (!c) return null;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}

/**
 * Should this frame rebuild the background? Mobile reuses the cached frame on
 * every other frame; everything else rebuilds every frame. Returns false when
 * a cached frame was drawn instead.
 */
export function reuseBackground(
  ctx: CanvasRenderingContext2D,
  tier: Gfx,
  key: string,
  w: number,
  h: number,
): boolean {
  frameNo++;
  const every = TIERS[tier].rippleEvery;
  if (every === 1) return false;
  if (!cache) cache = makeLayer();
  if (!cache) return false;
  const stale = cacheKey !== key || cache.canvas.width !== buf?.canvas.width || cache.canvas.height !== buf?.canvas.height;
  if (stale || frameNo % every === 0) return false;
  ctx.drawImage(cache.canvas, 0, 0, cache.canvas.width, cache.canvas.height, 0, 0, w, h);
  countDraw();
  return true;
}

export function cacheTarget(tier: Gfx, dpr: number): CanvasRenderingContext2D | null {
  if (TIERS[tier].rippleEvery === 1 || !cache || !buf) return null;
  if (cache.canvas.width !== buf.canvas.width || cache.canvas.height !== buf.canvas.height) {
    cache.canvas.width = buf.canvas.width;
    cache.canvas.height = buf.canvas.height;
  }
  cache.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return cache.ctx;
}

export function markCache(key: string) {
  cacheKey = key;
}

export function cacheCanvas(): HTMLCanvasElement | null {
  return cache?.canvas ?? null;
}

/**
 * The ripple pass: copy the buffer to `dst` in horizontal strips below the
 * waterline, each pushed sideways by a sine. Above the line it is a straight copy.
 */
export function rippleBlit(
  dst: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  biome: number,
  weather: number,
  tier: Gfx,
  t: number,
) {
  if (!buf) return;
  const src = buf.canvas;
  const waterTop = Math.round(waterLineOf(biome) * h);
  const strip = TIERS[tier].strip;
  if (waterTop > 0) {
    dst.drawImage(src, 0, 0, src.width, waterTop * dpr, 0, 0, w, waterTop);
    countDraw();
  }
  const pad = 20;
  for (let y = waterTop; y < h; y += strip) {
    const sh = Math.min(strip, h - y);
    const depth = (y - waterTop) / Math.max(1, h - waterTop);
    const dx = rippleDx(y, t, rippleAmp(depth, weather));
    dst.drawImage(src, 0, y * dpr, src.width, sh * dpr, dx - pad, y, w + pad * 2, sh);
  }
  countDraw(Math.ceil((h - waterTop) / strip));
}

/** Plain copy (no ripples) — motion off. */
export function plainBlit(dst: CanvasRenderingContext2D, w: number, h: number) {
  if (!buf) return;
  dst.drawImage(buf.canvas, 0, 0, buf.canvas.width, buf.canvas.height, 0, 0, w, h);
}

export function drawTimeTint(ctx: CanvasRenderingContext2D, w: number, h: number, weather: number, follow: boolean) {
  const d = new Date();
  const tint = timeTint(d.getHours() + d.getMinutes() / 60, weather, follow);
  if (tint.color) {
    ctx.globalAlpha = tint.alpha;
    ctx.fillStyle = tint.color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    countDraw();
  }
  return tint.night;
}

/** Cool blue over the water region so swimmers drawn under it look submerged. */
export function drawWaterCast(ctx: CanvasRenderingContext2D, w: number, h: number, biome: number) {
  const top = waterLineOf(biome) * h;
  ctx.fillStyle = "rgba(24,92,128,0.10)";
  ctx.fillRect(0, top, w, h - top);
  countDraw();
}

export function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, biome: number, t: number) {
  const top = waterLineOf(biome) * h;
  ctx.fillStyle = "#f4f7ff";
  for (let i = 0; i < STARS; i++) {
    ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.6 + starSeed[i]));
    ctx.fillRect(starX[i] * w, starY[i] * top * 0.9, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  countDraw(STARS);
}

/** Additive sparkles on the water just under the line (sun, or moon at night). */
export function drawGlints(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  biome: number,
  t: number,
  tier: Gfx,
  moon: boolean,
  boost: number,
) {
  const n = TIERS[tier].glints;
  const top = waterLineOf(biome) * h;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = moon ? "#dfe9ff" : "#ffffff";
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, Math.sin(t * 3 + sparkSeed[i])) ** 8 * (1 + boost);
    if (a < 0.02) continue;
    ctx.globalAlpha = Math.min(1, a);
    const size = 2 + (i % 3);
    ctx.fillRect(sparkX[i] * w, top + sparkY[i] * 0.12 * h, size, size);
  }
  ctx.restore();
  countDraw(n);
}

/** Five slow light shafts from the sun side to the waterline. Full tier only. */
export function drawRays(ctx: CanvasRenderingContext2D, w: number, h: number, biome: number, t: number) {
  const wl = waterLineOf(biome) * h;
  const key = `${Math.round(h)}:${Math.round(wl)}`;
  if (!rayGrad || rayKey !== key) {
    rayGrad = ctx.createLinearGradient(0, 0, 0, wl);
    rayGrad.addColorStop(0, "rgba(255,244,214,1)");
    rayGrad.addColorStop(1, "rgba(255,244,214,0)");
    rayKey = key;
  }
  const sun = sunXOf(biome) * w;
  const sway = Math.sin(t * Math.PI * 2 * 0.1) * 0.02 * w;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = rayGrad;
  for (let i = 0; i < 5; i++) {
    const topW = 60 + (i % 3) * 30;
    const x0 = sun + (i - 2) * w * 0.07 + sway;
    const lean = (i - 2) * w * 0.05;
    ctx.globalAlpha = 0.06 + (i % 3) * 0.02;
    ctx.beginPath();
    ctx.moveTo(x0 - topW / 2, 0);
    ctx.lineTo(x0 + topW / 2, 0);
    ctx.lineTo(x0 + lean + topW * 1.4, wl);
    ctx.lineTo(x0 + lean - topW * 0.4, wl);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  countDraw(5);
}

/** Rain ring pool: spawn where drops land on the water, grow, fade. */
export function tickRings(dt: number, w: number, h: number, biome: number, weather: number, tier: Gfx) {
  const rate = rainRingRate(weather, tier);
  for (let i = 0; i < RINGS; i++) if (ringAge[i] >= 0) ringAge[i] += dt;
  for (let i = 0; i < RINGS; i++) if (ringAge[i] > 0.6) ringAge[i] = -1;
  if (rate <= 0) return;
  ringAcc += rate * dt;
  while (ringAcc >= 1) {
    ringAcc -= 1;
    for (let i = 0; i < RINGS; i++) {
      if (ringAge[i] < 0) {
        const top = waterLineOf(biome) * h;
        ringX[i] = Math.random() * w;
        ringY[i] = top + 8 + Math.random() * (h - top - 8);
        ringAge[i] = 0;
        break;
      }
    }
  }
}

export function drawRings(ctx: CanvasRenderingContext2D) {
  ctx.lineWidth = 1;
  let n = 0;
  for (let i = 0; i < RINGS; i++) {
    const age = ringAge[i];
    if (age < 0) continue;
    const p = age / 0.6;
    ctx.strokeStyle = `rgba(231,243,241,${0.5 * (1 - p)})`;
    ctx.beginPath();
    ctx.ellipse(ringX[i], ringY[i], p * 14, p * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    n++;
  }
  countDraw(n);
}
