export type DexEntry = { c: number; w: number; m: number };
export type Dex = Record<string, DexEntry>;

export type InvFish = {
  name: string;
  t: number;
  v: number;
  w: number;
  i: number;
  b: number;
  m: number;
};

export type Contract = {
  id: string;
  kind: "count" | "rarity" | "discover" | "bank" | "biome" | "boss";
  goal: number;
  prog: number;
  reward: number;
  label: string;
  minRarity?: number;
  biome?: number;
};

export type Rolled = {
  b: number;
  i: number;
  t: number;
  m: number;
  name: string;
  w: number;
  v: number;
  boss: boolean;
};

export const RARITIES = [
  { id: "common", name: "Common" },
  { id: "uncommon", name: "Uncommon" },
  { id: "rare", name: "Rare" },
  { id: "epic", name: "Epic" },
  { id: "legendary", name: "Legendary" },
] as const;

export const TONE = ["text-r0", "text-r1", "text-r2", "text-r3", "text-r4"] as const;

export const MUTATIONS = [
  { name: "", mult: 1, w: 70 },
  { name: "Albino", mult: 2, w: 15 },
  { name: "Golden", mult: 4, w: 8 },
  { name: "Neon", mult: 8, w: 4 },
  { name: "Rainbow", mult: 20, w: 2 },
  { name: "Cosmic", mult: 60, w: 0.6 },
] as const;

export const WEATHER = [
  { id: "sunny", name: "Sunny", luck: 0, bite: 0 },
  { id: "rain", name: "Rain", luck: 5, bite: 0.25 },
  { id: "storm", name: "Storm", luck: 18, bite: 0.1 },
  { id: "fog", name: "Fog", luck: 10, bite: 0 },
  { id: "night", name: "Night", luck: 12, bite: 0.1 },
] as const;

/* ── Fish archetypes (shared by the catch roller and the canvas artist) ── */

export type Arch =
  | "fish"
  | "eel"
  | "round"
  | "ray"
  | "shark"
  | "whale"
  | "turtle"
  | "squid"
  | "seahorse"
  | "angler"
  | "crab"
  | "jelly";

export function archetypeOf(name: string): Arch {
  if (/jelly/i.test(name)) return "jelly";
  if (/crab|lobster|shrimp/i.test(name)) return "crab";
  if (/seahorse/i.test(name)) return "seahorse";
  if (/angler|lanternfish|viperfish|fangtooth/i.test(name)) return "angler";
  if (/squid|octopus/i.test(name)) return "squid";
  if (/turtle/i.test(name)) return "turtle";
  if (/ray|manta/i.test(name)) return "ray";
  if (/eel|snake|gar|oarfish|leech|serpent|wraith|krait/i.test(name)) return "eel";
  if (/shark/i.test(name)) return "shark";
  if (/frog|blobfish|sea pig/i.test(name)) return "round";
  if (/whale|leviathan|orca|beluga|walrus|hydra|titan|dragon|maw|emperor|constellation/i.test(name))
    return "whale";
  return "fish";
}

/* ── The world: 15 biomes × 25 species ───────────────────────────────────
   Per biome: 9 common (0–8), 7 uncommon (9–15), 5 rare (16–20),
   3 epic (21–23), and the boss at slot 24. */

export const SPECIES_PER_BIOME = 25;
export const BOSS_INDEX = 24;

