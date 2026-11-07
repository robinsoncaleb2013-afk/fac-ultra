/* One frame of the stage. Order (docs/architecture/02 §Rendering, 03 §3):
   painting → weather + time-of-day tint → swimmers through the water → ripple
   pass → glints / rays / stars → plankton → guests → boss shadow → hooked fish →
   leap → rod and line → bobber → fight ring → particles → flashes. */

import { biomeArt, fitCanvas } from "@/game/art";
import { BIOMES, BOSS_INDEX, SPECIES_PER_BIOME } from "@/game/content";
import type { Gfx } from "@/game/device";
import { drawFish } from "@/game/fish-draw";
import { pickedHour, sim, useGame } from "@/game/engine";
import { tierSpec } from "@/game/graphics";
import { spotResidents } from "@/game/match";
import { peerBoats } from "@/game/multiplayer";
import { eventBoats, myBubble } from "@/game/eventroom";
import { skinOf, type Emote } from "@/game/social";
import { nearestSpot, resolveSpot, spotRingPx, spotsOf, type Spot } from "@/game/spots";
import { waterLineOf } from "@/game/water";
import { drawFightRing, ringRadius } from "@/components/game/fight-ring";
import { drawCampfire } from "@/components/game/survival-fx";
import { drawPet } from "@/components/game/pet-fx";
import { funModeOn } from "@/game/fun";
import { giftReady } from "@/game/pet";
import { MODES } from "@/game/modes";
import {
  beginBuffer,
  cacheCanvas,
  cacheTarget,
  countDraw,
  drawGlints,
  drawRays,
  drawRings,
  drawStars,
  drawTimeTint,
  drawWaterCast,
  markCache,
  rippleBlit,
  sizeBuffers,
  tickRings,
  reuseBackground,
} from "@/components/game/water-fx";

export type View = { tier: Gfx; big: boolean; menu: boolean; dt: number; biome?: number };

const FALLBACK: [string, string][] = [
  ["#d7b56a", "#1d6a62"], ["#9eb8c4", "#1a6e78"], ["#c9d4c4", "#1c4a55"], ["#6e8a62", "#163e36"],
  ["#7a9a4e", "#14403a"], ["#e2c48a", "#1a6f88"], ["#d9905f", "#7a3b2e"], ["#7ed0c8", "#0e6a78"],
  ["#4e9a6a", "#0d4a34"], ["#d5e4ee", "#2a5a68"], ["#1a2740", "#071018"], ["#cbb98a", "#3a4a55"],
  ["#c45a32", "#1a1818"], ["#f0c9a0", "#6a88a8"], ["#8a7ed0", "#141033"],
  ["#cfd2e8", "#2a2a5e"], ["#b8a8d8", "#2e2050"], ["#e6ddc4", "#3d4a4a"], ["#d88a4a", "#26303a"],
  ["#f2c98a", "#1d6a5e"],
];

let lastNight = false;

/* 0 while the line load sits in the green, growing 0 → 1.5 as it climbs past the top of it. */
function reelStrain() {
  const F = sim.fight;
  if (!F) return 0;
  return Math.min(1.5, Math.max(0, (F.tension - F.hi) / Math.max(0.05, 1 - F.hi)));
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, t: number) {
  const breathe = t ? 1 + Math.sin(t * 0.18) * 0.012 : 1;
  const ir = img.width / img.height;
  const cr = w / h;
  let dw: number;
  let dh: number;
  if (ir > cr) {
    dh = h * breathe;
    dw = dh * ir;
  } else {
    dw = w * breathe;
    dh = dw / ir;
  }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) * 0.42, dw, dh);
  countDraw();
}

function drawSwimmers(c: CanvasRenderingContext2D, w: number, h: number, biome: number, count: number, alpha: number) {
  for (let i = 0; i < count && i < sim.swimmers.length; i++) {
    const fish = sim.swimmers[i];
    drawFish(c, fish.x * w, fish.y * h, 28 * fish.sc, fish.dir, {
      biome,
      species: (biome * 2 + fish.species) % SPECIES_PER_BIOME,
      rarity: fish.species % 5 === 0 ? 1 : 0,
      mutation: 0,
      wag: Math.sin(sim.t * 7 + fish.phase) * 0.4,
      alpha,
    });
  }
  countDraw(count * 8);
}

