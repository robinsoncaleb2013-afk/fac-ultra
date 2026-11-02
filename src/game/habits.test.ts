import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES, SPECIES_PER_BIOME, archetypeOf, rarityOf } from "./content.ts";
import {
  habitFight,
  habitHow,
  habitLikes,
  habitOf,
  habitSentences,
  habitWeather,
  isRealFish,
  REAL_FISH,
  REAL_FISH_COUNT,
} from "./habits.ts";
import { FAMILIES, RETRIEVES, WINDOWS } from "./presentation.ts";
import { biomeStructures } from "./spots.ts";

const MUST_HAVE = [
  "Bluegill",
  "Largemouth",
  "Smallmouth",
  "Crappie",
  "Walleye",
  "Catfish",
  "Rainbow Trout",
  "Brown Trout",
  "Brook Trout",
  "Steelhead",
  "Salmon",
  "Pike",
  "Muskie",
  "Lake Trout",
  "Striper",
  "Tarpon",
  "Snook",
  "Redfish",
  "Flounder",
  "Mahi Mahi",
  "Tuna",
  "Marlin",
  "Halibut",
  "Cod",
  "Mackerel",
];

test("the 25 real fish the spec names all have hand-written habits", () => {
  for (const name of MUST_HAVE) assert.ok(isRealFish(name), name);
  assert.ok(REAL_FISH_COUNT >= 25);
});

test("every hand-written fish exists in a water and holds at a structure that water actually has", () => {
  for (const name of Object.keys(REAL_FISH)) {
    const homes = BIOMES.map((b, bi) => ({ bi, i: b.fish.indexOf(name) })).filter((h) => h.i >= 0);
    assert.ok(homes.length >= 1, `${name} is not in any water`);
    for (const { bi } of homes) {
      const have = biomeStructures(bi);
      assert.ok(
        REAL_FISH[name].structures.some((s) => have.includes(s)),
        `${name} has no structure to hold at in ${BIOMES[bi].name}`,
      );
    }
  }
});

test("Largemouth is exactly the spec's worked example", () => {
  const h = REAL_FISH.Largemouth;
  assert.deepEqual(h.structures, ["weeds", "dock", "timber"]);
  assert.equal(h.depth, 1);
  assert.deepEqual(h.feeds, ["dawn", "dusk"]);
  assert.deepEqual(h.likes, ["worm", "crank", "topwater"]);
  assert.deepEqual(h.retrieve, ["slow", "medium"]);
  assert.deepEqual(h.weather, [1, 2]);
  assert.equal(h.fight, "jumper");
  assert.equal(h.stamina, 1.1);
  const pond = BIOMES[0].fish.indexOf("Largemouth");
  assert.deepEqual(habitOf(0, pond), h);
});

test("real-world sense: catfish feed after dark, deep; bluegill are shallow and small; trout want moving water", () => {
  assert.ok(REAL_FISH.Catfish.feeds.includes("night"));
  assert.equal(REAL_FISH.Catfish.depth, 2);
  assert.equal(REAL_FISH.Bluegill.depth, 0);
  assert.ok(REAL_FISH.Bluegill.stamina < 1);
  assert.ok(REAL_FISH["Rainbow Trout"].structures.includes("current"));
  assert.ok(REAL_FISH.Walleye.feeds.includes("dusk"));
  assert.ok(REAL_FISH.Muskie.stamina > REAL_FISH.Bluegill.stamina);
  assert.equal(REAL_FISH.Tarpon.fight, "jumper");
});

