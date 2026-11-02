/* The pet, drawn from simple shapes in three frames (05 §6.2): rest, and two cheer frames that
   alternate for about a second after a catch. otter claps, heron tilts, dog wags. Cosmetic only. */

import type { PetKind } from "@/game/pet";

export function drawPet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: PetKind,
  cheer: number,
  t: number,
  motion: boolean,
  gift: boolean,
) {
  const u = Math.max(30, Math.min(64, Math.min(w, h) * 0.12));
  const x = Math.max(u * 1.1, w * 0.13);
  const y = h * 0.88;
  /* frame 0 = rest, 1 and 2 = cheer; with motion off the cheer holds on frame 1. */
  const frame = cheer > 0 ? (motion ? 1 + (Math.floor(t * 6) % 2) : 1) : 0;
  const bob = motion ? Math.sin(t * 2.2) * u * 0.02 : 0;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = "rgba(10,20,26,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, u * 0.02, u * 0.62, u * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === "otter") otter(ctx, u, frame);
  else if (kind === "heron") heron(ctx, u, frame);
  else dog(ctx, u, frame);
  if (gift) {
    const pop = motion ? Math.sin(t * 5) * u * 0.04 : 0;
    ctx.fillStyle = "#e2a23a";
    ctx.beginPath();
    ctx.arc(u * 0.45, -u * 1.05 + pop, u * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1c08";
    ctx.font = `700 ${Math.round(u * 0.28)}px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", u * 0.45, -u * 1.05 + pop + 1);
  }
  ctx.restore();
}

function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function otter(ctx: CanvasRenderingContext2D, u: number, frame: number) {
  const fur = "#7a5233";
  ell(ctx, -u * 0.5, -u * 0.12, u * 0.42, u * 0.1, fur, -0.15); // tail
  ell(ctx, 0, -u * 0.35, u * 0.36, u * 0.4, fur); // body
  ell(ctx, 0, -u * 0.3, u * 0.22, u * 0.3, "#c9a37a"); // belly
  ell(ctx, 0, -u * 0.8, u * 0.26, u * 0.23, fur); // head
  ell(ctx, -u * 0.2, -u * 1.0, u * 0.07, u * 0.07, fur);
  ell(ctx, u * 0.2, -u * 1.0, u * 0.07, u * 0.07, fur);
  ell(ctx, 0, -u * 0.72, u * 0.13, u * 0.09, "#d9bd96"); // muzzle
  ell(ctx, 0, -u * 0.75, u * 0.04, u * 0.03, "#1b1410");
  ell(ctx, -u * 0.1, -u * 0.86, u * 0.03, u * 0.035, "#1b1410");
  ell(ctx, u * 0.1, -u * 0.86, u * 0.03, u * 0.035, "#1b1410");
  /* paws: down at rest, up and clapping when cheering */
  const apart = frame === 2 ? u * 0.16 : u * 0.05;
  const py = frame ? -u * 0.55 : -u * 0.22;
  ell(ctx, -apart - u * 0.06, py, u * 0.08, u * 0.09, fur);
  ell(ctx, apart + u * 0.06, py, u * 0.08, u * 0.09, fur);
}

function heron(ctx: CanvasRenderingContext2D, u: number, frame: number) {
  const grey = "#8fa3b3";
  ctx.strokeStyle = "#b8a35a";
  ctx.lineWidth = Math.max(1.5, u * 0.045);
  ctx.beginPath();
  ctx.moveTo(-u * 0.08, -u * 0.5);
  ctx.lineTo(-u * 0.1, 0);
  ctx.moveTo(u * 0.08, -u * 0.5);
  ctx.lineTo(u * 0.1, 0);
  ctx.stroke();
  ell(ctx, 0, -u * 0.68, u * 0.3, u * 0.2, grey, -0.2); // body
  ell(ctx, -u * 0.25, -u * 0.6, u * 0.18, u * 0.08, "#6e8294", -0.3); // wing/tail
  /* neck and head: tilted to one side on the cheer frames */
  const tilt = frame === 0 ? 0 : frame === 1 ? 0.35 : -0.35;
  ctx.save();
  ctx.translate(u * 0.12, -u * 0.8);
  ctx.rotate(tilt);
  ctx.strokeStyle = grey;
  ctx.lineWidth = u * 0.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(u * 0.1, -u * 0.25, u * 0.04, -u * 0.5);
  ctx.stroke();
  ell(ctx, u * 0.04, -u * 0.54, u * 0.11, u * 0.08, "#dfe8ee");
  ctx.fillStyle = "#e2b23a";
  ctx.beginPath();
  ctx.moveTo(u * 0.13, -u * 0.56);
  ctx.lineTo(u * 0.4, -u * 0.52);
  ctx.lineTo(u * 0.13, -u * 0.5);
  ctx.fill();
  ell(ctx, u * 0.08, -u * 0.56, u * 0.02, u * 0.02, "#10161a");
  ctx.restore();
}

function dog(ctx: CanvasRenderingContext2D, u: number, frame: number) {
  const fur = "#c4894f";
  /* tail wags harder on the cheer frames */
  const wag = frame === 0 ? 0.1 : frame === 1 ? 0.7 : -0.5;
  ctx.save();
  ctx.translate(-u * 0.4, -u * 0.42);
  ctx.rotate(-0.9 + wag);
  ell(ctx, 0, -u * 0.18, u * 0.08, u * 0.22, fur);
  ctx.restore();
  ell(ctx, 0, -u * 0.36, u * 0.4, u * 0.26, fur); // body
  ell(ctx, -u * 0.22, -u * 0.08, u * 0.08, u * 0.1, "#a8703c");
  ell(ctx, u * 0.2, -u * 0.08, u * 0.08, u * 0.1, "#a8703c");
  ell(ctx, u * 0.28, -u * 0.7, u * 0.22, u * 0.2, fur); // head
  ell(ctx, u * 0.12, -u * 0.72, u * 0.08, u * 0.17, "#8a5a2c", 0.2); // floppy ear
  ell(ctx, u * 0.44, -u * 0.64, u * 0.1, u * 0.08, "#e9cfa8"); // muzzle
  ell(ctx, u * 0.52, -u * 0.66, u * 0.03, u * 0.025, "#1b1410");
  ell(ctx, u * 0.34, -u * 0.76, u * 0.03, u * 0.035, "#1b1410");
  if (frame) ell(ctx, u * 0.45, -u * 0.55, u * 0.05, u * 0.08, "#e0707a"); // tongue
}