function paintPicture(c: CanvasRenderingContext2D, w: number, h: number, biome: number, weather: number, motion: boolean) {
  c.fillStyle = "#0c1a22";
  c.fillRect(0, 0, w, h);
  const img = biomeArt(biome);
  if (img && img.complete && img.naturalWidth) drawCover(c, img, w, h, motion ? sim.t : 0);
  else {
    const [sky, water] = FALLBACK[biome] ?? FALLBACK[0];
    const wl = waterLineOf(biome);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky);
    g.addColorStop(wl, sky);
    g.addColorStop(wl, water);
    g.addColorStop(1, "#07141c");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  if (weather === 4) {
    c.fillStyle = "rgba(4, 10, 18, 0.38)";
    c.fillRect(0, 0, w, h);
  } else if (weather === 2) {
    c.fillStyle = "rgba(8, 16, 28, 0.22)";
    c.fillRect(0, 0, w, h);
  } else if (weather === 3) {
    c.fillStyle = "rgba(210, 220, 224, 0.2)";
    c.fillRect(0, 0, w, h);
  }
}

/* ── Spots ──────────────────────────────────────────────────────────────── */

const silhouettes = new Map<string, HTMLCanvasElement | null>();

/** A fish drawn once, then filled flat dark: the "something lives here" shape. */
function silhouette(biome: number, species: number): HTMLCanvasElement | null {
  const key = `${biome}-${species}`;
  if (silhouettes.has(key)) return silhouettes.get(key) ?? null;
  let out: HTMLCanvasElement | null = null;
  try {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 36;
    const g = c.getContext("2d");
    if (g) {
      drawFish(g, 32, 18, 50, 1, { biome, species, rarity: 0, mutation: 0, wag: 0, alpha: 1 });
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(142,172,182,0.7)";
      g.fillRect(0, 0, 64, 36);
      out = c;
    }
  } catch {
    out = null;
  }
  silhouettes.set(key, out);
  return out;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawSpots(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  biome: number,
  touch: boolean,
  lastSpotId: string | undefined,
  dex: Record<string, { c: number }>,
) {
  const current = resolveSpot(biome, lastSpotId);
  const hovered: Spot | null = sim.hover ? nearestSpot(biome, sim.hover.x, sim.hover.y, w, h, touch) : null;
  ctx.save();
  for (const spot of spotsOf(biome)) {
    const x = spot.x * w;
    const y = spot.y * h;
    const r = spotRingPx(spot, w, touch);
    const here = spot.id === current.id;
    const hot = hovered?.id === spot.id;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (hot) {
      ctx.fillStyle = "rgba(231,243,241,0.10)";
      ctx.fill();
    }
    ctx.setLineDash(here || hot ? [] : [4, 5]);
    ctx.lineWidth = here || hot ? 2 : touch ? 1.75 : 1.25;
    ctx.strokeStyle = here ? "rgba(226,162,58,0.95)" : hot ? "rgba(244,247,246,0.9)" : `rgba(231,243,241,${touch ? 0.5 : 0.34})`;
    ctx.stroke();
    if (here) {
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(226,162,58,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.setLineDash([]);
  countDraw(spotsOf(biome).length * 2);

  if (hovered) {
    const x = hovered.x * w;
    const y = hovered.y * h;
    const r = spotRingPx(hovered, w, touch);
    const residents = spotResidents(biome, hovered, 2);
    const known = residents.filter((i) => dex[`${biome}-${i}`]?.c).map((i) => BIOMES[biome].fish[i]);
    const unknown = residents.length - known.length;
    const who = known.length
      ? known.join(", ") + (unknown ? " and something else" : "")
      : "Something lives here.";
    const pad = 10;
    const boxW = 250;
    ctx.font = "12px Outfit, sans-serif";
    const tip = wrap(ctx, hovered.tip, boxW - pad * 2);
    const boxH = pad * 2 + 18 + tip.length * 15 + 40;
    let bx = x + r + 12;
    if (bx + boxW > w - 8) bx = x - r - 12 - boxW;
    const by = Math.min(h - boxH - 8, Math.max(8, y - boxH / 2));
    ctx.fillStyle = "rgba(10,22,30,0.86)";
    ctx.strokeStyle = "rgba(44,81,98,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#e2a23a";
    ctx.font = "600 15px Outfit, sans-serif";
    ctx.fillText(hovered.name, bx + pad, by + pad + 13);
    ctx.fillStyle = "#e7f3f1";
    ctx.font = "12px Outfit, sans-serif";
    tip.forEach((line, n) => ctx.fillText(line, bx + pad, by + pad + 18 + 15 * (n + 1)));
    const ry = by + pad + 18 + tip.length * 15 + 8;
    let sx = bx + pad;
    for (const i of residents) {
      const sil = silhouette(biome, i);
      if (sil) ctx.drawImage(sil, sx, ry, 32, 18);
      sx += 34;
    }
    ctx.fillStyle = "#8eacb6";
    ctx.fillText(who, sx + 4, ry + 13, boxW - (sx - bx) - pad);
    countDraw(6);
  } else if (sim.hover) {
    const hx = sim.hover.x * w;
    const hy = sim.hover.y * h;
    ctx.strokeStyle = "rgba(231,243,241,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx - 10, hy);
    ctx.lineTo(hx + 10, hy);
    ctx.moveTo(hx, hy - 10);
    ctx.lineTo(hx, hy + 10);
    ctx.stroke();
  }
  ctx.restore();
}

export function paint(canvas: HTMLCanvasElement, view: View) {
  const { tier, big, menu } = view;
  const spec = tierSpec(tier);
  const box = fitCanvas(canvas, spec.dprCap);
  if (!box) return;
  const { ctx, w, h, dpr } = box;
  if (import.meta.env.DEV) window.__facDraw = 0;
  const st = useGame.getState();
  /* The menu can preview another water than the player's. */
  const s = view.biome === undefined || view.biome === st.biome ? st : { ...st, biome: view.biome };
  const motion = s.motion;
  const amp = motion ? sim.trauma * sim.trauma : 0;
  ctx.fillStyle = "#0c1a22";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  if (amp) ctx.translate(Math.sin(sim.t * 53) * 7 * amp, Math.cos(sim.t * 41) * 5 * amp);

  /* ── Background: painting + tints (+ ripples when motion is on) ── */
  let night = false;
  if (!motion) {
    paintPicture(ctx, w, h, s.biome, s.weather, false);
    drawSwimmers(ctx, w, h, s.biome, spec.swimmers, 0.9);
  } else {
    const hour = pickedHour(s);
    const key = `${s.biome}:${s.weather}:${tier}:${w}x${h}:${s.followClock}:${hour}`;
    if (reuseBackground(ctx, tier, key, w, h)) {
      night = lastNight;
    } else if (sizeBuffers(Math.round(w * dpr), Math.round(h * dpr))) {
      const b = beginBuffer(dpr);
      if (b) {
        paintPicture(b, w, h, s.biome, s.weather, true);
        night = drawTimeTint(b, w, h, s.weather, s.followClock, hour);
        lastNight = night;
        if (spec.swimmersThroughWater) {
          b.save();
          drawSwimmers(b, w, h, s.biome, spec.swimmers, 0.55);
          b.restore();
        }
        drawWaterCast(b, w, h, s.biome);
        const target = cacheTarget(tier, dpr);
        rippleBlit(target ?? ctx, w, h, dpr, s.biome, s.weather, tier, sim.t);
        if (target) {
          markCache(key);
          const cc = cacheCanvas();
          if (cc) ctx.drawImage(cc, 0, 0, cc.width, cc.height, 0, 0, w, h);
        }
      }
    } else {
      paintPicture(ctx, w, h, s.biome, s.weather, true);
    }
    if (!spec.swimmersThroughWater) drawSwimmers(ctx, w, h, s.biome, spec.swimmers, 0.9);
  }

  /* ── Animated air ── */
  if (motion && s.weather === 3) {
    ctx.fillStyle = "rgba(216,226,228,0.10)";
    for (let i = 0; i < 3; i++) {
      const fx = (((sim.t * (0.008 + i * 0.004) + i * 0.37) % 1.3) - 0.15) * w;
      ctx.beginPath();
      ctx.ellipse(fx, h * (0.3 + i * 0.16), w * 0.34, h * 0.075, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    countDraw(3);
  }
  if (motion && s.weather === 4 && (s.biome === 9 || s.biome === 13 || s.biome === 14)) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = "hsla(" + [152, 190, 268][i] + " 85% 68% / 0.13)";
      ctx.lineWidth = 9 - i * 2.5;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const y = h * (0.1 + i * 0.07) + Math.sin(x * 0.012 + sim.t * (0.5 + i * 0.13) + i * 2.1) * h * 0.035;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    countDraw(3);
  }

  /* ── Sun and moon on the water, rays, stars ── */
  if (motion) {
    const sunny = s.weather === 0 || s.weather === 4 || night;
    const storm = s.weather === 2 && sim.flashA > 0.05;
    if (sunny || storm) drawGlints(ctx, w, h, s.biome, sim.t, tier, night || s.weather === 4, storm ? sim.flashA * 3 : 0);
    if (spec.rays && !night && (s.weather === 0 || s.weather === 3)) drawRays(ctx, w, h, s.biome, sim.t);
    if (night) drawStars(ctx, w, h, s.biome, sim.t);
    tickRings(view.dt, w, h, s.biome, s.weather, tier);
    drawRings(ctx);
  }

  const wl = waterLineOf(s.biome);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#e7f3f1";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = h * (Math.max(wl + 0.16, 0.68) + i * 0.06) + Math.sin(sim.t * 1.4 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y - 4, w * 0.6, y + 4, w, y);
    ctx.stroke();
  }
  ctx.restore();
  const shade = ctx.createLinearGradient(0, h * 0.55, 0, h);
  shade.addColorStop(0, "rgba(12,26,34,0)");
  shade.addColorStop(1, "rgba(12,26,34,0.28)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  /* Survival: the campfire glows in the corner while it burns. */
  if (s.survival && s.survival.camp.fire > 0 && MODES[s.mode].survival) {
    drawCampfire(ctx, w, h, s.survival.camp.fire, night, motion);
  }

  /* The pet sits at the water's edge (05 §6.2). Not in the menu preview, Survival or Tournaments. */
  if (!menu && s.pet.kind && funModeOn(MODES[s.mode])) {
    drawPet(ctx, w, h, s.pet.kind, sim.petT, sim.t, motion, giftReady(s.pet, Date.now()));
  }

  /* Plankton: full tier only. */
  if (motion && spec.plankton) {
    ctx.fillStyle = "rgba(231,243,241,0.35)";
    for (let i = 0; i < 14; i++) {
      const px = ((i * 0.173 + sim.t * 0.008 * (1 + (i % 3) * 0.4)) % 1) * w;
      const py = h * (0.52 + ((i * 37) % 40) / 100) + Math.sin(sim.t * 0.7 + i * 1.9) * 3;
      ctx.beginPath();
      ctx.arc(px, py, 1 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    countDraw(14);
  }

  /* Online co-op and event rooms: guest boats (an event boat may have an emote bubble up). */
  const guests: { x: number; y: number; dir: number; name: string; emote?: Emote }[] = [...peerBoats(s.biome, sim.t), ...eventBoats(s.biome, sim.t)];
  for (const boat of guests) {
    drawFish(ctx, boat.x * w, boat.y * h, 30, boat.dir, {
      biome: s.biome, species: 3, rarity: 1, mutation: 0, wag: Math.sin(sim.t * 6) * 0.35, alpha: 0.95,
    });
    ctx.fillStyle = "rgba(12,26,34,0.65)";
    const label = boat.name.slice(0, 14);
    ctx.font = "11px Outfit, sans-serif";
    const tw = ctx.measureText(label).width + 10;
    ctx.beginPath();
    ctx.roundRect(boat.x * w - tw / 2, boat.y * h - 34, tw, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#e7f3f1";
    ctx.textAlign = "center";
    ctx.fillText(label, boat.x * w, boat.y * h - 22);
    if (boat.emote) drawBubble(ctx, boat.x * w, boat.y * h - 44, boat.emote);
  }

  if (!menu) {
    /* Boss intro shadow. */
    if (sim.introT > 0 && sim.phase === "wait") {
      const p = Math.min(1, Math.max(0, 1 - sim.introT / 2.6));
      ctx.save();
      ctx.globalAlpha = 0.4;
      drawFish(ctx, (0.15 + p * 0.7) * w, h * 0.82, Math.min(w, h) * 0.62, 1, {
        biome: s.biome, species: BOSS_INDEX, rarity: 4, mutation: 5, wag: Math.sin(sim.t * 3) * 0.2, alpha: 0.55,
      });
      ctx.restore();
    }

    const bobx = sim.bnx * w;
    const boby = sim.bny * h;
    if ((sim.phase === "bite" || sim.phase === "reel") && sim.fish) {
      const f = sim.fish;
      /* A tired fish stops darting (04 §5.5); a running one throws itself about. */
      const F = sim.fight;
      const energy = F && sim.phase === "reel" ? 0.15 + 0.85 * F.stamina : 1;
      const surge = F && F.run > 0 ? 1.8 : 1;
      const fight = motion ? (0.4 + f.t * 0.15 + (f.boss ? 0.3 : 0)) * energy * surge : 0;
      const sph = (f.b * 37 + f.i * 13) % 6.28;
      const dart = Math.sin(sim.t * 11 + sph) * fight * w * 0.02;
      const dive = Math.max(0, Math.sin(sim.t * 5.7 + sph * 2)) * fight * h * 0.05;
      /* Far away while there is a lot of line out; right under the bobber when it is nearly in. */
      const away = F && sim.phase === "reel" ? Math.min(1.3, F.dist) : 0.1;
      const reach = Math.min(w, h * 1.6) * 0.16 * away;
      const leaping = !!sim.leap?.small;
      if (!leaping) drawFish(ctx, bobx - 10 - reach * 0.9 + dart, boby + 8 + reach * 0.35 + dive, 48 + f.t * 8, -1, {
        biome: f.b, species: f.i, rarity: f.t, mutation: f.m,
        wag: Math.sin(sim.t * (sim.phase === "bite" ? 20 : 8)) * 0.45, glow: f.boss || f.t >= 3,
      });
    }
    if (sim.leap) {
      const f = sim.leap.look;
      if (sim.leap.small) {
        /* A jumper's leap in the middle of the fight: up out of the water at the end of the line, and back. */
        const p = Math.min(1, sim.leap.t / 0.8);
        const arc = Math.sin(p * Math.PI);
        const reach = Math.min(w, h * 1.6) * 0.16 * Math.min(1.3, sim.fight?.dist ?? 0.5);
        drawFish(ctx, bobx - 10 - reach * 0.9 + p * 24, boby + 8 + reach * 0.35 - arc * h * 0.14, 48 + f.t * 8, -1, {
          biome: f.b, species: f.i, rarity: f.t, mutation: f.m, wag: Math.sin(p * 14) * 0.4, glow: f.t >= 3 || f.boss,
        });
      } else {
        const p = sim.leap.t / 0.95;
        const arc = Math.sin(Math.min(1, p) * Math.PI);
        drawFish(ctx, w * (0.42 + p * 0.06), h * (0.68 - arc * 0.32), 64 + f.t * 10, -1, {
          biome: f.b, species: f.i, rarity: f.t, mutation: f.m, wag: Math.sin(p * 12) * 0.3, glow: true, alpha: 1 - p * 0.25,
        });
      }
    }

    /* Rod and line. */
    const tipx = w * 0.78;
    const tipy = h * 0.4;
    ctx.strokeStyle = "#3d2a1c";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w + 10, h * 0.16);
    ctx.quadraticCurveTo(w * 0.94, h * 0.12, tipx, tipy);
    ctx.stroke();
    const strainNow = sim.phase === "reel" ? reelStrain() : 0;
    ctx.strokeStyle =
      strainNow <= 0 ? "rgba(231,243,241,0.8)" : strainNow < 0.75 ? "rgba(226,162,58,0.9)" : "rgba(228,87,46,0.95)";
    ctx.lineWidth = 1.25 + strainNow * 0.8;
    ctx.beginPath();
    ctx.moveTo(tipx, tipy);
    if (strainNow > 0.05 && motion) {
      ctx.quadraticCurveTo((tipx + bobx) / 2, (tipy + boby) / 2 + Math.sin(sim.t * 47) * 2.2 * strainNow, bobx, boby);
    } else ctx.lineTo(bobx, boby);
    ctx.stroke();

    /* Bobber, with the fake nibble dip while waiting. */
    const nib = sim.phase === "wait" && motion ? Math.max(0, Math.sin(sim.t * 4.2)) ** 12 * 3 : 0;
    ctx.strokeStyle = "rgba(231,243,241,0.4)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const p = (sim.t * 0.65 + i * 0.5) % 1;
      ctx.beginPath();
      ctx.ellipse(bobx, boby + 2, 6 + p * 18 + nib * 2, 2.5 + p * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    /* The bobber skin you earned (WP-8): cosmetic only. */
    const skin = skinOf(s.bobberSkin);
    ctx.fillStyle = skin.bottom;
    ctx.beginPath();
    ctx.arc(bobx, boby + nib, sim.phase === "bite" ? 7.5 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.top;
    ctx.beginPath();
    ctx.arc(bobx, boby + nib, sim.phase === "bite" ? 7.5 : 6, Math.PI, 0);
    ctx.fill();
    if (skin.id !== "plain") {
      ctx.strokeStyle = skin.ring;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bobx, boby + nib, (sim.phase === "bite" ? 7.5 : 6) + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    const mine = myBubble();
    if (mine) drawBubble(ctx, bobx, boby - 26, mine);
    countDraw(14);

    drawFightRing(ctx, bobx, boby, ringRadius(w, h, big), big, motion, !!sim.fish?.boss);

    /* Spot rings and the hover crosshair (04 §2.2). Only while a cast can be aimed. */
    if (sim.phase === "idle" && !s.photo && !s.celebration) drawSpots(ctx, w, h, s.biome, big, s.lastSpot[s.biome], s.dex);
  }

  for (const p of sim.particles) {
    const x = p.x * w;
    const y = p.y * h;
    const a = Math.max(0, p.life / p.max);
    if (p.kind === "rain") {
      ctx.strokeStyle = `rgba(231,243,241,${0.4 * a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + p.size);
      ctx.stroke();
    } else if (p.kind === "ember" || p.kind === "spark") {
      ctx.fillStyle = `rgba(226,162,58,${0.85 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "snow") {
      ctx.fillStyle = `rgba(244,247,246,${0.8 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = `rgba(231,243,241,${0.45 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, p.size + 1, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  countDraw(sim.particles.length);

  ctx.restore();
  if (s.flash && sim.hitFlash > 0) {
    ctx.fillStyle = `rgba(244,247,246,${sim.hitFlash * 0.28})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (s.flash && sim.flashA > 0) {
    ctx.fillStyle = `rgba(226,236,255,${sim.flashA * 0.22})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (s.frenzyLeft > 0) {
    ctx.strokeStyle = "rgba(226,162,58,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  }
}

/** A small speech bubble with an emote in it, tail pointing down at (x, y + 12). */
function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, emote: Emote) {
  ctx.save();
  ctx.font = "11px Outfit, sans-serif";
  const tw = ctx.measureText(emote.text).width;
  const w = tw + 34;
  ctx.fillStyle = "rgba(244,247,246,0.95)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 14, w, 28, 12);
  ctx.moveTo(x - 5, y + 13);
  ctx.lineTo(x, y + 20);
  ctx.lineTo(x + 5, y + 13);
  ctx.fill();
  ctx.font = "16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#13202a";
  ctx.fillText(emote.glyph, x - w / 2 + 8, y + 6);
  ctx.font = "11px Outfit, sans-serif";
  ctx.fillText(emote.text, x - w / 2 + 28, y + 4);
  ctx.restore();
}
