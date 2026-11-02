/* Survival's one extra picture: the campfire glow (05 §5.3). An additive warm radial gradient
   in the bottom-left corner, flickering a little, drawn only while the fire is lit. */

import { sim } from "@/game/engine";

/** `fire` is the minutes of wood left; a low fire is dimmer. `motion` off keeps it steady. */
export function drawCampfire(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fire: number,
  night: boolean,
  motion: boolean,
) {
  if (fire <= 0) return;
  const flicker = motion ? 0.88 + 0.12 * Math.sin(sim.t * 9.3) * Math.sin(sim.t * 5.1 + 1) : 1;
  const strength = Math.min(1, 0.45 + fire / 180) * (night ? 1 : 0.55) * flicker;
  const cx = w * 0.09;
  const cy = h * 0.9;
  const r = Math.max(w, h) * 0.42;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(255,170,70,${0.55 * strength})`);
  g.addColorStop(0.35, `rgba(255,110,40,${0.22 * strength})`);
  g.addColorStop(1, "rgba(255,90,30,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  /* The flame itself: a small bright teardrop. */
  const fh = Math.min(w, h) * 0.05 * (0.9 + 0.2 * flicker);
  ctx.fillStyle = `rgba(255,214,120,${0.9 * Math.min(1, strength + 0.2)})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy - fh * 0.2, fh * 0.42, fh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
