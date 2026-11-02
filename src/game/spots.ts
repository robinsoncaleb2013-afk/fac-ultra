/* Named cast targets on every painting (docs/architecture/04 §2).

   A spot is a place the player can aim at: the lily pads, the drop-off, under
   the dock. Each has a structure (what the fish relate to) and a depth, and the
   species that live in the water decide for themselves which structures they
   like (habits.ts). Coordinates are fractions of the stage, read off the
   1600 px paintings with a 10% grid laid over them. */

import { waterLineOf } from "./water.ts";

export type Structure =
  | "weeds"
  | "dock"
  | "dropoff"
  | "rocks"
  | "current"
  | "open"
  | "shade"
  | "timber"
  | "reef"
  | "wreck"
  | "ice"
  | "vent"
  | "cloud"
  | "void";

export type Spot = {
  /** "pond-pads" */
  id: string;
  /** "The Lily Pads" */
  name: string;
  /** Normalised cast target on the painting (0–1); lies below the waterline. */
  x: number;
  y: number;
  /** Tap radius, normalised to the stage width (0.06–0.10). */
  r: number;
  structure: Structure;
  /** 0 shallow · 1 middle · 2 deep */
  depth: 0 | 1 | 2;
  /** One line for the dex and the hover label. Plain English. */
  tip: string;
};

export const STRUCTURE_NAME: Record<Structure, { label: string; plural: string }> = {
  weeds: { label: "weeds", plural: "weeds" },
  dock: { label: "dock", plural: "docks" },
  dropoff: { label: "drop-off", plural: "drop-offs" },
  rocks: { label: "rocks", plural: "rocks" },
  current: { label: "current", plural: "fast water" },
  open: { label: "open water", plural: "open water" },
  shade: { label: "shade", plural: "shade" },
  timber: { label: "timber", plural: "logs and roots" },
  reef: { label: "reef", plural: "coral" },
  wreck: { label: "wreck", plural: "wrecks and ruins" },
  ice: { label: "ice", plural: "ice edges" },
  vent: { label: "vent", plural: "warm vents" },
  cloud: { label: "cloud bank", plural: "cloud banks" },
  void: { label: "void", plural: "the dark void" },
};

type Row = [
  id: string,
  name: string,
  x: number,
  y: number,
  r: number,
  structure: Structure,
  depth: 0 | 1 | 2,
  tip: string,
];

function spot(row: Row): Spot {
  const [id, name, x, y, r, structure, depth, tip] = row;
  return { id, name, x, y, r, structure, depth, tip };
}