test("all 375 habits are well-formed", () => {
  for (let b = 0; b < BIOMES.length; b++) {
    const have = biomeStructures(b);
    for (let i = 0; i < SPECIES_PER_BIOME; i++) {
      const h = habitOf(b, i);
      const tag = `${BIOMES[b].fish[i]} (${b}-${i})`;
      assert.ok(h.structures.length >= 1 && h.structures.length <= 3, `${tag} structures`);
      assert.ok(
        h.structures.some((s) => have.includes(s)),
        `${tag} holds somewhere real`,
      );
      assert.ok([0, 1, 2].includes(h.depth), `${tag} depth`);
      assert.ok(h.feeds.length >= 1 && h.feeds.every((w) => WINDOWS.includes(w)), `${tag} feeds`);
      assert.ok(
        h.likes.length >= 2 && h.likes.length <= 3 && h.likes.every((f) => FAMILIES.includes(f)),
        `${tag} likes`,
      );
      assert.equal(new Set(h.likes).size, h.likes.length, `${tag} likes are distinct`);
      assert.ok(
        h.retrieve.length >= 1 &&
          h.retrieve.length <= 2 &&
          h.retrieve.every((r) => RETRIEVES.includes(r)),
        `${tag} retrieve`,
      );
      assert.ok(
        h.weather.every((w) => Number.isInteger(w) && w >= 0 && w <= 4),
        `${tag} weather`,
      );
      assert.ok(h.stamina >= 0.6 && h.stamina <= 1.8, `${tag} stamina ${h.stamina}`);
      assert.ok(
        ["runner", "diver", "jumper", "bulldog", "thrasher"].includes(h.fight),
        `${tag} fight`,
      );
    }
  }
});

test("rule fish: archetype decides the fight, rarity decides the stamina", () => {
  const expectFight: Record<string, string> = {
    fish: "runner",
    eel: "thrasher",
    round: "bulldog",
    ray: "diver",
    shark: "runner",
    whale: "bulldog",
    turtle: "bulldog",
    squid: "diver",
    seahorse: "thrasher",
    angler: "diver",
    crab: "bulldog",
    jelly: "thrasher",
  };
  const stamina = [0.7, 0.9, 1.1, 1.4, 1.8];
  let checked = 0;
  for (let b = 0; b < BIOMES.length; b++)
    for (let i = 0; i < SPECIES_PER_BIOME; i++) {
      const name = BIOMES[b].fish[i];
      if (isRealFish(name)) continue;
      const h = habitOf(b, i);
      assert.equal(h.fight, expectFight[archetypeOf(name)], name);
      assert.equal(h.stamina, stamina[rarityOf(i)], name);
      checked++;
    }
  assert.ok(checked > 300);
});

test("rule fish: commons also feed in the daytime; depth cycles through 0, 1, 2", () => {
  for (let b = 0; b < BIOMES.length; b++)
    for (let i = 0; i < 9; i++) {
      if (isRealFish(BIOMES[b].fish[i])) continue;
      assert.ok(habitOf(b, i).feeds.includes("day"), `${BIOMES[b].fish[i]} should feed by day`);
    }
  const depths = new Set<number>();
  for (let i = 0; i < 25; i++) depths.add(habitOf(2, i).depth);
  assert.equal(depths.size, 3);
});

test("no two species in a water share the same ideal rig (so 'the right rig' means something)", () => {
  for (let b = 0; b < BIOMES.length; b++) {
    const seen = new Map<string, string>();
    for (let i = 0; i < SPECIES_PER_BIOME; i++) {
      const h = habitOf(b, i);
      const key = [h.structures.join("+"), h.depth, h.likes[0], h.retrieve[0], h.feeds[0]].join(
        "|",
      );
      assert.ok(
        !seen.has(key),
        `${BIOMES[b].fish[i]} and ${seen.get(key)} are identical in ${BIOMES[b].name}`,
      );
      seen.set(key, BIOMES[b].fish[i]);
    }
  }
});

test("habitOf hands back copies-safe data and survives a bad index", () => {
  assert.ok(habitOf(99, 99));
  assert.equal(habitOf(0, 0), habitOf(0, 0));
});

test("dex sentences are plain English", () => {
  const h = REAL_FISH.Largemouth;
  assert.equal(
    habitLikes(h),
    "Likes plastic worms, crankbaits, and topwater lures at dawn and dusk, around weeds, docks, and logs and roots.",
  );
  assert.equal(habitHow(h), "Fish it mid-depth, with a slow or medium-speed retrieve.");
  assert.equal(habitWeather(h), "Bites best in the rain or a storm.");
  assert.match(habitFight(h), /leaps/);
  assert.equal(habitWeather({ ...h, weather: [] }), null);
  const all = habitSentences(h).join(" ");
  for (const jargon of ["sim.", "zone", "habit", "undefined", "NaN", "null"])
    assert.ok(!all.includes(jargon), jargon);
  for (const sentence of habitSentences(h))
    assert.ok(/[.!?]$/.test(sentence) && sentence.length < 140);
});
