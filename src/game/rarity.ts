/* Rarity shapes and the colour-blind palette (docs/architecture/05 §6.6).

   Colour alone must never be the only sign of rarity. Every rarity has a shape that goes
   wherever its colour goes (badge, dex cell, celebration): common dot, uncommon diamond,
   rare star, epic hexagon, legendary crown. The Settings toggle swaps r1 to r4 for a
   palette that stays apart for deuteranopia (the common grey is unchanged). */

export const RARITY_SHAPES = ["dot", "diamond", "star", "hexagon", "crown"] as const;
export type RarityShape = (typeof RARITY_SHAPES)[number];

/** Kid-readable names for the shapes (screen readers and tooltips). */
export const SHAPE_NAME: Record<RarityShape, string> = {
  dot: "dot",
  diamond: "diamond",
  star: "star",
  hexagon: "hexagon",
  crown: "crown",
};

export const shapeOf = (rarity: number): RarityShape => RARITY_SHAPES[Math.min(4, Math.max(0, Math.round(rarity) || 0))];

/** SVG path data on a 12 by 12 grid, one per shape (filled with the rarity colour). */
export const SHAPE_PATH: Record<RarityShape, string> = {
  dot: "M6 1.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z",
  diamond: "M6 0.8 11.2 6 6 11.2 0.8 6z",
  star: "M6 0.6l1.6 3.5 3.8.4-2.8 2.6.8 3.8L6 9 2.6 10.9l.8-3.8L.6 4.5l3.8-.4z",
  hexagon: "M3.2 1.4h5.6L11.6 6 8.8 10.6H3.2L.4 6z",
  crown: "M1 9.8 0.8 3.6 3.8 6.2 6 2 8.2 6.2 11.2 3.6 11 9.8z",
};

export const NORMAL_COLORS = ["#9bb0b8", "#3dbe86", "#4aa3e8", "#e07a9a", "#e2a23a"] as const;
/** Deuteranopia-safe: teal, blue, orange, yellow stay apart. */
export const CB_COLORS = ["#9bb0b8", "#2a9d8f", "#4a7bd0", "#d08a2e", "#e8c547"] as const;

export const rarityColors = (cb: boolean) => (cb ? CB_COLORS : NORMAL_COLORS);