/* 15 waters × 5 spots = 75. The first "open" spot in each water is its default. */
const ROWS: Row[][] = [
  // 0 Pond
  [
    [
      "pond-open",
      "Open Water",
      0.3,
      0.66,
      0.09,
      "open",
      1,
      "Wide and quiet. Fish pass through here all day.",
    ],
    [
      "pond-pads",
      "The Lily Pads",
      0.52,
      0.76,
      0.08,
      "weeds",
      0,
      "Bass and bluegill hide under the pads, waiting for a snack.",
    ],
    [
      "pond-dock",
      "Under the Dock",
      0.8,
      0.7,
      0.08,
      "dock",
      1,
      "The dock throws shade, and fish love shade.",
    ],
    [
      "pond-shade",
      "Willow Shade",
      0.42,
      0.58,
      0.07,
      "shade",
      0,
      "Cool water under the old willow. Good at midday.",
    ],
    [
      "pond-hole",
      "The Deep Hole",
      0.3,
      0.85,
      0.07,
      "dropoff",
      2,
      "The bottom drops away here. Big fish rest down deep.",
    ],
  ],
  // 1 River
  [
    ["river-run", "The Open Run", 0.55, 0.6, 0.09, "open", 1, "A smooth stretch above the rapids."],
    [
      "river-rapids",
      "The Rapids",
      0.46,
      0.82,
      0.08,
      "current",
      0,
      "Fast, bubbly water. Fish wait at the edges for food to wash by.",
    ],
    [
      "river-boulders",
      "Big Boulders",
      0.14,
      0.72,
      0.08,
      "rocks",
      1,
      "Fish tuck in behind the rocks, out of the current.",
    ],
    [
      "river-dock",
      "The Old Dock",
      0.86,
      0.68,
      0.07,
      "dock",
      0,
      "Shady and still, right beside the rushing water.",
    ],
    [
      "river-plunge",
      "The Plunge Pool",
      0.7,
      0.8,
      0.07,
      "dropoff",
      2,
      "A deep pool where the river slows down and rests.",
    ],
  ],
  // 2 Lake
  [
    [
      "lake-open",
      "Open Lake",
      0.3,
      0.66,
      0.1,
      "open",
      1,
      "Miles of clear water. Cast far and wait.",
    ],
    [
      "lake-dock",
      "The Long Dock",
      0.8,
      0.68,
      0.08,
      "dock",
      0,
      "Fish cruise along the dock looking for a bite.",
    ],
    [
      "lake-weeds",
      "The Weed Flat",
      0.14,
      0.58,
      0.08,
      "weeds",
      0,
      "Thick green weeds are a fish hotel.",
    ],
    [
      "lake-point",
      "Rocky Point",
      0.92,
      0.85,
      0.07,
      "rocks",
      1,
      "Rocks warm up in the sun and the fish come to match.",
    ],
    [
      "lake-drop",
      "The Drop-Off",
      0.45,
      0.83,
      0.08,
      "dropoff",
      2,
      "The shelf falls into deep, cold water.",
    ],
  ],
  // 3 Swamp
  [
    [
      "swamp-open",
      "Black Water",
      0.42,
      0.62,
      0.09,
      "open",
      1,
      "Dark, still water. Something is watching.",
    ],
    [
      "swamp-knees",
      "Cypress Knees",
      0.38,
      0.78,
      0.07,
      "timber",
      0,
      "Knobby roots poke up from the mud. Fish hide in every gap.",
    ],
    [
      "swamp-shade",
      "Mossy Shade",
      0.17,
      0.66,
      0.07,
      "shade",
      1,
      "Hanging moss makes a cool, dark hideout.",
    ],
    [
      "swamp-walk",
      "The Old Boardwalk",
      0.88,
      0.78,
      0.07,
      "dock",
      0,
      "Fish nap under the broken boards.",
    ],
    [
      "swamp-hole",
      "The Dark Hole",
      0.6,
      0.86,
      0.07,
      "dropoff",
      2,
      "Nobody knows how deep it goes.",
    ],
  ],
  // 4 Mangrove
  [
    [
      "mangrove-open",
      "Quiet Channel",
      0.25,
      0.78,
      0.09,
      "open",
      1,
      "A calm lane between the trees.",
    ],
    [
      "mangrove-roots",
      "The Tangled Roots",
      0.55,
      0.62,
      0.08,
      "timber",
      0,
      "A maze of roots. Small fish hide, big fish hunt.",
    ],
    [
      "mangrove-canopy",
      "Under the Canopy",
      0.3,
      0.58,
      0.07,
      "shade",
      1,
      "Green shade all day long.",
    ],
    [
      "mangrove-creek",
      "The Tide Creek",
      0.76,
      0.8,
      0.07,
      "current",
      1,
      "When the tide moves, the fish line up and eat.",
    ],
    [
      "mangrove-deep",
      "The Deep Channel",
      0.45,
      0.85,
      0.07,
      "dropoff",
      2,
      "The deepest water in the mangroves.",
    ],
  ],
  // 5 Coast
  [
    ["coast-open", "Open Surf", 0.3, 0.54, 0.09, "open", 1, "Waves roll in. Fish follow the bait."],
    [
      "coast-pier",
      "The Pier",
      0.8,
      0.54,
      0.07,
      "dock",
      1,
      "Little fish hide in the pilings. Big fish hunt them.",
    ],
    [
      "coast-trough",
      "The Surf Trough",
      0.48,
      0.6,
      0.07,
      "current",
      0,
      "A channel where the waves pull back out.",
    ],
    [
      "coast-drop",
      "The Blue Drop",
      0.1,
      0.5,
      0.07,
      "dropoff",
      2,
      "The water turns dark blue where the bottom falls away.",
    ],
    [
      "coast-rocks",
      "Offshore Rocks",
      0.58,
      0.5,
      0.06,
      "rocks",
      1,
      "Crabs live here, and fish come for the crabs.",
    ],
  ],
  // 6 Canyon
  [
    [
      "canyon-open",
      "The Wide Bend",
      0.52,
      0.8,
      0.09,
      "open",
      1,
      "The river slows and spreads out between the red walls.",
    ],
    [
      "canyon-riffle",
      "The Riffle",
      0.22,
      0.67,
      0.07,
      "current",
      0,
      "Shallow, sparkling water over pebbles.",
    ],
    [
      "canyon-shade",
      "Cottonwood Shade",
      0.4,
      0.62,
      0.07,
      "shade",
      1,
      "The only shade for miles. Fish know it.",
    ],
    [
      "canyon-hole",
      "The Blue Hole",
      0.66,
      0.76,
      0.07,
      "dropoff",
      2,
      "A deep, cool pool right in the desert.",
    ],
    [
      "canyon-rocks",
      "Boulder Bar",
      0.85,
      0.7,
      0.07,
      "rocks",
      1,
      "Fallen rocks make little hiding rooms.",
    ],
  ],
  // 7 Reef
  [
    ["reef-lagoon", "The Lagoon", 0.4, 0.5, 0.09, "open", 1, "Warm, clear and calm."],
    [
      "reef-heads",
      "Coral Heads",
      0.45,
      0.74,
      0.08,
      "reef",
      0,
      "Colourful coral. Every crack has a fish in it.",
    ],
    [
      "reef-dock",
      "The Palm Dock",
      0.82,
      0.62,
      0.07,
      "dock",
      0,
      "Fish gather in the shade of the dock.",
    ],
    [
      "reef-wall",
      "The Blue Wall",
      0.15,
      0.6,
      0.07,
      "dropoff",
      2,
      "The reef ends and the deep ocean begins.",
    ],
    ["reef-rocks", "Black Rocks", 0.9, 0.84, 0.06, "rocks", 1, "Dark rocks with little caves."],
  ],
  // 8 Kelp Forest
  [
    [
      "kelp-open",
      "Open Blue",
      0.5,
      0.42,
      0.09,
      "open",
      1,
      "A clear lane between the kelp. Fish swim through in schools.",
    ],
    [
      "kelp-top",
      "Top of the Kelp",
      0.15,
      0.3,
      0.08,
      "weeds",
      0,
      "The golden leaves reach for the sunlight.",
    ],
    [
      "kelp-garden",
      "The Rock Garden",
      0.45,
      0.82,
      0.08,
      "rocks",
      2,
      "Crabs and lobsters live on the bottom.",
    ],
    [
      "kelp-canopy",
      "Under the Canopy",
      0.72,
      0.6,
      0.07,
      "shade",
      1,
      "Dim and cool under the thick kelp.",
    ],
    [
      "kelp-surge",
      "The Surge",
      0.86,
      0.42,
      0.07,
      "current",
      1,
      "The kelp sways when the water moves.",
    ],
  ],
  // 9 Arctic
  [
    [
      "arctic-leads",
      "Open Leads",
      0.28,
      0.62,
      0.09,
      "open",
      1,
      "Dark water between the ice. Fish come up for air and food.",
    ],
    [
      "arctic-edge",
      "The Ice Edge",
      0.55,
      0.64,
      0.08,
      "ice",
      0,
      "Fish hunt along the edge where ice meets water.",
    ],
    ["arctic-pier", "The Frozen Pier", 0.82, 0.72, 0.07, "dock", 1, "Old posts coated in snow."],
    ["arctic-fjord", "The Deep Fjord", 0.4, 0.82, 0.07, "dropoff", 2, "Cold, dark and very deep."],
    [
      "arctic-floes",
      "The Floe Field",
      0.14,
      0.78,
      0.07,
      "ice",
      0,
      "Chunks of ice float overhead. Fish hide below.",
    ],
  ],
  // 10 Deep
  [
    [
      "deep-moon",
      "Moonlit Water",
      0.3,
      0.4,
      0.09,
      "open",
      1,
      "The moon makes a silver road on the water.",
    ],
    [
      "deep-pier",
      "The Lantern Pier",
      0.72,
      0.62,
      0.07,
      "dock",
      0,
      "The lantern draws little fish, and little fish draw big ones.",
    ],
    ["deep-glow", "The Glow Field", 0.45, 0.8, 0.08, "vent", 2, "Tiny lights glitter far below."],
    [
      "deep-drop",
      "The Black Drop",
      0.18,
      0.72,
      0.07,
      "dropoff",
      2,
      "Where the light stops and the dark begins.",
    ],
    ["deep-wreck", "The Rusty Wreck", 0.86, 0.82, 0.06, "wreck", 1, "An old ship, long asleep."],
  ],
  // 11 Sunken City
  [
    [
      "sunken-square",
      "The Clear Square",
      0.4,
      0.55,
      0.09,
      "open",
      1,
      "An old plaza, swept clean by the current.",
    ],
    [
      "sunken-columns",
      "The Fallen Columns",
      0.14,
      0.48,
      0.07,
      "wreck",
      1,
      "Broken pillars lie where they fell.",
    ],
    [
      "sunken-coral",
      "The Coral Gardens",
      0.9,
      0.52,
      0.07,
      "reef",
      0,
      "Coral has grown over the old walls.",
    ],
    [
      "sunken-mosaic",
      "The Mosaic Floor",
      0.52,
      0.84,
      0.08,
      "rocks",
      2,
      "A tiled floor, still bright after a thousand years.",
    ],
    [
      "sunken-arch",
      "Under the Arch",
      0.68,
      0.42,
      0.07,
      "shade",
      0,
      "A stone arch makes a shady doorway.",
    ],
  ],
  // 12 Volcano
  [
    [
      "volcano-bay",
      "The Dark Bay",
      0.25,
      0.62,
      0.09,
      "open",
      1,
      "Black water, glowing at the edges.",
    ],
    [
      "volcano-edge",
      "The Lava Edge",
      0.5,
      0.58,
      0.07,
      "vent",
      0,
      "Lava meets the sea in clouds of steam. Fish love the warmth.",
    ],
    [
      "volcano-shallows",
      "The Ember Shallows",
      0.36,
      0.78,
      0.07,
      "current",
      1,
      "The water shimmers orange and red.",
    ],
    [
      "volcano-rocks",
      "The Black Rocks",
      0.63,
      0.74,
      0.06,
      "rocks",
      1,
      "Hard black rock, still warm.",
    ],
    [
      "volcano-trench",
      "The Fire Trench",
      0.12,
      0.82,
      0.07,
      "dropoff",
      2,
      "A deep crack in the sea floor.",
    ],
  ],
  // 13 Sky
  [
    ["sky-open", "Open Sky", 0.3, 0.68, 0.09, "open", 1, "A sea of soft clouds."],
    [
      "sky-bank",
      "The Cloud Bank",
      0.14,
      0.78,
      0.08,
      "cloud",
      0,
      "Fluffy and warm. Fish nibble along the edges.",
    ],
    [
      "sky-terrace",
      "Under the Terrace",
      0.72,
      0.8,
      0.08,
      "dock",
      0,
      "The marble terrace makes a long shadow.",
    ],
    ["sky-storm", "The Storm Cell", 0.55, 0.85, 0.07, "cloud", 2, "A dark thundercloud far below."],
    [
      "sky-gap",
      "The Wind Gap",
      0.5,
      0.66,
      0.07,
      "current",
      1,
      "Wind rushes through here and carries food.",
    ],
  ],
  // 14 Astral Sea
  [
    [
      "astral-open",
      "Starlit Water",
      0.42,
      0.66,
      0.09,
      "open",
      1,
      "The stars shine up out of the water.",
    ],
    [
      "astral-fall",
      "The Starfall",
      0.2,
      0.74,
      0.08,
      "current",
      0,
      "Glittering water pours down from the floating island.",
    ],
    [
      "astral-isles",
      "Under the Isles",
      0.64,
      0.62,
      0.07,
      "shade",
      1,
      "Floating islands cast cool, purple shadows.",
    ],
    [
      "astral-void",
      "The Void Below",
      0.5,
      0.85,
      0.07,
      "void",
      2,
      "Nothing is down there. Almost nothing.",
    ],
    [
      "astral-vent",
      "Stardust Vent",
      0.86,
      0.76,
      0.07,
      "vent",
      1,
      "Stardust bubbles up from far below.",
    ],
  ],
];

