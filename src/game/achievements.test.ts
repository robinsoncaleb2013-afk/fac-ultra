import assert from "node:assert/strict";
import { test } from "node:test";
import { MODE_LIST } from "./modes.ts";
import {
  ACHIEVEMENTS,
  achievementViews,
  achievementsOn,
  allAchievements,
  bumpCounter,
  checkAchievements,
  CATEGORY_NAMES,
  freshAch,
  noStats,
  readAch,
  registerAchievements,
  summaryOf,
} from "./achievements.ts";

test("the table: unique ids, plain words, every category used, and goals above zero", () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, ACHIEVEMENTS.length);
  assert.ok(ACHIEVEMENTS.length >= 35);
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.name.length > 2 && a.text.length > 8, a.id);
    assert.ok(a.goal > 0 && (a.stat || a.counter), a.id);
    assert.ok(a.cat in CATEGORY_NAMES);
  }
  for (const c of Object.keys(CATEGORY_NAMES)) assert.ok(ACHIEVEMENTS.some((a) => a.cat === c), `category ${c} has achievements`);
});

test("tournaments and Survival give none; the others are per mode", () => {
  assert.equal(achievementsOn("tournament"), false);
  assert.equal(achievementsOn("survival"), false);
  assert.deepEqual(checkAchievements("tournament", { ...noStats(), caught: 999 }, freshAch(), 1).unlocked, []);
  for (const m of MODE_LIST) assert.equal(achievementViews(m, noStats(), freshAch()).length > 0, achievementsOn(m), m);
  const story = achievementViews("story", noStats(), freshAch()).map((v) => v.def.id);
  const exped = achievementViews("expedition", noStats(), freshAch()).map((v) => v.def.id);
  assert.ok(story.includes("story-1") && !exped.includes("story-1"));
  assert.ok(achievementViews("recreational", noStats(), freshAch()).some((v) => v.def.id === "trip-1"));
  assert.ok(!achievementViews("recreational", noStats(), freshAch()).some((v) => v.def.id === "earn-1k"), "no money in Relaxed Fishing");
});

test("an achievement unlocks once, with a time, when its number is reached", () => {
  let st = freshAch();
  let r = checkAchievements("expedition", { ...noStats(), caught: 1 }, st, 100);
  assert.deepEqual(r.unlocked.map((a) => a.id), ["catch-1"]);
  st = r.state;
  assert.equal(st.got["catch-1"], 100);
  r = checkAchievements("expedition", { ...noStats(), caught: 30 }, st, 200);
  assert.deepEqual(r.unlocked.map((a) => a.id), ["catch-25"]);
  assert.equal(r.state.got["catch-1"], 100, "the first time stays");
  assert.equal(checkAchievements("expedition", { ...noStats(), caught: 30 }, r.state, 300).unlocked.length, 0);
  assert.equal(summaryOf("expedition", { ...noStats(), caught: 30 }, r.state).done, 2);
});

test("other systems report by name: counters, and rows they add themselves", () => {
  let st = bumpCounter(freshAch(), "event:caught", 1);
  assert.deepEqual(checkAchievements("expedition", noStats(), st, 5).unlocked.map((a) => a.id), ["event-1"]);
  registerAchievements([{ id: "ev-meteor", name: "Wish Upon a Star", text: "Fish during a meteor shower.", cat: "events", goal: 1, counter: "event:meteor" }]);
  registerAchievements([{ id: "ev-meteor", name: "Duplicate", text: "x", cat: "events", goal: 1, counter: "event:meteor" }]);
  assert.equal(allAchievements().filter((a) => a.id === "ev-meteor").length, 1);
  st = bumpCounter(st, "event:meteor");
  assert.ok(checkAchievements("expedition", noStats(), st, 6).unlocked.some((a) => a.id === "ev-meteor"));
  assert.equal(bumpCounter(freshAch(), "Bad Name!").n["Bad Name!"], undefined, "odd names are refused");
});

test("hostile saves cannot add fake achievements or huge numbers", () => {
  const a = readAch({ got: { "catch-1": 5, "evil name": 1, ok: -3, x: "y" }, n: { "event:caught": 1e30 } });
  assert.deepEqual(Object.keys(a.got), ["catch-1"]);
  assert.equal(a.n["event:caught"], 1e12);
  assert.deepEqual(readAch(7), freshAch());
});
