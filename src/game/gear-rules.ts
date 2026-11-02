/* Gear progression rules: who may buy what (docs/architecture/10 §2).

   One data table (the constants below) and pure functions. Nothing here touches the store, so the
   Tackle tab, the Waters tab, the engine and the tests all ask the same questions.

   The rules, from the repo owner's feedback:
   - No skipping. To buy a rod you must already own the one before it. Same for reels and boats.
     (Lines are crafted, not bought, so they have their own gates in lines.ts.)
   - Level gates. Every rod, reel, boat, lure pack and map needs a minimum player level.
   - Map gates. A map needs its level AND the previous water's boss beaten.
   - Bundle gates. Each water brings a bundle of rods and reels. Items in it need that water unlocked.
   - Boats skip the map rule: they need a number of different bosses beaten, plus level, plus the boat before.
   - Grandfather. Whatever a save already owns stays owned, even out of order. Rules only decide what you may BUY next.
   - Recreational, Kid Mode and Tournament ignore the gates (gatesOn). Survival has no shop. */

import { BIOMES, BOATS, PACKS, REELS, RODS } from "./content.ts";

export type GateKind = "rod" | "reel" | "boat" | "map" | "pack";

/** Level needed to unlock each water (index = water). The same level opens its bundle of gear. */
export const MAP_LEVEL: readonly number[] = [1, 3, 6, 9, 12, 15, 19, 23, 27, 31, 36, 42, 49, 57, 66];

/** How many rods come with each water's bundle (index = water). Sums to the number of rods (28). */
export const ROD_BUNDLE: readonly number[] = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2];
/** How many reels come with each water's bundle. Sums to the number of reels (14). */
export const REEL_BUNDLE: readonly number[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1];

/** Each later item in a bundle asks for one more level than the one before it. */
export const BUNDLE_STEP = 1;

/** Boats: the level and the number of DIFFERENT bosses beaten that each needs (index = boat). */
export const BOAT_GATE: readonly { lv: number; bosses: number }[] = [
  { lv: 1, bosses: 0 }, // Shore (free)
  { lv: 5, bosses: 1 }, // Jon Boat
  { lv: 10, bosses: 2 }, // Bass Boat
  { lv: 16, bosses: 3 }, // Center Console
  { lv: 24, bosses: 5 }, // Yacht
  { lv: 32, bosses: 7 }, // Research Sub
  { lv: 41, bosses: 9 }, // Airboat
  { lv: 51, bosses: 11 }, // Kelp Skimmer
  { lv: 62, bosses: 13 }, // Astral Skiff
];

/** Lure packs: Basic level 1, Pro level 10, the last pack level 30 (the owner's numbers). */
export const PACK_LEVEL: readonly number[] = [1, 10, 30];

/** The part of a save these rules read. */
export type Progress = {
  lv: number;
  /** Waters unlocked. */
  ub: readonly number[];
  /** Waters whose boss has been beaten. */
  mastered: readonly number[];
  rod: number;
  reel: number;
  boat: number;
};

/** Do the rules apply in this mode? Not in Recreational (everything unlocked), Survival (own gear), Tournament (fixed), or Kid Mode. */
export function gatesOn(mode: { economy: boolean; allUnlocked: boolean }, kid: boolean): boolean {
  return mode.economy && !mode.allUnlocked && !kid;
}

/** The water an item belongs to, and the level it needs. */
export function bundleOf(kind: "rod" | "reel", index: number): { map: number; lv: number } {
  const sizes = kind === "rod" ? ROD_BUNDLE : REEL_BUNDLE;
  let at = 0;
  for (let map = 0; map < sizes.length; map++) {
    if (index < at + sizes[map]) return { map, lv: MAP_LEVEL[map] + (index - at) * BUNDLE_STEP };
    at += sizes[map];
  }
  const map = sizes.length - 1;
  return { map, lv: MAP_LEVEL[map] };
}

/** A check's answer: can it be bought, and if not, the plain sentence saying what is missing. */
export type Check = { ok: boolean; missing: string[]; text: string };

const done: Check = { ok: true, missing: [], text: "" };

/** "reach level 12, unlock the Coast map and beat the Pond boss" → "Reach level 12, unlock …." */
export function say(parts: string[]): string {
  if (!parts.length) return "";
  const p = [...parts];
  const first = p.shift()!;
  const head = first[0].toUpperCase() + first.slice(1);
  if (!p.length) return `${head}.`;
  const last = p.pop()!;
  return `${[head, ...p].join(", ")} and ${last}.`;
}

