import { BIOMES } from "@/game/content";

/* Painting loader (docs/architecture/03 §6, 09 §5).
   Each biome has <id>-1600.webp and <id>-800.webp (scripts/art-build.mjs) and,
   until those are generated and committed, the original <id>.jpg. The loader
   asks for WebP first and quietly falls back to the JPG, so the game works
   with either. While only JPGs exist (large, one size), nothing is loaded
   ahead of time: only the water you are standing in. */

export type ArtSize = 800 | 1600;

type Slot = { 800?: HTMLImageElement; 1600?: HTMLImageElement; jpg?: HTMLImageElement };
const slots: Slot[] = BIOMES.map(() => ({}));
const pending = new Map<string, Promise<HTMLImageElement | null>>();

/** null = not known yet; true once any WebP loaded; false once one 404ed. */
let webpOk: boolean | null = null;

export function artUrl(id: string, size: ArtSize | "jpg"): string {
  return size === "jpg" ? `/art/biomes/${id}.jpg` : `/art/biomes/${id}-${size}.webp`;
}

function pull(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function fetchSize(biome: number, size: ArtSize): Promise<HTMLImageElement | null> {
  const key = `${biome}:${size}`;
  const hit = pending.get(key);
  if (hit) return hit;
  const id = BIOMES[biome]?.id;
  if (!id) return Promise.resolve(null);
  const job = (async () => {
    const slot = slots[biome];
    if (slot[size]) return slot[size] ?? null;
    if (webpOk !== false) {
      const w = await pull(artUrl(id, size));
      if (w) {
        webpOk = true;
        slot[size] = w;
        return w;
      }
      if (webpOk === null) webpOk = false;
    }
    if (!slot.jpg) slot.jpg = (await pull(artUrl(id, "jpg"))) ?? undefined;
    return slot.jpg ?? null;
  })();
  pending.set(key, job);
  return job;
}

/** Is it polite to fetch extra paintings ahead of time on this connection? */
function connectionOk(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return true;
  return c.saveData !== true && (c.effectiveType === undefined || c.effectiveType === "4g");
}

function whenIdle(fn: () => void) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn);
  else window.setTimeout(fn, 400);
}

/** Width to load: 1600 for big stages, 800 for the menu, small stages and the mobile tier. */
export function wantedSize(stageWidth: number, dpr: number, maxSize: ArtSize): ArtSize {
  return maxSize === 1600 && Math.min(1600, stageWidth * dpr) > 800 ? 1600 : 800;
}

let sweepStarted = false;

/**
 * Load the painting for `biome`; then (when WebP exists and the connection is
 * good) its unlocked neighbours at 800, then the rest, one at a time, when idle.
 */
export async function loadArt(
  biome: number,
  opts: { size?: ArtSize; neighbors?: boolean; unlocked?: number[] } = {},
): Promise<void> {
  const size = opts.size ?? 800;
  await fetchSize(biome, size);
  if (opts.neighbors === false || !webpOk || !connectionOk()) return;
  const unlocked = opts.unlocked ?? [0];
  const near = [biome - 1, biome + 1].filter((b) => b >= 0 && b < BIOMES.length && unlocked.includes(b));
  for (const b of near) await fetchSize(b, 800);
  if (sweepStarted) return;
  sweepStarted = true;
  const rest = BIOMES.map((_, i) => i).filter((i) => i !== biome && !near.includes(i));
  const next = () => {
    const i = rest.shift();
    if (i === undefined) return;
    void fetchSize(i, 800).then(() => whenIdle(next));
  };
  whenIdle(next);
}

/** The best painting loaded so far for a biome (largest WebP, else any, else the JPG). */
export function biomeArt(i: number): HTMLImageElement | undefined {
  const s = slots[i];
  return s?.[1600] ?? s?.[800] ?? s?.jpg;
}

export function fitCanvas(canvas: HTMLCanvasElement, dprCap = 2) {
  const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
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
  return { ctx, w, h, dpr };
}
