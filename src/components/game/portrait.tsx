import { useEffect, useRef } from "react";
import { fitCanvas } from "@/game/art";
import { useGame } from "@/game/engine";
import { drawFish } from "@/game/fish-draw";

export function FishPortrait({
  biome,
  species,
  rarity,
  mutation,
  className,
}: {
  biome: number;
  species: number;
  rarity: number;
  mutation: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const motion = useGame((s) => s.motion);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    /* A private phase per species, so a wall of portraits never swims in sync. */
    const phase = ((biome * 31 + species * 17) % 628) / 100;
    const paint = (t: number) => {
      const box = fitCanvas(canvas);
      if (!box) return;
      const { ctx, w, h } = box;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "hsla(190 30% 8% / 0.18)";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.82, w * 0.22, h * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      drawFish(ctx, w * 0.56, h * 0.52 + (motion ? Math.sin(t / 640 + phase) * h * 0.02 : 0), Math.min(w, h) * 0.78, -1, {
        biome,
        species,
        rarity,
        mutation,
        glow: rarity >= 4,
        wag: motion ? Math.sin(t / 340 + phase) * 0.38 : 0,
      });
    };
    paint(0);
    const observer = new ResizeObserver(() => paint(performance.now()));
    observer.observe(canvas);
    if (!motion) return () => observer.disconnect();
    /* Swim only while on screen: a dex grid can hold 25 portraits, and a
       mid-range phone should not pay for fish nobody is looking at. */
    let raf = 0;
    let visible = true;
    const loop = (t: number) => {
      if (visible) paint(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const gate = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { rootMargin: "40px" });
    gate.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      gate.disconnect();
    };
  }, [biome, species, rarity, mutation, motion]);
  return <canvas ref={ref} className={className} aria-hidden />;
}
