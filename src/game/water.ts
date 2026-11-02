/* Where the water starts in each painting, and where its light comes from.
   Index = biome index (see BIOMES in content.ts). Values are fractions of the
   stage: WATER_LINE is the y of the waterline (0 top .. 1 bottom), SUN_X is the
   x the light falls from.
   UNVERIFIED: chosen by eye from the biome descriptions, not by looking at the
   paintings. Underwater scenes (reef, kelp, deep, sunken) use a high line so
   the shimmer covers most of the picture. Tune after a human looks. */

export const WATER_LINE: number[] = [
  0.52, // Pond
  0.5, // River
  0.48, // Lake
  0.5, // Swamp
  0.52, // Mangrove
  0.46, // Coast
  0.5, // Canyon
  0.2, // Reef
  0.16, // Kelp Forest
  0.5, // Arctic
  0.1, // Deep
  0.2, // Sunken City
  0.55, // Volcano
  0.6, // Sky
  0.5, // Astral Sea
];

export const SUN_X: number[] = [
  0.7, // Pond
  0.3, // River
  0.65, // Lake
  0.4, // Swamp
  0.6, // Mangrove
  0.75, // Coast
  0.55, // Canyon
  0.5, // Reef
  0.5, // Kelp Forest
  0.35, // Arctic
  0.5, // Deep
  0.45, // Sunken City
  0.5, // Volcano
  0.6, // Sky
  0.5, // Astral Sea
];

export function waterLineOf(biome: number): number {
  return WATER_LINE[biome] ?? 0.5;
}

export function sunXOf(biome: number): number {
  return SUN_X[biome] ?? 0.5;
}