const FISH: string[][] = [
  // Pond
  "Bluegill,Sunfish,Perch,Minnow,Crawfish,Bullhead,Shiner,Pumpkinseed,Warmouth,Rock Bass,Golden Shiner,Pickerel,Crappie,Largemouth,Koi,White Crappie,Mud Sunfish,Tench,Carp,Gar,Snapper Turtle,Albino Bullhead,Jade Koi,Ghost Koi,Pond King".split(","),
  // River
  "Chub,Dace,Creek Trout,Brown Trout,Rainbow Trout,Brook Trout,Grayling,Whitefish,Logperch,Walleye,Smallmouth,Catfish,Redhorse,Sturgeon,Steelhead,Freshwater Drum,Silver Eel,Salmon,Muskie,Paddlefish,Gator Gar,Golden Muskie,Ghost Steelhead,Cutthroat,River Wraith".split(","),
  // Lake
  "Yellow Perch,Lake Trout,Pike,Burbot,Cisco,Bowfin,Sauger,Splake,White Perch,Lake Herring,Carpsucker,Striper,Hybrid Bass,Flathead,Blue Cat,Silver Bass,Golden Sturgeon,Lake Sturgeon,Longnose Gar,Giant Carp,Arctic Char,Midnight Pike,Ivory Gar,Lunker Bass,Lake Leviathan".split(","),
  // Swamp
  "Mudfish,Bullfrog,Eel,Mosquitofish,Cottonmouth,Crawdad,Loach,Snakehead,Pig Frog,Mudskipper,Bog Perch,Black Crappie,Swamp Cat,Leech King,Bog Turtle,Bayou Perch,Phantom Loach,Alligator,Cypress Gar,Voodoo Eel,Moss Pike,Bog Wraith,Pale Alligator,Hag Fish,Swamp Hydra".split(","),
  // Mangrove (new)
  "Archerfish,Fiddler Crab,Canopy Tetra,Snook Pup,Glassfish,Root Perch,Mud Goby,Leaf Fish,Pygmy Hatchet,Mangrove Jack,Horseshoe Crab,Mud Lobster,Spotted Scat,Root Snapper,Emerald Goby,Tidal Crab,Banded Krait,Silver Moony,Canopy Serpent,Ruby Snapper,Phantom Crab,Golden Archer,Jade Lobster,Elder Horseshoe,The Rootmother".split(","),
  // Coast
  "Mackerel,Sardine,Flounder,Redfish,Snook,Tarpon,Bonito,Pompano,Anchovy,Sea Bass,Halibut,Cobia,Bluefish,Striped Bass,Barracuda,Black Drum,King Mackerel,Mahi Mahi,Tuna,Wahoo,Marlin,Golden Tarpon,Ghost Marlin,Sailfish,Great White".split(","),
  // Canyon (new)
  "Desert Pupfish,Sunbleak,Canyon Minnow,Dust Tetra,Sand Perch,Pebble Dace,Mesa Guppy,Thirst Fish,Cracked Carp,Canyon Carp,Razorback Sucker,Cliff Eel,Dust Koi,Redrock Darter,Mesa Trout,Scorpion Fish,Gila Trout,Vulture Catfish,Golden Sucker,Mirage Koi,Ember Dace,Ancient Sturgeon,Scarred Gar,Sunstone Trout,Old Scarface".split(","),
  // Reef
  "Clownfish,Damselfish,Angelfish,Tang,Butterflyfish,Parrotfish,Lionfish,Grouper,Chromis,Moray,Seahorse,Pufferfish,Triggerfish,Manta Ray,Reef Shark,Firefish,Jewel Moray,Wrasse,Sea Turtle,Mandarin Fish,Leafy Dragon,Prism Turtle,Sunset Dragon,Coral Serpent,Reef Titan".split(","),
  // Kelp Forest (new)
  "Garibaldi,Opaleye,Kelp Crab,Sea Urchin,Kelp Perch,Senorita,Topsmelt,Shiner Perch,Kelp Goby,Kelp Bass,Sheephead,Bat Ray,Leopard Shark Pup,Kelp Greenling,Spiny Lobster,Giant Kelp Fish,White Seabass,Mola Pup,Vermilion Rockfish,Electric Ray,Kelp Serpent,Golden Garibaldi,Jade Sheephead,Elder Bat Ray,The Verdant Maw".split(","),
  // Arctic
  "Capelin,Smelt,Cod,Haddock,Pollock,Herring,Icefish,Lumpfish,Frost Minnow,Wolffish,Polar Cod,Greenland Shark,Narwhal Pup,Beluga,Orca Calf,Ringed Seal,Crystal Cod,Frost Pike,Ice Eel,Glacier Trout,Walrus,Prism Narwhal,Ghost Orca,Aurora Fish,Frost Dragon".split(","),
  // Deep
  "Anglerfish,Lanternfish,Viperfish,Gulper Eel,Hatchetfish,Dumbo Octopus,Fangtooth,Blobfish,Glass Squid,Sea Pig,Oarfish,Vampire Squid,Goblin Shark,Coelacanth,Frilled Shark,Phantom Angler,Black Dragonfish,Giant Squid,Colossal Squid,Megamouth,Abyss Walker,Void Eel,Elder Coelacanth,Kraken Spawn,Leviathan".split(","),
  // Sunken City (new)
  "Relic Tetra,Bronze Guppy,Pilgrim Crab,Tile Fish,Rubble Perch,Statue Goby,Chipped Koi,Forum Minnow,Dusty Dace,Mosaic Carp,Fresco Eel,Coin Koi,Amphora Crab,Marble Guppy,Column Catfish,Vault Crab,Gilded Sturgeon,Fresco Serpent,Jeweled Carp,Sunken Ray,Oracle Eel,Emperor Guppy,Golden Relic,Living Statue,The Marble Emperor".split(","),
  // Volcano
  "Magma Minnow,Ember Perch,Ash Carp,Cinder Eel,Lava Crab,Obsidian Bass,Smoke Trout,Fire Gar,Soot Tetra,Basalt Cat,Pyro Pike,Molten Koi,Sulfur Ray,Flame Betta,Char Shark,Coal Trout,Basalt Serpent,Inferno Marlin,Phoenix Fish,Magma Gator,Volcano Whale,Ember Phoenix,Molten Dragon,Dragon Eel,Ifrit Fin".split(","),
  // Sky
  "Cloud Minnow,Wind Perch,Mist Carp,Rain Trout,Storm Eel,Aero Bass,Zephyr Ray,Thunder Pike,Breeze Tetra,Cirrus Koi,Nimbus Cat,Sun Fish,Moon Fish,Star Ray,Comet Eel,Halo Fish,Tempest Ray,Rainbow Serpent,Celestial Koi,Sky Whale,Aurora Dragon,Eclipse Whale,Nova Dragon,Cosmic Leviathan,Cloud King".split(","),
  // Astral Sea (new)
  "Nebula Minnow,Void Tetra,Singularity Shrimp,Star Dust Fish,Orbit Perch,Moon Moth Fish,Cosmo Guppy,Photon Tetra,Gravity Goby,Quasar Eel,Pulsar Ray,Eclipse Koi,Dark Matter Carp,Comet Shark,Zenith Ray,Astro Crab,Supernova Koi,Event Horizon Eel,Celestial Sturgeon,Void Whale,Starforge Carp,Galaxy Leviathan,Eternal Comet,The First Star,The Last Constellation".split(","),
];

