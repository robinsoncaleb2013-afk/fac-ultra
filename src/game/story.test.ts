import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES, BOSS_INDEX } from "./content.ts";
import { advanceStory, chapterInfo, chapterObjectives, chapterReward, chapterView, CHAPTERS, freshStory, objectiveProgress, readStory, storyDone } from "./story.ts";

const dexOf = (entries: Record<string, number>) => Object.fromEntries(Object.entries(entries).map(([k, c]) => [k, { c, w: 1, m: 0 }]));

test("one chapter per water, each with plain words, goals that grow, and a boss last", () => {
  assert.equal(CHAPTERS, BIOMES.length);
  for (let i = 0; i < CHAPTERS; i++) {
    const info = chapterInfo(i);
    assert.ok(info.title && info.intro.length > 20 && info.outro.length > 20, `chapter ${i} has words`);
    const objs = chapterObjectives(i);
    assert.ok(objs.length >= 3);
    assert.equal(objs[objs.length - 1].kind, "boss");
    assert.ok(objs[objs.length - 1].text.includes(BIOMES[i].fish[BOSS_INDEX]));
    assert.ok(objs.every((o) => o.text.length > 5 && o.goal >= 1));
  }
  assert.equal(chapterObjectives(0)[0].text, "Catch 3 fish in the Pond");
});

test("progress comes from the fish book alone and never goes over the goal", () => {
  const [catchO, kindsO] = chapterObjectives(0);
  const dex = dexOf({ "0-0": 5, "0-1": 1 });
  assert.equal(objectiveProgress(catchO, dex), catchO.goal);
  assert.equal(objectiveProgress(kindsO, dex), 2);
  assert.equal(objectiveProgress(chapterObjectives(1)[0], dex), 0, "fish from another water do not count");
});

test("finishing a chapter pays once, opens the next water, and chapters can finish together", () => {
  let dex = dexOf({});
  assert.equal(advanceStory(freshStory(), dex).finished.length, 0);
  const full = (b: number) => {
    const o: Record<string, number> = {};
    for (let i = 0; i < 25; i++) o[`${b}-${i}`] = 1;
    return o;
  };
  dex = dexOf({ ...full(0), ...full(1) });
  const r = advanceStory(freshStory(), dex);
  assert.deepEqual(r.finished, [0, 1]);
  assert.equal(r.state.chapter, 2);
  assert.deepEqual(r.state.rewarded, [0, 1]);
  assert.equal(advanceStory(r.state, dex).finished.length, 0, "never paid twice");
  assert.equal(chapterReward(0).unlockWater, 1);
  assert.equal(chapterReward(CHAPTERS - 1).unlockWater, null);
  assert.ok(chapterReward(4).coins > chapterReward(0).coins);
  assert.ok(chapterReward(0).lines.every((l) => l.length > 3));
  assert.equal(chapterView(0, dex).done, true);
});

test("the whole story can be finished, and a hostile save cannot break it", () => {
  const dex: Record<string, { c: number; w: number; m: number }> = {};
  for (let b = 0; b < CHAPTERS; b++) for (let i = 0; i < 25; i++) dex[`${b}-${i}`] = { c: 1, w: 1, m: 0 };
  const r = advanceStory(freshStory(), dex);
  assert.equal(r.finished.length, CHAPTERS);
  assert.ok(storyDone(r.state));
  assert.deepEqual(readStory({ chapter: 999, rewarded: [1, 1, -2, 77, "x"] }), { chapter: CHAPTERS, rewarded: [1] });
  assert.deepEqual(readStory(null), freshStory());
});