const bossWord = (n: number) => (n === 1 ? "1 boss" : `${n} bosses`);
const bossOf = (water: number) => `${BIOMES[water].name} boss`;

/** Can this water be unlocked? Level, and the water before it must have had its boss beaten. */
export function checkMap(index: number, p: Pick<Progress, "lv" | "ub" | "mastered">): Check {
  if (index <= 0 || p.ub.includes(index)) return done;
  const missing: string[] = [];
  if (p.lv < MAP_LEVEL[index]) missing.push(`reach level ${MAP_LEVEL[index]}`);
  if (!p.mastered.includes(index - 1)) missing.push(`beat the ${bossOf(index - 1)}`);
  return { ok: !missing.length, missing, text: say(missing) };
}

/** Can the rod or reel at `index` be bought? (Owned items answer ok: nothing is missing.) */
export function checkTackle(kind: "rod" | "reel", index: number, p: Progress): Check {
  const cur = kind === "rod" ? p.rod : p.reel;
  if (index <= cur) return done;
  const { map, lv } = bundleOf(kind, index);
  const missing: string[] = [];
  if (p.lv < lv) missing.push(`reach level ${lv}`);
  if (!p.ub.includes(map)) missing.push(`unlock the ${BIOMES[map].name} map`);
  if (cur < index - 1) {
    const names = kind === "rod" ? RODS : REELS;
    missing.push(`buy the ${names[index - 1].name} first`);
  }
  return { ok: !missing.length, missing, text: say(missing) };
}

/** Can the boat at `index` be bought? Level, enough different bosses, and the boat before. */
export function checkBoat(index: number, p: Progress): Check {
  if (index <= p.boat) return done;
  const gate = BOAT_GATE[index];
  const beaten = new Set(p.mastered).size;
  const missing: string[] = [];
  if (p.lv < gate.lv) missing.push(`reach level ${gate.lv}`);
  if (beaten < gate.bosses) missing.push(`beat ${bossWord(gate.bosses)} (you have beaten ${beaten})`);
  if (p.boat < index - 1) missing.push(`buy the ${BOATS[index - 1].name} first`);
  return { ok: !missing.length, missing, text: say(missing) };
}

/** Can the lure pack at `index` be bought? Only a level. */
export function checkPack(index: number, p: Pick<Progress, "lv">): Check {
  const need = PACK_LEVEL[index] ?? 1;
  if (p.lv >= need) return done;
  const missing = [`reach level ${need}`];
  return { ok: false, missing, text: say(missing) };
}

/** One entry point for the shop. */
export function checkGear(kind: GateKind, index: number, p: Progress): Check {
  switch (kind) {
    case "rod":
    case "reel":
      return checkTackle(kind, index, p);
    case "boat":
      return checkBoat(index, p);
    case "map":
      return checkMap(index, p);
    case "pack":
      return checkPack(index, p);
  }
}

/** The data every gate comes from, as one flat list (the docs table and the tests read this). */
export function gateTable(): { kind: GateKind; index: number; name: string; lv: number; map: number | null; bosses: number }[] {
  const rows: { kind: GateKind; index: number; name: string; lv: number; map: number | null; bosses: number }[] = [];
  BIOMES.forEach((b, i) => rows.push({ kind: "map", index: i, name: b.name, lv: MAP_LEVEL[i], map: null, bosses: i === 0 ? 0 : 1 }));
  RODS.forEach((r, i) => {
    const b = bundleOf("rod", i);
    rows.push({ kind: "rod", index: i, name: r.name, lv: b.lv, map: b.map, bosses: 0 });
  });
  REELS.forEach((r, i) => {
    const b = bundleOf("reel", i);
    rows.push({ kind: "reel", index: i, name: r.name, lv: b.lv, map: b.map, bosses: 0 });
  });
  BOATS.forEach((b, i) => rows.push({ kind: "boat", index: i, name: b.name, lv: BOAT_GATE[i].lv, map: null, bosses: BOAT_GATE[i].bosses }));
  PACKS.forEach((p, i) => rows.push({ kind: "pack", index: i, name: p.name, lv: PACK_LEVEL[i], map: null, bosses: 0 }));
  return rows;
}
