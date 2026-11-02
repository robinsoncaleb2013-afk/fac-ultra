import { useEffect, useRef, type ReactNode } from "react";
import { biomeArt, fitCanvas, loadArt } from "@/game/art";
import { BIOMES, WEATHER } from "@/game/content";
import { drawFish } from "@/game/fish-draw";
import { act, frame, sim, useGame } from "@/game/engine";

const FALLBACK: [string, string][] = [
  ["#d7b56a", "#1d6a62"],
  ["#9eb8c4", "#1a6e78"],
  ["#c9d4c4", "#1c4a55"],
  ["#6e8a62", "#163e36"],
  ["#e2c48a", "#1a6f88"],
  ["#7ed0c8", "#0e6a78"],
  ["#d5e4ee", "#2a5a68"],
  ["#1a2740", "#071018"],
  ["#c45a32", "#1a1818"],
  ["#f0c9a0", "#6a88a8"],
];

export function Stage() {
  const ref = useRef<HTMLCanvasElement>(null);
  const biome = useGame((s) => s.biome);
  const weather = useGame((s) => s.weather);
  const frenzy = useGame((s) => s.frenzyLeft);

  useEffect(() => {
    loadArt();
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame(dt);
      paint(canvas);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative aspect-video w-full max-h-72 shrink-0 overflow-hidden sm:max-h-80">
      <canvas
        ref={ref}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={() => act()}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-1.5 p-3">
        <Chip>{WEATHER[weather].name}</Chip>
        <Chip>{BIOMES[biome].name}</Chip>
        {frenzy > 0 ? <Chip brass>Frenzy {Math.ceil(frenzy)}s</Chip> : null}
      </div>
    </div>
  );
}

function Chip({ children, brass }: { children: ReactNode; brass?: boolean }) {
  return (
    <span
      className={
        "rounded-full border border-line bg-bg/80 px-2.5 py-1 text-xs backdrop-blur-sm " +
        (brass ? "text-brass" : "text-fg")
      }
    >
      {children}
    </span>
  );
}

function paint(canvas: HTMLCanvasElement) {
  const box = fitCanvas(canvas);
  if (!box) return;
  const { ctx, w, h } = box;
  const s = useGame.getState();
  const amp = s.motion ? sim.trauma * sim.trauma : 0;
  ctx.fillStyle = "#0c1a22";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  if (amp) ctx.translate(Math.sin(sim.t * 53) * 7 * amp, Math.cos(sim.t * 41) * 5 * amp);

  const img = biomeArt(s.biome);
  if (img && img.complete && img.naturalWidth) drawCover(ctx, img, w, h, s.motion ? sim.t : 0);
  else {
    const [sky, water] = FALLBACK[s.biome] ?? FALLBACK[0];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky);
    g.addColorStop(0.46, sky);
    g.addColorStop(0.46, water);
    g.addColorStop(1, "#07141c");
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, w + 40, h + 40);
  }

  if (s.weather === 4) {
    ctx.fillStyle = "rgba(4, 10, 18, 0.38)";
    ctx.fillRect(-20, -20, w + 40, h + 40);
  } else if (s.weather === 2) {
    ctx.fillStyle = "rgba(8, 16, 28, 0.22)";
    ctx.fillRect(-20, -20, w + 40, h + 40);
  } else if (s.weather === 3) {
    ctx.fillStyle = "rgba(210, 220, 224, 0.2)";
    ctx.fillRect(-20, -20, w + 40, h + 40);
  }

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#e7f3f1";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = h * (0.68 + i * 0.06) + Math.sin(sim.t * 1.4 + i) * 2;
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

  for (const fish of sim.swimmers) {
    const len = 28 * fish.sc;
    drawFish(ctx, fish.x * w, fish.y * h, len, fish.dir, {
      biome: s.biome,
      species: (s.biome * 2 + fish.species) % 20,
      rarity: fish.species % 5 === 0 ? 1 : 0,
      mutation: 0,
      wag: Math.sin(sim.t * 7 + fish.phase) * 0.4,
      alpha: 0.9,
    });
  }

  const bobx = sim.bnx * w;
  const boby = sim.bny * h;
  if ((sim.phase === "bite" || sim.phase === "reel") && sim.fish) {
    const f = sim.fish;
    drawFish(ctx, bobx - 10, boby + 8, 48 + f.t * 8, Math.sign(sim.cd) || -1, {
      biome: f.b,
      species: f.i,
      rarity: f.t,
      mutation: f.m,
      wag: Math.sin(sim.t * (sim.phase === "bite" ? 20 : 8)) * 0.45,
      glow: f.boss || f.t >= 3,
    });
  }

  if (sim.leap) {
    const f = sim.leap.look;
    const p = sim.leap.t / 0.95;
    const arc = Math.sin(Math.min(1, p) * Math.PI);
    drawFish(ctx, w * (0.42 + p * 0.06), h * (0.68 - arc * 0.32), 64 + f.t * 10, -1, {
      biome: f.b,
      species: f.i,
      rarity: f.t,
      mutation: f.m,
      wag: Math.sin(p * 12) * 0.3,
      glow: true,
      alpha: 1 - p * 0.25,
    });
  }

  const tipx = w * 0.78;
  const tipy = h * 0.4;
  ctx.strokeStyle = "#3d2a1c";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(w + 10, h * 0.16);
  ctx.quadraticCurveTo(w * 0.94, h * 0.12, tipx, tipy);
  ctx.stroke();
  ctx.strokeStyle = "rgba(231,243,241,0.8)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(tipx, tipy);
  ctx.lineTo(bobx, boby);
  ctx.stroke();

  ctx.strokeStyle = "rgba(231,243,241,0.4)";
  for (let i = 0; i < 2; i++) {
    const p = (sim.t * 0.65 + i * 0.5) % 1;
    ctx.beginPath();
    ctx.ellipse(bobx, boby + 2, 6 + p * 18, 2.5 + p * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#e2a23a";
  ctx.beginPath();
  ctx.arc(bobx, boby, sim.phase === "bite" ? 7.5 : 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4f7f6";
  ctx.beginPath();
  ctx.arc(bobx, boby, sim.phase === "bite" ? 7.5 : 6, Math.PI, 0);
  ctx.fill();

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
  const ox = (w - dw) / 2;
  const oy = (h - dh) * 0.42;
  ctx.drawImage(img, ox, oy, dw, dh);
}
