import { archetypeOf, BIOMES, SPECIES_PER_BIOME, type Arch } from "@/game/content";

export type { Arch };

export type Pattern = "stripes" | "spots" | "saddle" | "gradient" | "glowtips" | "plain";

type Traits = {
  arch: Arch;
  fat: number;
  hueJ: number;
  spots: boolean;
  stripes: boolean;
  pattern: Pattern;
  dorsal: number;
};

const cache = new Map<number, Traits>();

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function traitsOf(biome: number, species: number): Traits {
  const key = biome * SPECIES_PER_BIOME + species;
  const hit = cache.get(key);
  if (hit) return hit;
  const name = BIOMES[biome]?.fish[species] ?? "Fish";
  const r = rng(key * 97 + 3);
  const spots = r() > 0.48;
  const stripes = r() > 0.66;
  const pv = r();
  const pattern: Pattern =
    pv < 0.2 ? "saddle" : pv < 0.4 ? "gradient" : pv < 0.55 ? "glowtips" : stripes ? "stripes" : spots ? "spots" : "plain";
  const t: Traits = {
    arch: archetypeOf(name),
    fat: 0.2 + r() * 0.14,
    hueJ: r() * 28 - 14,
    spots,
    stripes,
    pattern,
    dorsal: 0.35 + r() * 0.5,
  };
  cache.set(key, t);
  return t;
}

