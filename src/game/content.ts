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

const FISH: string[][] = [
  "Bluegill,Sunfish,Perch,Minnow,Crawfish,Bullhead,Shiner,Pumpkinseed,Rock Bass,Golden Shiner,Pickerel,Crappie,Largemouth,Koi,Tench,Carp,Gar,Snapper Turtle,Ghost Koi,Pond King".split(","),
  "Chub,Dace,Creek Trout,Brown Trout,Rainbow Trout,Brook Trout,Grayling,Whitefish,Walleye,Smallmouth,Catfish,Redhorse,Sturgeon,Steelhead,Salmon,Muskie,Paddlefish,Gator Gar,Cutthroat,River Wraith".split(","),
  "Yellow Perch,Lake Trout,Pike,Burbot,Cisco,Bowfin,Sauger,Splake,Lake Herring,Carpsucker,Striper,Hybrid Bass,Flathead,Blue Cat,Lake Sturgeon,Longnose Gar,Giant Carp,Arctic Char,Lunker Bass,Lake Leviathan".split(","),
  "Mudfish,Bullfrog,Eel,Mosquitofish,Cottonmouth,Crawdad,Loach,Snakehead,Mudskipper,Bog Perch,Black Crappie,Swamp Cat,Leech King,Bog Turtle,Alligator,Cypress Gar,Voodoo Eel,Moss Pike,Hag Fish,Swamp Hydra".split(","),
  "Mackerel,Sardine,Flounder,Redfish,Snook,Tarpon,Bonito,Pompano,Sea Bass,Halibut,Cobia,Bluefish,Striped Bass,Barracuda,Mahi Mahi,Tuna,Wahoo,Marlin,Sailfish,Great White".split(","),
  "Clownfish,Damselfish,Angelfish,Tang,Butterflyfish,Parrotfish,Lionfish,Grouper,Moray,Seahorse,Pufferfish,Triggerfish,Manta Ray,Reef Shark,Wrasse,Sea Turtle,Mandarin Fish,Leafy Dragon,Coral Serpent,Reef Titan".split(","),
  "Capelin,Smelt,Cod,Haddock,Pollock,Herring,Icefish,Lumpfish,Wolffish,Polar Cod,Greenland Shark,Narwhal Pup,Beluga,Orca Calf,Frost Pike,Ice Eel,Glacier Trout,Walrus,Aurora Fish,Frost Dragon".split(","),
  "Anglerfish,Lanternfish,Viperfish,Gulper Eel,Hatchetfish,Dumbo Octopus,Fangtooth,Blobfish,Sea Pig,Oarfish,Vampire Squid,Goblin Shark,Coelacanth,Frilled Shark,Giant Squid,Colossal Squid,Megamouth,Abyss Walker,Kraken Spawn,Leviathan".split(","),
  "Magma Minnow,Ember Perch,Ash Carp,Cinder Eel,Lava Crab,Obsidian Bass,Smoke Trout,Fire Gar,Basalt Cat,Pyro Pike,Molten Koi,Sulfur Ray,Flame Betta,Char Shark,Inferno Marlin,Phoenix Fish,Magma Gator,Volcano Whale,Dragon Eel,Ifrit Fin".split(","),
  "Cloud Minnow,Wind Perch,Mist Carp,Rain Trout,Storm Eel,Aero Bass,Zephyr Ray,Thunder Pike,Cirrus Koi,Nimbus Cat,Sun Fish,Moon Fish,Star Ray,Comet Eel,Rainbow Serpent,Celestial Koi,Sky Whale,Aurora Dragon,Cosmic Leviathan,Cloud King".split(","),
];

const BIOME_META = [
  ["pond", "Pond", 0],
  ["river", "River", 250],
  ["lake", "Lake", 1000],
  ["swamp", "Swamp", 4000],
  ["coast", "Coast", 12000],
  ["reef", "Reef", 40000],
  ["arctic", "Arctic", 120000],
  ["deep", "Deep", 400000],
  ["volcano", "Volcano", 1_200_000],
  ["sky", "Sky", 4_000_000],
] as const;