const BIOME_META = [
  ["pond", "Pond", 0],
  ["river", "River", 250],
  ["lake", "Lake", 1000],
  ["swamp", "Swamp", 4000],
  ["mangrove", "Mangrove", 8000],
  ["coast", "Coast", 12000],
  ["canyon", "Canyon", 30000],
  ["reef", "Reef", 40000],
  ["kelp", "Kelp Forest", 90000],
  ["arctic", "Arctic", 120000],
  ["deep", "Deep", 400000],
  ["sunken", "Sunken City", 700000],
  ["volcano", "Volcano", 1_200_000],
  ["sky", "Sky", 4_000_000],
  ["astral", "Astral Sea", 15_000_000],
] as const;

export const BIOMES = BIOME_META.map(([id, name, price], i) => ({
  id,
  name,
  price,
  fish: FISH[i],
}));

export const TOTAL_SPECIES = BIOMES.length * SPECIES_PER_BIOME;

/* ── Gear ladders (extended upward for the new water) ──────────────────── */

const ROD_NAMES =
  "Twig Pole,Bamboo Cane,Starter Spin,Fiberglass Ranger,Tracker Combo,Redhead Graphite,Pro Qualifier,Carbon Elite,Tournament Pro,Titan Surf,Gold Series,Platinum Edge,Mythic Whip,Obsidian Lance,Storm Caller,Neptune's Trident,Dragonbone,Starforged,Void Reaver,Ultra Rod Ω,Rootbound Cane,Canyon Longcast,Kelpweaver,Marble Scepter,Sunken Relic Rod,Frostforge Lance,Void Harpoon,Astral Weaver".split(
    ",",
  );

export const RODS = ROD_NAMES.map((name, i) => ({
  name,
  price: i ? Math.round(60 * 1.75 ** i) : 0,
  zone: 18 + i * 2,
  luck: i * 2.5,
}));

