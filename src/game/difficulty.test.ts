import assert from "node:assert/strict";
import { test } from "node:test";
import { bookFor, DIFFICULTIES, DIFFICULTY_TABLE, effectiveDifficulty, hasDifficulty, isDifficulty, STORY_DIFFICULTY } from "./difficulty.ts";
import { MODE_LIST } from "./modes.ts";

test("five levels, each with every number, and the dial only goes one way", () => {
  assert.deepEqual([...DIFFICULTIES], ["superEasy", "easy", "normal", "hard", "hardest"]);
  let last = DIFFICULTY_TABLE.superEasy;
  for (const id of DIFFICULTIES.slice(1)) {
    const d = DIFFICULTY_TABLE[id];
    assert.equal(d.id, id);
    assert.ok(d.blurb.length > 10 && d.title.length > 2);
    assert.ok(d.fightSpeed >= last.fightSpeed && d.biteSpeed >= last.biteSpeed && d.lineDrain >= last.lineDrain, `${id} is not easier than the level before`);
    last = d;
  }
  assert.equal(DIFFICULTY_TABLE.normal.fightSpeed, 1);
  assert.equal(DIFFICULTY_TABLE.normal.worth, 1);
  assert.equal(DIFFICULTY_TABLE.normal.xp, 1);
});

test("Super Easy is still harder than Kid Mode's gentleness and its fish stay out of the book; Easy and up count", () => {
  assert.equal(DIFFICULTY_TABLE.superEasy.countsInBook, false);
  for (const id of ["easy", "normal", "hard", "hardest"] as const) assert.equal(DIFFICULTY_TABLE[id].countsInBook, true);
  assert.ok(DIFFICULTY_TABLE.superEasy.fightSpeed < 1 && DIFFICULTY_TABLE.superEasy.fightSpeed > 0.5, "gentle, not trivial");
  assert.equal(DIFFICULTY_TABLE.superEasy.assist, "on");
});

test("on the hardest level fish are worth less; dangers are Hard (a taste) and Legend only", () => {
  assert.ok(DIFFICULTY_TABLE.hardest.worth < 1);
  for (const id of ["superEasy", "easy", "normal", "hard"] as const) assert.ok(DIFFICULTY_TABLE[id].worth >= 1, id);
  assert.deepEqual(DIFFICULTIES.map((d) => DIFFICULTY_TABLE[d].hazards), ["none", "none", "none", "taste", "full"]);
  assert.equal(DIFFICULTY_TABLE.hardest.assist, "off");
});

test("difficulty only exists in Expedition and Story; everything else plays at normal", () => {
  for (const m of MODE_LIST) {
    const eff = effectiveDifficulty(m, "hardest");
    if (m === "expedition") assert.equal(eff, "hardest");
    else if (m === "story") assert.equal(eff, STORY_DIFFICULTY);
    else assert.equal(eff, "normal", m);
    assert.equal(hasDifficulty(m), m === "expedition" || m === "story");
  }
  assert.ok(isDifficulty("hard") && !isDifficulty("brutal") && !isDifficulty(3));
});

test("which book a catch goes in: Kid Mode and Super Easy use the Kids book, everything else the mode's own", () => {
  assert.equal(bookFor("expedition", "normal", false), "main");
  assert.equal(bookFor("expedition", "easy", false), "main");
  assert.equal(bookFor("expedition", "superEasy", false), "kids");
  assert.equal(bookFor("expedition", "hardest", false), "main");
  for (const m of ["expedition", "story", "recreational", "coop"] as const) assert.equal(bookFor(m, "normal", true), "kids", `Kid lens in ${m}`);
  assert.equal(bookFor("survival", "normal", true), "main", "Survival keeps its own run book");
  assert.equal(bookFor("tournament", "normal", true), "main", "Tournaments are scored on the server");
  assert.equal(bookFor("recreational", "superEasy", false), "main", "Super Easy is an Expedition level; Recreational ignores it");
});