export const BIOMES = BIOME_META.map(([id, name, price], i) => ({
  id,
  name,
  price,
  fish: FISH[i],
}));

const ROD_NAMES =
  "Twig Pole,Bamboo Cane,Starter Spin,Fiberglass Ranger,Tracker Combo,Redhead Graphite,Pro Qualifier,Carbon Elite,Tournament Pro,Titan Surf,Gold Series,Platinum Edge,Mythic Whip,Obsidian Lance,Storm Caller,Neptune's Trident,Dragonbone,Starforged,Void Reaver,Ultra Rod Ω".split(",");

export const RODS = ROD_NAMES.map((name, i) => ({
  name,
  price: i ? Math.round(60 * 1.75 ** i) : 0,
  zone: 18 + i * 2,
  luck: i * 2.5,
}));

const REEL_NAMES =
  "Rusty Reel,Spincast,Baitcaster,Okuma Pro,Shimano Elite,Abu Garcia Gold,Mag Drive,Titanium Winch,Quantum Reel,Cosmic Spool".split(",");

export const REELS = REEL_NAMES.map((name, i) => ({
  name,
  price: i ? Math.round(150 * 2.4 ** i) : 0,
  speed: i,
}));

const LINE_NAMES = "Mono 6lb,Mono 12lb,Braid 20lb,Fluoro 30lb,Braid 50lb,Dyneema 80lb,Titanium Wire,Starthread".split(",");

export const LINES = LINE_NAMES.map((name, i) => ({
  name,
  price: i ? Math.round(120 * 3 ** i) : 0,
  hold: 3 + i * 1.5,
}));

const BOAT_NAMES = "Shore,Jon Boat,Bass Boat,Center Console,Yacht,Research Sub".split(",");
const BOAT_PRICES = [0, 500, 5000, 40_000, 300_000, 2_000_000];

export const BOATS = BOAT_NAMES.map((name, i) => ({
  name,
  price: BOAT_PRICES[i],
  luck: i * 6,
}));

export const AUTO_PRICE = 25_000;

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

export const GEAR = {
  rod: RODS,
  reel: REELS,
  line: LINES,
  boat: BOATS,
} as const;

export type GearKind = keyof typeof GEAR;

export function rarityOf(i: number) {
  return i < 8 ? 0 : i < 14 ? 1 : i < 18 ? 2 : i < 19 ? 3 : 4;
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
};

export function luckTotal(s: LuckInput, lure: number) {
  const lureLuck = lure >= 0 ? LURES[lure].luck : 0;
  return (
    RODS[s.rod].luck +
    BOATS[s.boat].luck +
    lureLuck +
    WEATHER[s.weather].luck +
    s.lv * 0.4 +
    s.rb * 10 +
    dexCount(s.dex) * 0.1
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

export function rollFish(biome: number, luck: number, boss: boolean): Rolled {
  const k = Math.max(0.04, 0.36 / (1 + luck / 30));
  let i = boss
    ? 18 + ((Math.random() * 2) | 0)
    : pickWeighted(Array.from({ length: 20 }, (_, n) => Math.exp(-k * n)));
  const mw = MUTATIONS.map((x, j) => (j ? x.w * (1 + luck / 50) : x.w));
  let m = pickWeighted(mw);
  if (boss && m < 1) m = 1 + ((Math.random() * 3) | 0);
  const t = rarityOf(i);
  let w = +((0.4 + i * 0.55 + t * 3) * (1 + biome * 0.5) * (0.5 + Math.random() * 1.1)).toFixed(1);
  let v = Math.round((3 + i * i * 0.45 + t * 15) * 2.1 ** biome * (0.8 + Math.random() * 0.4) * MUTATIONS[m].mult);
  if (boss) {
    w = +(w * 1.35).toFixed(1);
    v = Math.round(v * 2.5);
  }
  const species = BIOMES[biome].fish[i];
  const prefix = MUTATIONS[m].name;
  const name = prefix ? `${prefix} ${species}` : species;
  return { b: biome, i, t, m, name, w, v, boss };
}