const REEL_NAMES =
  "Rusty Reel,Spincast,Baitcaster,Okuma Pro,Shimano Elite,Abu Garcia Gold,Mag Drive,Titanium Winch,Quantum Reel,Cosmic Spool,Tide Governor,Canyon Drag Pro,Relic Chrono Reel,Astral Spool".split(
    ",",
  );

export const REELS = REEL_NAMES.map((name, i) => ({
  name,
  price: i ? Math.round(150 * 2.4 ** i) : 0,
  speed: i,
}));

const LINE_NAMES =
  "Mono 6lb,Mono 12lb,Braid 20lb,Fluoro 30lb,Braid 50lb,Dyneema 80lb,Titanium Wire,Starthread,Rootfiber 100lb,Kelp Braid 130lb,Relic Chainweave,Starweave Eternal".split(
    ",",
  );

export const LINES = LINE_NAMES.map((name, i) => ({
  name,
  price: i ? Math.round(120 * 3 ** i) : 0,
  hold: 3 + i * 1.5,
}));

const BOAT_NAMES = "Shore,Jon Boat,Bass Boat,Center Console,Yacht,Research Sub,Airboat,Kelp Skimmer,Astral Skiff".split(",");
const BOAT_PRICES = [0, 500, 5000, 40_000, 300_000, 2_000_000, 3_000_000, 9_000_000, 25_000_000];

export const BOATS = BOAT_NAMES.map((name, i) => ({
  name,
  price: BOAT_PRICES[i],
  luck: i * 6,
}));

export const AUTO_PRICE = 25_000;

/* ── Lures: the 50 generated, plus 24 handcrafted signature lures ──────── */

const LURE_TYPES =
  "Spinnerbait,Crankbait,Jig,Spoon,Popper,Swimbait,Jerkbait,Buzzbait,Frog,Worm,Grub,Plug,Topwater,Fly,Softbait,Blade,Squid Rig".split(",");
const LURE_BRANDS = ["Strike King", "Rapala", "Berkley"];

export const LURES = Array.from({ length: 50 }, (_, i) => ({
  name: `${LURE_BRANDS[i % 3]} ${LURE_TYPES[Math.floor(i / 3)]}`,
  luck: i * 1.2 + 1,
  speed: i * 0.5,
}));

export const PACKS = [
  { name: "Basic Pack", price: 100, min: 0, max: 16 },
  { name: "Pro Pack", price: 1200, min: 10, max: 34 },
  { name: "Elite Pack", price: 15000, min: 24, max: 50 },
] as const;

export type SigEffect =
  | { kind: "family"; fam: Arch; mult: number }
  | { kind: "mutation"; mult: number }
  | { kind: "value"; mult: number }
  | { kind: "epic"; mult: number }
  | { kind: "weather"; weather: number; luck: number }
  | { kind: "calm"; speed: number; zone: number }
  | { kind: "bite"; mult: number };

export type SigLure = { name: string; price: number; desc: string; effect: SigEffect };

