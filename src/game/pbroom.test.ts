import assert from "node:assert/strict";
import { test } from "node:test";
import { inWater, lengthIn, plaques, wallOfFame } from "./pbroom.ts";

test("a fish's length follows its weight in a steady, believable way", () => {
  assert.equal(lengthIn(1), 10);
  assert.equal(lengthIn(8), 20);
  assert.equal(lengthIn(27), 30);
  assert.equal(lengthIn(0), 1);
  assert.ok(lengthIn(50) > lengthIn(20));
});

test("one plaque per species caught, heaviest first, with the story when there is one", () => {
  const dex = { "0-2": { c: 3, w: 2.5, m: 0 }, "1-4": { c: 1, w: 9.1, m: 2 }, "0-9": { c: 0, w: 4, m: 0 } };
  const records = { "1-4": { w: 9.1, at: 1_800_000_000_000, spot: "lair", p: { family: "worm" as const, depth: 1 as const, retrieve: "medium" as const }, weather: 1, window: "day" as const } };
  const list = plaques(records, dex);
  assert.deepEqual(list.map((p) => p.key), ["1-4", "0-2"]);
  assert.equal(list[0].mutation, 2);
  assert.ok(list[0].story.includes("9.1 lb") && list[0].at > 0);
  assert.equal(list[1].story, "2.5 lb", "an old best has no story");
  assert.equal(list[1].at, 0);
  assert.equal(wallOfFame(list, 1).length, 1);
  assert.deepEqual(inWater(list, 0).map((p) => p.key), ["0-2"]);
});
