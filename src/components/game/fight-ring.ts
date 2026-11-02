/* The reel fight, drawn on the water around the bobber (docs/architecture/03 §2).
   Rules are unchanged: sim.cp / zc / zone / hits / tz / hold keep their meaning;
   this file only draws them. The ring is an 86 % arc that opens at the bottom so
   the hooked fish stays visible under the bobber. */

import { sim } from "@/game/engine";
import { countDraw } from "@/components/game/water-fx";

const TAU = Math.PI * 2;
const SWEEP = TAU * 0.86;
const START = Math.PI / 2 + (TAU - SWEEP) / 2;
const LAGOON = "#2fbfa8";
const BRASS = "#e2a23a";

/** Angle on the ring for a 0–100 cursor position. */
export function ringAngle(p: number) {
  return START + (Math.min(100, Math.max(0, p)) / 100) * SWEEP;
}

/** Ring radius in px: clamp(0.09 · min(w, h), 44, 96); bigger for a thumb. */
export function ringRadius(w: number, h: number, big: boolean) {
  const m = Math.min(w, h);
  return big ? Math.min(120, Math.max(56, 0.14 * m)) : Math.min(96, Math.max(44, 0.09 * m));
}

/** lagoon → brass → red at 0 → 0.5 → 0.85 */
export function tensionColor(f: number) {
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const A = [47, 191, 168];
  const B = [226, 162, 58];
  const C = [228, 87, 46];
  const c = f < 0.5 ? mix(A, B, f / 0.5) : mix(B, C, Math.min(1, (f - 0.5) / 0.35));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function drawFightRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  big: boolean,
  motion: boolean,
  boss: boolean,
) {
  const phase = sim.phase;
  if (phase !== "bite" && phase !== "reel") return;
  const thick = big ? 14 : 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";

  if (phase === "bite") {
    const left = Math.max(0, Math.min(1, sim.biteLeft / Math.max(0.01, sim.biteMax)));
    const pulse = motion ? 1 + 0.12 * (0.5 + 0.5 * Math.sin(sim.t * TAU * 3)) : 1;
    ctx.scale(pulse, pulse);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = "rgba(231,243,241,0.25)";
    ctx.lineWidth = thick;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = LAGOON;
    ctx.beginPath();
    ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + TAU * left);
    ctx.stroke();
    ctx.restore();
    countDraw(4);
    return;
  }

  /* reel */
  const frac = Math.min(1, Math.max(0, sim.tz / Math.max(0.01, sim.hold)));
  const thrum = motion && frac >= 0.85 ? Math.sin(sim.t * 47) * 2 : 0;
  const r = R + thrum;
  const spin = sim.spinT > 0 && motion ? Math.PI * (1 - (1 - (1 - sim.spinT / 0.22) ** 3)) : 0;

  ctx.save();
  ctx.rotate(spin);
  /* track */
  ctx.strokeStyle = "rgba(231,243,241,0.22)";
  ctx.lineWidth = thick;
  ctx.beginPath();
  ctx.arc(0, 0, r, START, START + SWEEP);
  ctx.stroke();
  /* band */
  const half = sim.zone / 2;
  const a0 = ringAngle(sim.zc - half);
  const a1 = ringAngle(sim.zc + half);
  if (sim.zoneBonus > 0) {
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = thick + 6;
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a1);
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = sim.bandFlash > 0 ? "#ffffff" : LAGOON;
  ctx.lineWidth = thick;
  ctx.beginPath();
  ctx.arc(0, 0, r, a0, a1);
  ctx.stroke();
  /* hit ticks */
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 3;
  for (let i = 0; i < sim.hitAngles.length; i++) {
    const a = ringAngle(sim.hitAngles[i]);
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(c * (r + thick / 2), s * (r + thick / 2));
    ctx.lineTo(c * (r + thick / 2 + 9), s * (r + thick / 2 + 9));
    ctx.stroke();
  }
  /* cursor trail + dot */
  for (let k = 5; k >= 1; k--) {
    const p = sim.trail[(sim.trailI + 6 - k) % 6];
    const a = ringAngle(p);
    ctx.fillStyle = `rgba(226,162,58,${0.1 + (6 - k) * 0.05})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, (big ? 7 : 5) * (1 - k * 0.1), 0, TAU);
    ctx.fill();
  }
  const ca = ringAngle(sim.cp);
  ctx.fillStyle = BRASS;
  ctx.strokeStyle = "#2a1c08";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(Math.cos(ca) * r, Math.sin(ca) * r, big ? 10 : 8, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  /* tension ring (inside, does not spin) */
  const ti = r - thick / 2 - (boss && sim.hits >= Math.ceil(sim.need * (2 / 3)) ? 6 : 4) - 3;
  const tw = boss && sim.hits >= Math.ceil(sim.need * (2 / 3)) ? 6 : 4;
  ctx.strokeStyle = "rgba(231,243,241,0.16)";
  ctx.lineWidth = tw;
  ctx.beginPath();
  ctx.arc(0, 0, ti, 0, TAU);
  ctx.stroke();
  if (frac > 0.005) {
    ctx.strokeStyle = tensionColor(frac);
    ctx.beginPath();
    ctx.arc(0, 0, ti, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.stroke();
    if (big) {
      const na = -Math.PI / 2 + TAU * frac;
      ctx.fillStyle = tensionColor(frac);
      ctx.beginPath();
      ctx.arc(Math.cos(na) * ti, Math.sin(na) * ti, 9, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  countDraw(14 + sim.hitAngles.length);
}
