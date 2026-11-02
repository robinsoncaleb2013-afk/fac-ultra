import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreEntry, scoreLabel, type Landed } from "./scoring.ts";

const fish = (castIndex: number, species: number, weight: number, value = weight * 10): Landed => ({ castIndex, species, weight, value });

const SET: Landed[] = [fish(0, 1, 2.5), fish(1, 1, 4.1), fish(2, 7, 1.2, 900), fish(3, 9, 4.1, 50), fish(5, 7, 0.4)];

test("Big Fish: the heaviest fish, then the second heaviest", () => {
  const s = scoreEntry("big", SET);
  assert.equal(s.score, 4.1);
  assert.equal(s.tiebreak, 4.1);
  assert.equal(s.best, 4.1);
});

test("Total Weight: every landed fish added up, then how many", () => {
  const s = scoreEntry("total", SET);
  assert.equal(s.score, 12.3);
  assert.equal(s.tiebreak, 5);
});

test("Species Sprint: distinct species, then who found the last new one soonest", () => {
  const s = scoreEntry("sprint", SET);
  assert.equal(s.score, 3);
  assert.equal(s.tiebreak, -3);
  const slower = scoreEntry("sprint", [fish(0, 1, 1), fish(1, 2, 1), fish(8, 3, 1)]);
  assert.equal(slower.score, 3);
  assert.ok(s.tiebreak > slower.tiebreak, "found them sooner");
});

test("Value: the sum of values, then the heaviest fish", () => {
  const s = scoreEntry("value", SET);
  assert.equal(s.score, 25 + 41 + 900 + 50 + 4);
  assert.equal(s.tiebreak, 4.1);
});

test("an empty entry scores nothing", () => {
  for (const c of ["big", "total", "sprint", "value"] as const) {
    const s = scoreEntry(c, []);
    assert.deepEqual([s.score, s.tiebreak, s.fish], [0, 0, 0], c);
  }
});

test("order of the list does not matter and float noise does not creep in", () => {
  const many = Array.from({ length: 30 }, (_, i) => fish(i, i % 5, 0.1 + (i % 7) * 0.1));
  const a = scoreEntry("total", many);
  const b = scoreEntry("total", [...many].reverse());
  assert.equal(a.score, b.score);
  assert.equal(String(a.score).length < 8, true);
});

test("labels read well", () => {
  assert.equal(scoreLabel("big", 4.1), "4.1 lb");
  assert.equal(scoreLabel("sprint", 3), "3 kinds");
  assert.equal(scoreLabel("value", 12345), "12,345 pts");
});