export const SPOTS: Spot[][] = ROWS.map((rows) => rows.map(spot));

export const SPOT_COUNT = SPOTS.reduce((n, list) => n + list.length, 0);

export function spotsOf(biome: number): Spot[] {
  return SPOTS[biome] ?? SPOTS[0];
}

/** The default cast target: the first open-water spot (04 §2.2). */
export function defaultSpot(biome: number): Spot {
  const list = spotsOf(biome);
  return list.find((s) => s.structure === "open") ?? list[0];
}

export function spotById(biome: number, id: string | undefined): Spot | undefined {
  return id ? spotsOf(biome).find((s) => s.id === id) : undefined;
}

/** A remembered spot id, or the water's default if it is unknown (bad save, renamed spot). */
export function resolveSpot(biome: number, id: string | undefined): Spot {
  return spotById(biome, id) ?? defaultSpot(biome);
}

/** Distinct structures present in a water, in the order they first appear. */
export function biomeStructures(biome: number): Structure[] {
  const out: Structure[] = [];
  for (const s of spotsOf(biome)) if (!out.includes(s.structure)) out.push(s.structure);
  return out;
}

/** Radius in CSS px of a spot's tap area. On touch screens never smaller than 22 px (a 44 px target). */
export function spotRadiusPx(spot: Spot, stageWidth: number, touch: boolean): number {
  const r = spot.r * stageWidth;
  return touch ? Math.max(22, r) : r;
}

/** The ring that is DRAWN (smaller than the tap area so rings do not crowd the painting). */
export function spotRingPx(spot: Spot, stageWidth: number, touch: boolean): number {
  return touch ? Math.max(22, spot.r * stageWidth * 0.5) : Math.max(14, spot.r * stageWidth * 0.45);
}

/** The spot under a point (normalised 0–1 on a stage `w × h` px), or null. The nearest wins
    when tap areas overlap. */
export function nearestSpot(
  biome: number,
  nx: number,
  ny: number,
  w: number,
  h: number,
  touch: boolean,
): Spot | null {
  let best: Spot | null = null;
  let bestD = Infinity;
  for (const s of spotsOf(biome)) {
    const dx = (nx - s.x) * w;
    const dy = (ny - s.y) * h;
    const d = Math.hypot(dx, dy);
    if (d <= spotRadiusPx(s, w, touch) && d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** Re-exported so tests can check every spot lies on the water. */
export function waterTop(biome: number): number {
  return waterLineOf(biome);
}
