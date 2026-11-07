/* Ambience (docs/architecture/05 §6.5): which loop plays, how loud, and what the sky adds.

   Five 30-second OGG loops live in public/audio/ (built by scripts/ambience-build.mjs, about
   0.75 MB in all, under the 1.25 MB budget). They are fetched lazily: nothing downloads until the player's
   first tap or key press and only the loop for the water they are in. Rain and wind come from the
   existing WebAudio synth in audio.ts, so weather costs no download at all. Pure decisions only;
   audio.ts does the playing. */

import type { Mode } from "./modes.ts";

/** One loop per group of waters. Canyon is dry wind, so it sits with the wind loop (decision, 05 lists no canyon). */
export const AMBIENCE_GROUPS = [
  { id: "pond-river", label: "Pond and River", file: "/audio/amb-pond-river.ogg", waters: [0, 1, 19] },
  { id: "lake-swamp", label: "Lake, Swamp and Mangrove", file: "/audio/amb-lake-swamp.ogg", waters: [2, 3, 4] },
  { id: "coast-reef", label: "Coast, Reef and Kelp", file: "/audio/amb-coast-reef.ogg", waters: [5, 7, 8, 15] },
  { id: "cold-deep", label: "Arctic, Deep and Sunken City", file: "/audio/amb-cold-deep.ogg", waters: [9, 10, 11, 16, 17] },
  { id: "fire-sky", label: "Canyon, Volcano, Sky and Astral", file: "/audio/amb-fire-sky.ogg", waters: [6, 12, 13, 14, 18] },
] as const;

export const DEFAULT_VOLUME = 35;
/** The crossfade between two loops when you travel, in seconds. */
export const CROSSFADE_S = 2;
/** The loudest the loop gets at 100% on the slider (leaves headroom for the sound effects). */
export const LOOP_CEILING = 0.8;
/** While Kid Mode is reading a message aloud, the ambience steps back to this share. */
export const DUCK = 0.25;

export function groupOf(biome: number): number {
  const i = AMBIENCE_GROUPS.findIndex((g) => (g.waters as readonly number[]).includes(biome));
  return i < 0 ? 0 : i;
}

export type AmbienceInput = {
  sound: boolean;
  /** The slider, 0 to 100. */
  volume: number;
  screen: "menu" | "game";
  mode: Mode;
  biome: number;
  /** 0 sunny, 1 rain, 2 storm, 3 fog, 4 night. */
  weather: number;
  /** Kid Mode is reading a message aloud right now. */
  speaking: boolean;
};

export type AmbienceTarget = {
  /** Index into AMBIENCE_GROUPS, or null for silence. */
  group: number | null;
  /** The loop's gain, 0 to 1. */
  gain: number;
  /** Rain and wind levels, 0 to 1, from the synth. */
  rain: number;
  wind: number;
};

export const SILENT: AmbienceTarget = { group: null, gain: 0, rain: 0, wind: 0 };

export const clampVolume = (v: number) => Math.min(100, Math.max(0, Math.round(Number.isFinite(v) ? v : DEFAULT_VOLUME)));

/** Muted when sound is off, on the menu, in a Tournament (a fair, quiet event) or when the slider is at zero. */
export function ambienceTarget(i: AmbienceInput): AmbienceTarget {
  const vol = clampVolume(i.volume) / 100;
  if (!i.sound || vol <= 0 || i.screen !== "game" || i.mode === "tournament") return SILENT;
  const duck = i.speaking ? DUCK : 1;
  const k = vol * LOOP_CEILING * duck;
  const rain = i.weather === 2 ? 0.9 : i.weather === 1 ? 0.55 : 0;
  const wind = i.weather === 2 ? 0.7 : i.weather === 3 ? 0.3 : 0.08;
  return { group: groupOf(i.biome), gain: k, rain: rain * k, wind: wind * k };
}

/** Do two targets ask for the same sound (so nothing needs to change)? */
export function sameTarget(a: AmbienceTarget, b: AmbienceTarget): boolean {
  const near = (x: number, y: number) => Math.abs(x - y) < 0.002;
  return a.group === b.group && near(a.gain, b.gain) && near(a.rain, b.rain) && near(a.wind, b.wind);
}
