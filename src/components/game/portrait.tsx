import { useEffect, useRef } from "react";
import { fitCanvas } from "@/game/art";
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
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => {
      const box = fitCanvas(canvas);
      if (!box) return;
      const { ctx, w, h } = box;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "hsla(190 30% 8% / 0.18)";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.82, w * 0.22, h * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      drawFish(ctx, w * 0.56, h * 0.52, Math.min(w, h) * 0.78, -1, {
        biome,
        species,
        rarity,
        mutation,
        glow: rarity >= 4,
      });
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [biome, species, rarity, mutation]);
  return <canvas ref={ref} className={className} aria-hidden />;
}
