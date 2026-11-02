import { BIOMES } from "@/game/content";

const backgrounds: (HTMLImageElement | null)[] = BIOMES.map(() => null);

export function loadArt() {
  BIOMES.forEach((biome, i) => {
    if (backgrounds[i]) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      backgrounds[i] = img;
    };
    img.src = `/art/biomes/${biome.id}.jpg`;
  });
}

export function biomeArt(i: number) {
  return backgrounds[i];
}

export function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return null;
  const width = Math.round(w * dpr);
  const height = Math.round(h * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
