/* The start-up speed test (docs/architecture/09 §1.4). The measured frame rate is the main signal for Auto graphics;
   the graphics card's name is only a hint that can hold the level back. The test draws a small, busy picture for a
   second or so on a throwaway canvas, so it costs nothing to look at and nothing to keep. */

import type { Level } from "./device.ts";
import { levelFromProbe } from "./graphics.ts";

export type ProbeResult = { fps: number; renderer: string | null; level: Level };

let result: ProbeResult | null = null;
let running: Promise<ProbeResult | null> | null = null;

/** The result of this session's speed test, or null until it has finished (or if it could not run). */
export const probedLevel = (): Level | null => result?.level ?? null;
export const probeResult = (): ProbeResult | null => result;

/** The middle frame time of a list, in seconds: one hiccup does not move it. */
export function medianFrame(times: number[]): number {
  if (!times.length) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** The graphics card's name as the browser reports it, or null. Only ever used as a hint. */
export function readRenderer(): string | null {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return name || null;
  } catch {
    return null;
  }
}

/** One busy frame: gradient fills, many soft circles and a blurred copy, roughly what the water costs. */
function drawLoad(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0c3a4a");
  g.addColorStop(1, "#2fbfa8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    const x = (Math.sin(t + i * 1.7) * 0.5 + 0.5) * w;
    const y = (Math.cos(t * 0.7 + i * 2.3) * 0.5 + 0.5) * h;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = i % 3 ? "#e7f3f1" : "#e2a23a";
    ctx.beginPath();
    ctx.arc(x, y, 6 + (i % 9), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.5;
  for (let y = 0; y < h; y += 6) ctx.drawImage(ctx.canvas, 0, y, w, 6, Math.sin(y * 0.1 + t) * 3, y, w, 6);
  ctx.globalAlpha = 1;
}

/** Measure for about `frames` frames (after a short warm-up). Resolves to null if the tab is hidden or there is no canvas. */
export function runSpeedTest(frames = 50): Promise<ProbeResult | null> {
  if (result) return Promise.resolve(result);
  if (running) return running;
  running = new Promise<ProbeResult | null>((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext("2d");
      if (!ctx || document.hidden) return resolve(null);
      const times: number[] = [];
      let last = 0;
      let count = 0;
      const step = (now: number) => {
        if (document.hidden) return resolve(null);
        if (last) {
          count++;
          if (count > 8) times.push((now - last) / 1000);
        }
        last = now;
        drawLoad(ctx, canvas.width, canvas.height, now / 1000);
        if (times.length >= frames) {
          const frame = medianFrame(times);
          const fps = frame > 0 ? 1 / frame : 60;
          const renderer = readRenderer();
          result = { fps, renderer, level: levelFromProbe(fps, renderer) };
          return resolve(result);
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } catch {
      resolve(null);
    }
  }).finally(() => {
    running = null;
  });
  return running;
}
