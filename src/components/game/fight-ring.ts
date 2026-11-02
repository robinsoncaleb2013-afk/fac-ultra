/* The reel fight, drawn on the water around the bobber (docs/architecture/03 §2, 04 §5.5).
   This file only draws `sim.fight`; the rules live in game/fight.ts.

   Outer ring (86 % arc, open at the bottom so the fish stays visible): the needle is the
   line's tension, the teal band is the green zone to keep it in, and the red end is where
   the line strains. Inner ring: the fish coming in. A little fish rides its head toward
   the bobber. A brass arrow outside the ring warns of a run or a leap before it comes. */

import { sim } from "@/game/engine";
import { FIGHT, progressOf } from "@/game/fight";
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
  const F = sim.fight;
  if (!F) {
    ctx.restore();
    return;
  }
  const strainFrac = Math.min(1, Math.max(0, F.strain / Math.max(0.01, F.hold)));
  const thrum = motion && F.tension > 0.85 ? Math.sin(sim.t * 47) * 2 : 0;
  const r = R + thrum;
  const spin = sim.spinT > 0 && motion ? Math.PI * (1 - (1 - (1 - sim.spinT / 0.22) ** 3)) : 0;
  const still = F.still > 0 || F.jump > 0;
  const phase3 = boss && F.style === "bulldog";

  ctx.save();
  ctx.rotate(spin);
  ctx.globalAlpha = still ? 0.6 : 1;
  /* track */
  ctx.strokeStyle = "rgba(231,243,241,0.22)";
  ctx.lineWidth = thick;
  ctx.beginPath();
  ctx.arc(0, 0, r, START, START + SWEEP);
  ctx.stroke();
  /* the red end of the track, brighter as the line strains */
  ctx.strokeStyle = `rgba(228,87,46,${0.3 + 0.6 * strainFrac})`;
  ctx.beginPath();
  ctx.arc(0, 0, r, ringAngle(FIGHT.red * 100), ringAngle(100));
  ctx.stroke();
  /* the green zone */
  const a0 = ringAngle(F.lo * 100);
  const a1 = ringAngle(F.hi * 100);
  if (sim.helpGlow) {
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
  /* the needle: frozen it shows the stale value with an icy edge */
  const frozen = F.freeze > 0;
  const ca = ringAngle(F.shown * 100);
  const nr = (big ? 10 : 8) * (F.reeling ? 1.2 : 1);
  ctx.fillStyle = tensionColor(F.shown);
  ctx.strokeStyle = frozen ? "#bfe9ff" : "#2a1c08";
  ctx.lineWidth = frozen ? 3 : 2;
  ctx.beginPath();
  ctx.arc(Math.cos(ca) * r, Math.sin(ca) * r, nr, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  /* the warning arrow: a run comes out and away, a leap goes up */
  const warning = F.telegraph > 0 || F.run > 0;
  if (warning) {
    const up = F.warn === "jump";
    const a = up ? -Math.PI / 2 : -Math.PI / 4;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const pulse = motion ? 0.6 + 0.4 * Math.sin(sim.t * TAU * 4) : 1;
    const from = r + thick / 2 + 6;
    const len = (big ? 30 : 22) * (F.run > 0 ? 1.25 : 1);
    ctx.save();
    ctx.globalAlpha = F.run > 0 ? 1 : pulse;
    ctx.strokeStyle = BRASS;
    ctx.fillStyle = BRASS;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(c * from, sn * from);
    ctx.lineTo(c * (from + len), sn * (from + len));
    ctx.stroke();
    const tx = c * (from + len + 8);
    const ty = sn * (from + len + 8);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - c * 14 - sn * 8, ty - sn * 14 + c * 8);
    ctx.lineTo(tx - c * 14 + sn * 8, ty - sn * 14 - c * 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* inner ring: the fish coming in, with a little fish riding the head of the fill */
  const tw = phase3 ? 6 : 4;
  const ti = r - thick / 2 - tw - 3;
  const prog = progressOf(F);
  ctx.lineWidth = tw;
  ctx.strokeStyle = "rgba(231,243,241,0.16)";
  ctx.beginPath();
  ctx.arc(0, 0, ti, 0, TAU);
  ctx.stroke();
  if (prog > 0.005) {
    ctx.strokeStyle = BRASS;
    ctx.beginPath();
    ctx.arc(0, 0, ti, -Math.PI / 2, -Math.PI / 2 + TAU * prog);
    ctx.stroke();
  }
  const ha = -Math.PI / 2 + TAU * prog;
  ctx.save();
  ctx.translate(Math.cos(ha) * ti, Math.sin(ha) * ti);
  ctx.rotate(ha + Math.PI / 2);
  const fs = big ? 9 : 7;
  ctx.fillStyle = "#f4f7f6";
  ctx.strokeStyle = "#2a1c08";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, fs, fs * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-fs, 0);
  ctx.lineTo(-fs * 1.6, -fs * 0.5);
  ctx.lineTo(-fs * 1.6, fs * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  countDraw(20);
}
