import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { AMBIENCE_GROUPS, ambienceTarget, clampVolume, DEFAULT_VOLUME, DUCK, groupOf, SILENT, type AmbienceInput } from "./ambience.ts";
import { CB_COLORS, NORMAL_COLORS, rarityColors, RARITY_SHAPES, shapeOf, SHAPE_PATH } from "./rarity.ts";

const base: AmbienceInput = { sound: true, volume: 35, screen: "game", mode: "expedition", biome: 0, weather: 0, speaking: false };

test("every water belongs to exactly one of the five loops", () => {
  assert.equal(AMBIENCE_GROUPS.length, 5);
  const seen: number[] = [];
  for (const g of AMBIENCE_GROUPS) seen.push(...g.waters);
  assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: 15 }, (_, i) => i));
  assert.equal(groupOf(0), 0);
  assert.equal(groupOf(10), 3);
  assert.equal(groupOf(14), 4);
});

test("the ambient files fit the budget: five loops, each 250 KB or less, 1.25 MB in all", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "audio");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ogg"));
  assert.equal(files.length, 5);
  let total = 0;
  for (const f of files) {
    const size = statSync(join(dir, f)).size;
    assert.ok(size <= 250 * 1024, `${f} is ${size} bytes`);
    total += size;
  }
  assert.ok(total < 1.25 * 1024 * 1024, `total ${total} bytes`);
  for (const g of AMBIENCE_GROUPS) assert.ok(files.includes(g.file.split("/").pop()!), `${g.file} exists`);
});

test("silent on the menu, with sound off, at zero volume, and in a Tournament", () => {
  assert.deepEqual(ambienceTarget({ ...base, screen: "menu" }), SILENT);
  assert.deepEqual(ambienceTarget({ ...base, sound: false }), SILENT);
  assert.deepEqual(ambienceTarget({ ...base, volume: 0 }), SILENT);
  assert.deepEqual(ambienceTarget({ ...base, mode: "tournament" }), SILENT);
  for (const mode of ["expedition", "recreational", "survival", "coop"] as const) {
    assert.notEqual(ambienceTarget({ ...base, mode }).group, null, mode);
  }
});

test("the slider sets the level, 35% by default, and Kid Mode speech ducks it", () => {
  assert.equal(DEFAULT_VOLUME, 35);
  const quiet = ambienceTarget({ ...base, volume: 35 });
  const loud = ambienceTarget({ ...base, volume: 100 });
  assert.ok(loud.gain > quiet.gain * 2.5);
  const ducked = ambienceTarget({ ...base, speaking: true });
  assert.ok(Math.abs(ducked.gain - quiet.gain * DUCK) < 1e-9);
  assert.equal(clampVolume(500), 100);
  assert.equal(clampVolume(-4), 0);
  assert.equal(clampVolume(NaN), DEFAULT_VOLUME);
});

test("weather adds rain and wind from the synth, and a storm is the loudest", () => {
  const sun = ambienceTarget(base);
  const rain = ambienceTarget({ ...base, weather: 1 });
  const storm = ambienceTarget({ ...base, weather: 2 });
  assert.equal(sun.rain, 0);
  assert.ok(rain.rain > 0 && storm.rain > rain.rain);
  assert.ok(storm.wind > sun.wind);
  assert.equal(rain.group, sun.group, "weather never swaps the loop");
});

test("each rarity has its own shape, and the colour-blind palette is the one in the spec", () => {
  assert.deepEqual([...RARITY_SHAPES], ["dot", "diamond", "star", "hexagon", "crown"]);
  assert.equal(new Set(RARITY_SHAPES.map((s) => SHAPE_PATH[s])).size, 5);
  assert.deepEqual(RARITY_SHAPES.map((_, i) => shapeOf(i)), [...RARITY_SHAPES]);
  assert.equal(shapeOf(99), "crown");
  assert.equal(shapeOf(-3), "dot");
  assert.deepEqual(CB_COLORS.slice(1), ["#2a9d8f", "#4a7bd0", "#d08a2e", "#e8c547"]);
  assert.equal(CB_COLORS[0], NORMAL_COLORS[0], "common stays grey");
  assert.deepEqual(rarityColors(false), NORMAL_COLORS);
  assert.deepEqual(rarityColors(true), CB_COLORS);
});
