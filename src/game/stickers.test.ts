import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES } from "./content.ts";
import { makeRng } from "./rng.ts";
import {
  frameId,
  hasFoil,
  newPages,
  pageComplete,
  pageFill,
  pageId,
  readShiny,
  readStickers,
  rollShiny,
  SHINY_ODDS,
} from "./stickers.ts";

const fullPage = (b: number, skip = -1) => {
  const dex: Record<string, { c: number; w: number; m: number }> = {};
  for (let i = 0; i < 25; i++) if (i !== skip) dex[`${b}-${i}`] = { c: 1, w: 1, m: 0 };
  return dex;
};

test("shiny odds are two in a hundred and seeded rolls are reproducible", () => {
  assert.equal(SHINY_ODDS, 0.02);
  const r = makeRng(2026);
  let n = 0;
  const N = 200_000;
  for (let i = 0; i < N; i++) if (rollShiny(r)) n++;
  assert.ok(Math.abs(n / N - 0.02) < 0.002, `${((100 * n) / N).toFixed(2)}% shiny`);
  const a = makeRng(5);
  const b = makeRng(5);
  assert.deepEqual(Array.from({ length: 200 }, () => rollShiny(a)), Array.from({ length: 200 }, () => rollShiny(b)));
  assert.equal(rollShiny(() => 0.999), false);
  assert.equal(rollShiny(() => 0), true);
});

test("a page is complete only with all 25 cells, boss included", () => {
  assert.equal(pageComplete(fullPage(3), 3), true);
  assert.equal(pageComplete(fullPage(3, 24), 3), false, "no boss, no page");
  assert.equal(pageComplete(fullPage(3, 0), 3), false);
  assert.equal(pageFill(fullPage(3, 7), 3), 24);
});

test("newPages lists finished pages whose sticker is not yet stuck in", () => {
  const dex = { ...fullPage(0), ...fullPage(4) };
  assert.deepEqual(newPages(dex, []), [0, 4]);
  assert.deepEqual(newPages(dex, [pageId(0)]), [4]);
  assert.deepEqual(newPages(dex, [pageId(0), pageId(4)]), []);
  assert.deepEqual(newPages({}, []), []);
});

test("only a mutated fish earns a foil edge", () => {
  assert.equal(hasFoil(0), false);
  assert.equal(hasFoil(1), true);
});

test("saved stickers and shinies are cleaned: known ids only, no repeats, bounded", () => {
  assert.deepEqual(readStickers(["page-0", "page-0", "page-99", "frame-3-4", "frame-3-99", "junk", 5, null]), ["page-0", "frame-3-4"]);
  assert.deepEqual(readStickers("nope"), []);
  assert.equal(readStickers(Array.from({ length: 5000 }, (_, i) => `frame-${i % 15}-${i % 25}`)).length <= 375, true);
  assert.deepEqual(readShiny(["0-1", "0-1", "99-1", "3-30", "x", "14-24"]), ["0-1", "14-24"]);
  assert.deepEqual(readShiny({}), []);
  assert.equal(frameId("3-4"), "frame-3-4");
  assert.ok(BIOMES.length === 15);
});
