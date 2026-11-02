import { BIOMES } from "@/game/content";
import { sim, useGame } from "@/game/engine";
import { photoCaption } from "@/game/trips";

/** P: save the water as a picture, with a caption strip (water, the fish if one is up, the date). */
export function takePhoto() {
  const s = useGame.getState();
  const src = document.querySelector<HTMLCanvasElement>("canvas[data-stage]");
  if (!src || !src.width || !src.height) return;
  const up = s.celebration?.catch;
  const hooked = sim.fish && (sim.phase === "bite" || sim.phase === "reel") ? sim.fish : null;
  const fish = up
    ? { name: up.name, w: up.weight }
    : hooked
      ? { name: hooked.boss ? `Tide ${hooked.name}` : hooked.name, w: hooked.w }
      : null;
  const caption = photoCaption({ water: s.biome, fish, at: new Date() });
  const strip = Math.max(44, Math.round(src.height * 0.07));
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height + strip;
  const ctx = out.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(src, 0, 0);
  ctx.fillStyle = "#0c1a22";
  ctx.fillRect(0, src.height, out.width, strip);
  ctx.fillStyle = "#e2a23a";
  ctx.fillRect(0, src.height, out.width, 2);
  ctx.fillStyle = "#e7f3f1";
  ctx.font = `${Math.round(strip * 0.42)}px Fraunces, Georgia, serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(caption, Math.round(strip * 0.4), src.height + strip / 2 + 1, out.width - strip * 0.8);
  out.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fac-ultra-${BIOMES[s.biome].id}-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    s.notify("Picture saved.");
  }, "image/png");
}
