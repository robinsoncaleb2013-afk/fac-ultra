/* Seeded randomness (docs/architecture/04 §1).

   Inside src/game/** the fishing model draws every random number from `rng()`
   so a tournament can replay a cast exactly: `setRng(makeRng(seedFrom(...)))`
   before the cast and the same seed always gives the same fish.

   `loose()` is a separate, always-unseeded stream for things that must NOT
   disturb the replay: ids, room codes, sound jitter, particles. Because it is
   its own stream, a cosmetic roll never shifts which fish bites.

   This file is the only place in src/game allowed to call Math.random(); it
   uses it once per stream at load to pick a starting seed. */

export type Rng = () => number; // [0, 1)

/** mulberry32: a tiny, fast, well-spread 32-bit generator. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over the parts joined with a separator, so ("a","bc") and ("ab","c") differ. */
export function seedFrom(...parts: (string | number)[]): number {
  const text = parts.map(String).join("\u001f");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function randomSeed() {
  return (Date.now() ^ (Math.random() * 2 ** 32)) >>> 0;
}

/** The active stream. Casual play keeps the unpredictable default. */
export let rng: Rng = makeRng(randomSeed());

export function setRng(r: Rng): void {
  rng = r;
}

/** Unseeded stream for ids, cosmetics and sound — never replayed, never shared with the model. */
export const loose: Rng = makeRng(randomSeed() ^ 0x9e3779b9);

export function pick<T>(arr: readonly T[], r: Rng = rng): T {
  return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
}

/** Index chosen with probability proportional to its weight. Zero weights are never chosen
    (unless every weight is zero, which falls back to the last index). */
export function weighted(weights: readonly number[], r: Rng = rng): number {
  let sum = 0;
  for (const w of weights) sum += w;
  let x = r() * sum;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    if (x < weights[i]) return i;
    x -= weights[i];
  }
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
  return Math.max(0, weights.length - 1);
}

export function range(min: number, max: number, r: Rng = rng): number {
  return min + r() * (max - min);
}