export const SIG_LURES: SigLure[] = [
  { name: "Eel Whistle", price: 2500, desc: "Eels and eel-kin bite three times as often.", effect: { kind: "family", fam: "eel", mult: 3 } },
  { name: "Ray Charm", price: 2500, desc: "Rays and mantas drift in three times as often.", effect: { kind: "family", fam: "ray", mult: 3 } },
  { name: "Shell Bell", price: 3000, desc: "Turtles come to the bell, three times as often.", effect: { kind: "family", fam: "turtle", mult: 3 } },
  { name: "Shark Tooth Rig", price: 4000, desc: "Sharks smell it three waters away.", effect: { kind: "family", fam: "shark", mult: 3 } },
  { name: "Whale Song Box", price: 6000, desc: "The great ones come to listen — three times as often.", effect: { kind: "family", fam: "whale", mult: 3 } },
  { name: "Crab Trap Charm", price: 3000, desc: "Crabs, lobsters and shrimp can't resist it.", effect: { kind: "family", fam: "crab", mult: 3 } },
  { name: "Squid Lantern", price: 5000, desc: "Squid and octopus rise to the light.", effect: { kind: "family", fam: "squid", mult: 3 } },
  { name: "Seahorse Flute", price: 5000, desc: "A tune only seahorses know.", effect: { kind: "family", fam: "seahorse", mult: 3 } },
  { name: "Jelly Lantern", price: 6500, desc: "Jellies pulse toward the glow.", effect: { kind: "family", fam: "jelly", mult: 3 } },
  { name: "False Lantern", price: 7500, desc: "Anglerfish hunt the hunter's light.", effect: { kind: "family", fam: "angler", mult: 3 } },
  { name: "Prism Spoon", price: 8000, desc: "Mutations twice as likely. The strange love it.", effect: { kind: "mutation", mult: 2 } },
  { name: "Star Spoon", price: 30000, desc: "Mutations three times as likely.", effect: { kind: "mutation", mult: 3 } },
  { name: "Gilded Spoon", price: 12000, desc: "Everything you land is worth 30% more.", effect: { kind: "value", mult: 1.3 } },
  { name: "Ultra Spoon Ω", price: 60000, desc: "Everything you land is worth 60% more.", effect: { kind: "value", mult: 1.6 } },
  { name: "Epic Decoy", price: 15000, desc: "Rare and better fish bite two and a half times as often.", effect: { kind: "epic", mult: 2.5 } },
  { name: "Royal Decoy", price: 45000, desc: "Rare and better fish bite three and a half times as often.", effect: { kind: "epic", mult: 3.5 } },
  { name: "Storm Bell", price: 5000, desc: "+30 luck while the storm is up (+5 otherwise).", effect: { kind: "weather", weather: 2, luck: 30 } },
  { name: "Rain Drum", price: 3500, desc: "+22 luck in the rain (+5 otherwise).", effect: { kind: "weather", weather: 1, luck: 22 } },
  { name: "Fog Horn", price: 4500, desc: "+25 luck in the fog (+5 otherwise).", effect: { kind: "weather", weather: 3, luck: 25 } },
  { name: "Moth Lantern", price: 3500, desc: "+25 luck at night (+5 otherwise).", effect: { kind: "weather", weather: 4, luck: 25 } },
  { name: "Calm Bell", price: 4000, desc: "The reel mark runs a quarter slower. Forgiving water.", effect: { kind: "calm", speed: 0.75, zone: 4 } },
  { name: "Deep Calm Bell", price: 14000, desc: "The reel mark runs 40% slower, and the band widens.", effect: { kind: "calm", speed: 0.6, zone: 7 } },
  { name: "Swift Bell", price: 4000, desc: "Fish bite 30% sooner.", effect: { kind: "bite", mult: 0.7 } },
  { name: "Hunter's Drum", price: 9000, desc: "Fish bite 45% sooner.", effect: { kind: "bite", mult: 0.55 } },
];

export function sigEffect(sig: number): SigEffect | null {
  return sig >= 0 && SIG_LURES[sig] ? SIG_LURES[sig].effect : null;
}

/* ── Bait: consumables for the new bait slot ───────────────────────────── */

export const BAITS = [
  { name: "Dough Ball", price: 15, desc: "Bites come 15% sooner." },
  { name: "Glow Worm", price: 60, desc: "Mutations 25% more likely on this cast." },
  { name: "Chum Bucket", price: 240, desc: "Rare and better fish bite 60% more often." },
  { name: "Boss Chum", price: 0, desc: "Wakes the boss in its Lair. One per attempt. Priced by the water." },
] as const;

export const BOSS_CHUM_INDEX = 3;

export function bossChumPrice(biome: number) {
  return Math.round(300 * 2.1 ** biome);
}

/* ── Stages inside every biome ─────────────────────────────────────────── */

export const STAGE_NAMES = ["The Shallows", "Open Water", "The Deep Run", "Boss Lair"] as const;

/** Species caught in a biome, not counting the boss (slot 24). */
export function biomeSpeciesCaught(dex: Dex, b: number) {
  let n = 0;
  for (let i = 0; i < BOSS_INDEX; i++) if (dex[`${b}-${i}`]?.c) n++;
  return n;
}

export function biomeDexCount(dex: Dex, b: number) {
  let n = 0;
  for (let i = 0; i < SPECIES_PER_BIOME; i++) if (dex[`${b}-${i}`]?.c) n++;
  return n;
}