export type FishLook = {
  biome: number;
  species: number;
  rarity: number;
  mutation: number;
  wag?: number;
  alpha?: number;
  glow?: boolean;
};

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}% / ${a})`;
}

export function drawFish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  dir: number,
  look: FishLook,
) {
  const t = traitsOf(look.biome, look.species);
  const baseH = [78, 162, 205, 348, 36][look.rarity] ?? 78;
  let h = baseH + t.hueJ;
  let s = [34, 48, 30, 54, 66][look.rarity] ?? 34;
  let l = [42, 40, 60, 52, 52][look.rarity] ?? 42;
  if (look.mutation === 1) {
    h = 350;
    s = 20;
    l = 78;
  } else if (look.mutation === 2) {
    h = 40;
    s = 74;
    l = 52;
  } else if (look.mutation === 3) {
    h = 168;
    s = 90;
    l = 52;
  } else if (look.mutation === 4) {
    s = 80;
    l = 54;
  } else if (look.mutation === 5) {
    h = 232;
    s = 42;
    l = 20;
  }

  const alpha = look.alpha ?? 1;
  const wag = look.wag ?? 0;
  const body = hsl(h, s, l);
  const belly = hsl(h, Math.max(8, s - 18), Math.min(92, l + 26));
  const fin = hsl(h, Math.min(92, s + 6), Math.max(18, l - 12));
  const ink = hsl(h, 18, 12, 0.92);
  const fat = t.arch === "whale" ? t.fat + 0.08 : t.fat;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir || 1, 1);
  ctx.globalAlpha = alpha;
  if (look.glow) {
    ctx.shadowColor = hsl(h, 80, 62, 0.95);
    ctx.shadowBlur = len * 0.2;
  }

  const strokeInk = (width: number) => {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const paintBody = (path: () => void) => {
    ctx.save();
    path();
    if (look.mutation === 4) {
      const g = ctx.createLinearGradient(-len * 0.45, 0, len * 0.45, 0);
      g.addColorStop(0, hsl(8, 72, 52));
      g.addColorStop(0.35, hsl(48, 84, 56));
      g.addColorStop(0.68, hsl(152, 64, 46));
      g.addColorStop(1, hsl(205, 74, 52));
      ctx.fillStyle = g;
    } else if (t.pattern === "gradient") {
      const g = ctx.createLinearGradient(0, -len * 0.3, 0, len * 0.3);
      g.addColorStop(0, hsl(h, s, Math.max(14, l - 16)));
      g.addColorStop(0.55, body);
      g.addColorStop(1, hsl(h, Math.max(10, s - 10), Math.min(90, l + 24)));
      ctx.fillStyle = g;
    } else ctx.fillStyle = body;
    ctx.fill();
    strokeInk(Math.max(1.2, len * 0.034));
    ctx.clip();
    ctx.fillStyle = belly;
    ctx.globalAlpha = alpha * 0.55;
    ctx.beginPath();
    ctx.ellipse(len * 0.02, len * fat * 0.35, len * 0.3, len * fat * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    if (t.pattern === "saddle") {
      ctx.fillStyle = hsl(h, Math.min(90, s + 10), Math.max(12, l - 20), 0.6);
      ctx.beginPath();
      ctx.ellipse(-len * 0.02, -len * fat * 0.55, len * 0.16, len * fat * 0.62, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(len * 0.24, -len * fat * 0.4, len * 0.07, len * fat * 0.45, 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (t.stripes) {
      ctx.strokeStyle = hsl(h, s, Math.max(12, l - 16), 0.55);
      ctx.lineWidth = Math.max(1, len * 0.028);
      for (let i = -2; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-len * 0.18 + i * len * 0.1, -len * 0.28);
        ctx.lineTo(-len * 0.26 + i * len * 0.1, len * 0.28);
        ctx.stroke();
      }
    } else if (t.spots) {
      ctx.fillStyle = hsl(h, Math.max(10, s - 8), Math.min(90, l + 20), 0.75);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(-len * 0.12 + (i % 3) * len * 0.13, (i < 3 ? -1 : 1) * len * fat * 0.32, len * 0.032, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (t.pattern === "glowtips") {
      ctx.fillStyle = hsl(48, 92, 70, 0.9);
      ctx.beginPath();
      ctx.ellipse(-len * 0.3, 0, len * 0.045, len * fat * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(len * 0.05, -len * fat * 0.85, len * 0.09, len * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (look.mutation === 5) {
      ctx.fillStyle = hsl(46, 80, 72, 0.9);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(-len * 0.2 + (i % 4) * len * 0.12, Math.sin(i * 1.7) * len * fat * 0.35, len * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  const eye = (ex: number, ey: number, r: number) => {
    ctx.fillStyle = look.mutation === 1 ? hsl(350, 55, 46) : "#f4f7f6";
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hsl(h, 25, 10);
    ctx.beginPath();
    ctx.arc(ex + r * 0.15, ey, r * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "hsla(0 0% 100% / 0.85)";
    ctx.beginPath();
    ctx.arc(ex - r * 0.22, ey - r * 0.28, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  };

  if (t.arch === "eel") {
    ctx.lineCap = "round";
    ctx.strokeStyle = ink;
    ctx.lineWidth = len * 0.16;
    ctx.beginPath();
    ctx.moveTo(len * 0.42, 0);
    const wob = wag * len * 0.15;
    ctx.bezierCurveTo(len * 0.12, -len * 0.16 + wob, -len * 0.16, len * 0.18 - wob, -len * 0.5, wob * 0.4);
    ctx.stroke();
    ctx.strokeStyle = body;
    ctx.lineWidth = len * 0.11;
    ctx.stroke();
    eye(len * 0.3, -len * 0.02, len * 0.032);
  } else if (t.arch === "ray") {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(len * 0.42, 0);
      ctx.quadraticCurveTo(len * 0.05, -len * 0.42, -len * 0.28, -len * 0.06);
      ctx.quadraticCurveTo(-len * 0.42, 0, -len * 0.28, len * 0.06);
      ctx.quadraticCurveTo(len * 0.05, len * 0.42, len * 0.42, 0);
      ctx.closePath();
    };
    ctx.save();
    ctx.translate(-len * 0.32, 0);
    ctx.rotate(wag);
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-len * 0.22, -len * 0.08);
    ctx.lineTo(-len * 0.22, len * 0.08);
    ctx.closePath();
    ctx.fill();
    strokeInk(Math.max(1, len * 0.02));
    ctx.restore();
    paintBody(path);
    eye(len * 0.22, -len * 0.02, len * 0.03);
  } else if (t.arch === "round") {
    const path = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.32, len * 0.26, 0, 0, Math.PI * 2);
    };
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.ellipse(-len * 0.34, len * 0.08, len * 0.08, len * 0.05, 0.4, 0, Math.PI * 2);
    ctx.ellipse(-len * 0.34, -len * 0.08, len * 0.08, len * 0.05, -0.4, 0, Math.PI * 2);
    ctx.fill();
    paintBody(path);
    eye(len * 0.12, -len * 0.06, len * 0.04);
  } else if (t.arch === "turtle") {
    /* Flippers behind the shell. */
    ctx.fillStyle = fin;
    for (const [fx, fy, rot] of [
      [0.22, -0.16, -0.5],
      [0.22, 0.16, 0.5],
      [-0.24, -0.14, 0.6],
      [-0.24, 0.14, -0.6],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(len * fx, len * fy + Math.sin(wag * 3 + fx * 9) * len * 0.015, len * 0.09, len * 0.045, rot, 0, Math.PI * 2);
      ctx.fill();
    }
    const path = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.34, len * 0.24, 0, 0, Math.PI * 2);
    };
    paintBody(path);
    /* Shell plates. */
    ctx.strokeStyle = hsl(h, s, Math.max(12, l - 18), 0.7);
    ctx.lineWidth = Math.max(1, len * 0.02);
    for (const px of [-0.14, 0.02, 0.18]) {
      ctx.beginPath();
      ctx.ellipse(len * px, 0, len * 0.07, len * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    /* Head. */
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(len * 0.42, 0, len * 0.08, len * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    strokeInk(Math.max(1, len * 0.02));
    eye(len * 0.44, -len * 0.02, len * 0.026);
  } else if (t.arch === "squid") {
    /* Tentacles trail behind, waggling. */
    ctx.strokeStyle = fin;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const off = (i - 2.5) * len * 0.045;
      ctx.lineWidth = len * 0.028;
      ctx.beginPath();
      ctx.moveTo(-len * 0.18, off * 0.4);
      ctx.quadraticCurveTo(
        -len * 0.34,
        off + Math.sin(wag * 6 + i * 1.3) * len * 0.05,
        -len * 0.5,
        off * 1.6 + Math.cos(wag * 5 + i) * len * 0.04,
      );
      ctx.stroke();
    }
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(len * 0.46, 0);
      ctx.quadraticCurveTo(len * 0.2, -len * 0.2, -len * 0.05, -len * 0.13);
      ctx.lineTo(-len * 0.2, 0);
      ctx.lineTo(-len * 0.05, len * 0.13);
      ctx.quadraticCurveTo(len * 0.2, len * 0.2, len * 0.46, 0);
      ctx.closePath();
    };
    paintBody(path);
    eye(len * 0.08, -len * 0.045, len * 0.045);
    eye(len * 0.08, len * 0.045, len * 0.045);
  } else if (t.arch === "seahorse") {
    ctx.lineCap = "round";
    const sway = wag * len * 0.05;
    ctx.strokeStyle = ink;
    ctx.lineWidth = len * 0.17;
    ctx.beginPath();
    ctx.moveTo(len * 0.05, -len * 0.3);
    ctx.bezierCurveTo(len * 0.22, -len * 0.12, len * 0.16, len * 0.1, -len * 0.02, len * 0.22);
    ctx.bezierCurveTo(-len * 0.14, len * 0.3, -len * 0.2 + sway, len * 0.2, -len * 0.16 + sway, len * 0.08);
    ctx.stroke();
    ctx.strokeStyle = body;
    ctx.lineWidth = len * 0.115;
    ctx.stroke();
    /* Snout + coronet. */
    ctx.strokeStyle = body;
    ctx.lineWidth = len * 0.07;
    ctx.beginPath();
    ctx.moveTo(len * 0.05, -len * 0.3);
    ctx.lineTo(len * 0.24, -len * 0.34);
    ctx.stroke();
    ctx.fillStyle = fin;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-len * 0.02 + i * len * 0.045, -len * 0.4, len * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
    /* Dorsal fan. */
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.ellipse(-len * 0.08, -len * 0.02, len * 0.07, len * 0.045, wag, 0, Math.PI * 2);
    ctx.fill();
    eye(len * 0.09, -len * 0.29, len * 0.03);
  } else if (t.arch === "angler") {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(len * 0.46, len * 0.04);
      ctx.bezierCurveTo(len * 0.24, -len * fat * 1.15, -len * 0.05, -len * fat * 1.2, -len * 0.27, -len * fat * 0.4);
      ctx.bezierCurveTo(-len * 0.35, len * fat * 0.2, -len * 0.1, len * fat * 1.05, len * 0.22, len * fat * 0.9);
      ctx.quadraticCurveTo(len * 0.42, len * fat * 0.5, len * 0.46, len * 0.04);
      ctx.closePath();
    };
    ctx.save();
    ctx.translate(-len * 0.25, 0);
    ctx.rotate(wag);
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-len * 0.15, -len * fat, -len * 0.27, -len * fat * 0.7);
    ctx.quadraticCurveTo(-len * 0.1, 0, -len * 0.27, len * fat * 0.7);
    ctx.quadraticCurveTo(-len * 0.15, len * fat, 0, 0);
    ctx.closePath();
    ctx.fill();
    strokeInk(Math.max(1, len * 0.026));
    ctx.restore();
    paintBody(path);
    /* The lure: stalk + glowing bulb. */
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, len * 0.022);
    ctx.beginPath();
    ctx.moveTo(len * 0.16, -len * fat * 0.8);
    ctx.quadraticCurveTo(len * 0.3, -len * (fat + 0.42), len * 0.44, -len * (fat + 0.3));
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = hsl(48, 95, 66, 0.95);
    ctx.shadowBlur = len * 0.22;
    ctx.fillStyle = hsl(48, 95, 72);
    ctx.beginPath();
    ctx.arc(len * 0.45, -len * (fat + 0.28), len * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    /* Teeth. */
    ctx.fillStyle = "#f4f7f6";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(len * (0.3 + i * 0.045), len * fat * 0.52);
      ctx.lineTo(len * (0.32 + i * 0.045), len * fat * 0.34);
      ctx.lineTo(len * (0.34 + i * 0.045), len * fat * 0.52);
      ctx.closePath();
      ctx.fill();
    }
    eye(len * 0.24, -len * fat * 0.3, len * 0.038);
  } else if (t.arch === "crab") {
    /* Legs. */
    ctx.strokeStyle = fin;
    ctx.lineCap = "round";
    ctx.lineWidth = len * 0.03;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const lx = len * (-0.16 + i * 0.15);
        const bend = Math.sin(wag * 7 + i * 1.7 + side) * len * 0.02;
        ctx.beginPath();
        ctx.moveTo(lx, side * len * 0.14);
        ctx.lineTo(lx - len * 0.06, side * len * 0.26 + bend);
        ctx.lineTo(lx - len * 0.02, side * len * 0.36 + bend);
        ctx.stroke();
      }
    }
    /* Claws. */
    for (const side of [-1, 1]) {
      ctx.fillStyle = fin;
      ctx.beginPath();
      ctx.ellipse(len * 0.36, side * len * 0.17, len * 0.1, len * 0.065, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
      strokeInk(Math.max(1, len * 0.02));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(len * 0.42, side * len * 0.17);
      ctx.lineTo(len * 0.52, side * len * 0.1);
      ctx.lineTo(len * 0.5, side * len * 0.2);
      ctx.closePath();
      ctx.fill();
    }
    const path = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.32, len * 0.19, 0, 0, Math.PI * 2);
    };
    paintBody(path);
    /* Eye stalks. */
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, len * 0.02);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(len * 0.24, side * len * 0.07);
      ctx.lineTo(len * 0.32, side * len * 0.13);
      ctx.stroke();
    }
    eye(len * 0.33, -len * 0.13, len * 0.026);
    eye(len * 0.33, len * 0.13, len * 0.026);
  } else if (t.arch === "jelly") {
    /* Tentacles first, under the bell. */
    ctx.strokeStyle = hsl(h, s, Math.min(88, l + 18), 0.65);
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const tx = -len * 0.2 + i * len * 0.065;
      ctx.lineWidth = len * 0.02;
      ctx.beginPath();
      ctx.moveTo(tx, len * 0.08);
      ctx.bezierCurveTo(
        tx + Math.sin(wag * 4 + i) * len * 0.05,
        len * 0.24,
        tx - Math.sin(wag * 4 + i) * len * 0.05,
        len * 0.36,
        tx + Math.sin(wag * 3 + i * 1.4) * len * 0.07,
        len * 0.5,
      );
      ctx.stroke();
    }
    const pulse = 1 + Math.sin(wag * 4) * 0.05;
    const path = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.3 * pulse, len * 0.24 / pulse, 0, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(len * 0.3 * pulse, len * 0.1, len * 0.2, len * 0.09);
      ctx.quadraticCurveTo(0, len * 0.16, -len * 0.2, len * 0.09);
      ctx.quadraticCurveTo(-len * 0.3 * pulse, len * 0.1, -len * 0.3 * pulse, 0);
      ctx.closePath();
    };
    ctx.save();
    ctx.globalAlpha = alpha * 0.88;
    paintBody(path);
    ctx.restore();
    eye(len * 0.1, -len * 0.08, len * 0.024);
  } else if (t.arch === "shark" || t.arch === "whale") {
    const tall = t.arch === "shark" ? fat * 0.85 : fat + 0.06;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(len * 0.46, len * 0.02);
      ctx.bezierCurveTo(len * 0.2, -len * tall, -len * 0.05, -len * tall * 1.05, -len * 0.3, -len * tall * 0.25);
      ctx.bezierCurveTo(-len * 0.38, len * 0.02, -len * 0.16, len * tall, len * 0.2, len * tall * 0.85);
      ctx.quadraticCurveTo(len * 0.4, len * tall * 0.4, len * 0.46, len * 0.02);
      ctx.closePath();
    };
    ctx.save();
    ctx.translate(-len * 0.28, 0);
    ctx.rotate(wag);
    ctx.fillStyle = fin;
    ctx.beginPath();
    if (t.arch === "shark") {
      ctx.moveTo(0, -len * 0.02);
      ctx.lineTo(-len * 0.22, -len * 0.2);
      ctx.lineTo(-len * 0.16, len * 0.12);
      ctx.closePath();
    } else {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-len * 0.16, -len * 0.16, -len * 0.28, -len * 0.05);
      ctx.quadraticCurveTo(-len * 0.12, 0, -len * 0.28, len * 0.05);
      ctx.quadraticCurveTo(-len * 0.16, len * 0.16, 0, 0);
    }
    ctx.fill();
    strokeInk(Math.max(1, len * 0.028));
    ctx.restore();
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(-len * 0.02, -len * tall * 0.75);
    ctx.lineTo(len * 0.08, -len * (tall + (t.arch === "shark" ? 0.28 : 0.12)));
    ctx.lineTo(len * 0.16, -len * tall * 0.45);
    ctx.closePath();
    ctx.fill();
    paintBody(path);
    eye(len * 0.24, -len * tall * 0.15, len * (t.arch === "whale" ? 0.035 : 0.028));
  } else {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(len * 0.46, 0);
      ctx.bezierCurveTo(len * 0.22, -len * fat, -len * 0.02, -len * fat * 1.12, -len * 0.28, -len * fat * 0.38);
      ctx.bezierCurveTo(-len * 0.36, 0, -len * 0.36, 0, -len * 0.28, len * fat * 0.38);
      ctx.bezierCurveTo(-len * 0.02, len * fat * 1.02, len * 0.24, len * fat * 0.92, len * 0.46, 0);
      ctx.closePath();
    };
    ctx.save();
    ctx.translate(-len * 0.26, 0);
    ctx.rotate(wag);
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-len * 0.16, -len * fat * 1.2, -len * 0.3, -len * fat * 0.82);
    ctx.quadraticCurveTo(-len * 0.12, 0, -len * 0.3, len * fat * 0.82);
    ctx.quadraticCurveTo(-len * 0.16, len * fat * 1.2, 0, 0);
    ctx.closePath();
    ctx.fill();
    strokeInk(Math.max(1, len * 0.028));
    ctx.restore();
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(-len * 0.02, -len * fat * 0.72);
    ctx.quadraticCurveTo(len * 0.06, -len * (fat + t.dorsal * 0.26), len * 0.16, -len * fat * 0.5);
    ctx.quadraticCurveTo(len * 0.06, -len * fat * 0.35, -len * 0.02, -len * fat * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(len * 0.08, len * fat * 0.2);
    ctx.quadraticCurveTo(-len * 0.02, len * fat * 0.95, -len * 0.1, len * fat * 0.4);
    ctx.quadraticCurveTo(0, len * fat * 0.15, len * 0.08, len * fat * 0.2);
    ctx.fill();
    paintBody(path);
    eye(len * 0.26, -len * fat * 0.16, len * 0.042);
  }

  if (look.mutation === 3 && t.arch !== "eel") {
    ctx.strokeStyle = hsl(312, 90, 64, 0.85);
    ctx.lineWidth = Math.max(1, len * 0.018);
    ctx.beginPath();
    ctx.ellipse(0, 0, len * 0.34, len * fat * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
