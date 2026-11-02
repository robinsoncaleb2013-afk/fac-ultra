import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES } from "./content.ts";
import { MENU_CARDS } from "./modes.ts";
import { allHubCopy, GEAR_TEXT, JARGON, PLAY_META, playMeta, WATER_BLURB } from "./hubcopy.ts";
import { LEVELS } from "./device.ts";
import { LEVEL_INFO } from "./graphics.ts";

test("every menu card has a plain description and a painting, and the kid card is there", () => {
  for (const c of MENU_CARDS) {
    const m = playMeta(c.id);
    assert.ok(m, `no copy for ${c.id}`);
    assert.ok(BIOMES.some((b) => b.id === m.art), `${c.id} has no painting`);
    assert.ok(m.summary.length > 20 && m.summary.length < 130, `${c.id} summary length`);
    assert.ok(m.facts.length >= 2);
  }
  assert.ok(playMeta("kid"));
  assert.equal(PLAY_META.length, MENU_CARDS.length + 1);
});

test("one line per water, and no code words anywhere on the Hub", () => {
  assert.equal(WATER_BLURB.length, BIOMES.length);
  for (const line of [...allHubCopy(), ...LEVELS.map((l) => LEVEL_INFO[l].line), ...Object.values(GEAR_TEXT).map((g) => g.one)]) {
    assert.ok(!JARGON.test(line), `jargon in: ${line}`);
  }
});

test("sentences stay short enough for a child", () => {
  for (const m of PLAY_META) {
    for (const s of m.summary.split(/[.!?]\s/)) assert.ok(s.split(/\s+/).length <= 24, `long sentence in ${m.id}: ${s}`);
  }
});