/** 0 Shallows · 1 Open Water (9) · 2 Deep Run (17) · 3 Boss Lair (all 24 others). */
export function stageOf(dex: Dex, b: number) {
  const n = biomeSpeciesCaught(dex, b);
  if (n >= BOSS_INDEX) return 3;
  if (n >= 17) return 2;
  if (n >= 9) return 1;
  return 0;
}

/** Highest species index a normal cast can roll at a stage. */
export function stageCap(stage: number) {
  return stage <= 0 ? 15 : BOSS_INDEX - 1;
}

/* ── The Aquarium ──────────────────────────────────────────────────────── */

export const TANK_TIERS = [
  { name: "Glass Tank", slots: 12, capHours: 8, price: 0 },
  { name: "Panoramic Tank", slots: 24, capHours: 16, price: 25_000 },
  { name: "Grand Dome", slots: 40, capHours: 24, price: 250_000 },
] as const;

export const GIFT_PRICES = [10_000, 50_000, 200_000];
export const LIGHT_PRICE = 15_000;
export const SHOWCASE_SLOTS = 3;
/** Exhibits pay this share of their value per hour. */
export const TANK_RATE = 0.015;

export function baseWeight(b: number, i: number) {
  const t = rarityOf(i);
  return (0.4 + i * 0.55 + t * 3) * (1 + b * 0.5);
}

export function baseValue(b: number, i: number) {
  const t = rarityOf(i);
  return Math.round((3 + i * i * 0.45 + t * 15) * 2.1 ** b);
}

/** What one exhibited species is worth in the glass: its best specimen's
    sale value, lifted by its mutation and a size bonus for record fish. */
export function exhibitValue(entry: DexEntry, b: number, i: number) {
  const mut = MUTATIONS[entry.m]?.mult ?? 1;
  const sizeBonus = 1 + Math.min(0.75, entry.w / Math.max(1, baseWeight(b, i) * 1.6)) * 0.5;
  return Math.round(baseValue(b, i) * mut * sizeBonus);
}

export type TankState = {
  tier: number;
  gift: number;
  lights: number[];
  exhibits: string[];
  ped: string[];
  feedUntil: number;
  lastSettle: number;
};

export function tankRatePerHour(tank: TankState, dex: Dex, now: number) {
  const giftMult = 1 + tank.gift * 0.25;
  const feedMult = now < tank.feedUntil ? 1.5 : 1;
  let sum = 0;
  for (const key of tank.exhibits) {
    const [b, i] = key.split("-").map(Number);
    const entry = dex[key];
    if (!entry) continue;
    let v = exhibitValue(entry, b, i);
    if (tank.ped.includes(key)) v *= 3;
    if (tank.lights.includes(b)) v *= 1.5;
    sum += v;
  }
  return sum * TANK_RATE * giftMult * feedMult;
}

export function tankExhibitValue(tank: TankState, dex: Dex) {
  let sum = 0;
  for (const key of tank.exhibits) {
    const [b, i] = key.split("-").map(Number);
    const entry = dex[key];
    if (entry) sum += exhibitValue(entry, b, i);
  }
  return sum;
}

/* ── Core helpers ──────────────────────────────────────────────────────── */

export const GEAR = {
  rod: RODS,
  reel: REELS,
  line: LINES,
  boat: BOATS,
} as const;

export type GearKind = keyof typeof GEAR;

export function rarityOf(i: number) {
  return i < 9 ? 0 : i < 16 ? 1 : i < 21 ? 2 : i < 24 ? 3 : 4;
}

export function xpNeed(lv: number) {
  return Math.floor(40 * lv ** 1.6);
}

export function dexCount(dex: Dex) {
  let n = 0;
  for (const k in dex) if (dex[k]?.c) n++;
  return n;
}

export function multOf(dex: Dex, rb: number) {
  return 1 + dexCount(dex) * 0.01 + rb * 0.5;
}

type LuckInput = {
  rod: number;
  boat: number;
  weather: number;
  lv: number;
  rb: number;
  dex: Dex;
  biome?: number;
  mastered?: number[];
  sig?: number;
};

export function luckTotal(s: LuckInput, lure: number) {
  const lureLuck = lure >= 0 ? LURES[lure].luck : 0;
  let sigLuck = 0;
  const fx = typeof s.sig === "number" ? sigEffect(s.sig) : null;
  if (fx?.kind === "weather") sigLuck = s.weather === fx.weather ? fx.luck : 5;
  const masteredLuck =
    typeof s.biome === "number" && Array.isArray(s.mastered) && s.mastered.includes(s.biome) ? 10 : 0;
  return (
    RODS[s.rod].luck +
    BOATS[s.boat].luck +
    lureLuck +
    WEATHER[s.weather].luck +
    s.lv * 0.4 +
    s.rb * 10 +
    dexCount(s.dex) * 0.1 +
    sigLuck +
    masteredLuck
  );
}

export function rankName(lv: number) {
  if (lv >= 100) return "Ultra";
  if (lv >= 70) return "Leviathan";
  if (lv >= 50) return "Storm Angler";
  if (lv >= 35) return "Reef Warden";
  if (lv >= 20) return "Tide Caller";
  if (lv >= 10) return "Skiff Hand";
  if (lv >= 5) return "Bank Walker";
  return "Dockhand";
}

export function fmt(n: number) {
  const v = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (v >= 1e9) return sign + (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return sign + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e4) return sign + (v / 1e3).toFixed(1) + "K";
  return sign + String(Math.floor(v));
}

export function money(n: number) {
  return "$" + fmt(n);
}

export function compact(n: number) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function pickWeighted(weights: number[]) {
  let sum = 0;
  for (const w of weights) sum += w;
  let r = Math.random() * sum;
  let i = 0;
  while (i < weights.length - 1 && r > weights[i]) {
    r -= weights[i];
    i++;
  }
  return i;
}

export type RollOptions = {
  /** Roll the biome boss (slot 24) — Boss Lair casts only. */
  boss?: boolean;
  /** Current stage in the biome; caps and weights the table. */
  stage?: number;
  /** Equipped signature lure effect, if any. */
  sig?: SigEffect | null;
  /** Equipped bait index, or -1. */
  bait?: number;
};

export function rollFish(biome: number, luck: number, opts: RollOptions = {}): Rolled {
  const boss = !!opts.boss;
  const stage = opts.stage ?? 3;
  const sig = opts.sig ?? null;
  const bait = opts.bait ?? -1;
  const k = Math.max(0.04, 0.36 / (1 + luck / 30));
  let i: number;
  if (boss) {
    i = BOSS_INDEX;
  } else {
    const cap = stageCap(stage);
    const weights = Array.from({ length: SPECIES_PER_BIOME }, (_, n) => {
      if (n > cap || n === BOSS_INDEX) return 0;
      let w = Math.exp(-k * n);
      if (sig?.kind === "family" && archetypeOf(BIOMES[biome].fish[n]) === sig.fam) w *= sig.mult;
      if (sig?.kind === "epic" && n >= 16) w *= sig.mult;
      if (bait === 2 && n >= 16) w *= 1.6;
      if (stage === 2 && n >= 21) w *= 1.8;
      return w;
    });
    i = pickWeighted(weights);
  }
  const mw = MUTATIONS.map((x, j) => {
    if (!j) return x.w;
    let w = x.w * (1 + luck / 50);
    if (sig?.kind === "mutation") w *= sig.mult;
    if (bait === 1) w *= 1.25;
    return w;
  });
  const m = pickWeighted(mw);
  const t = rarityOf(i);
  let w = +((0.4 + i * 0.55 + t * 3) * (1 + biome * 0.5) * (0.5 + Math.random() * 1.1)).toFixed(1);
  let v = Math.round((3 + i * i * 0.45 + t * 15) * 2.1 ** biome * (0.8 + Math.random() * 0.4) * MUTATIONS[m].mult);
  if (sig?.kind === "value") v = Math.round(v * sig.mult);
  if (boss) {
    w = +(w * 1.6).toFixed(1);
    v = Math.round(v * 4);
  }
  const species = BIOMES[biome].fish[i];
  const prefix = MUTATIONS[m].name;
  const name = prefix ? `${prefix} ${species}` : species;
  return { b: biome, i, t, m, name, w, v, boss };
}
