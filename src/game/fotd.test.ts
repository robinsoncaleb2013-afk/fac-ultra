import assert from "node:assert/strict";
import { test } from "node:test";
import { addClaim, claimsFotd, claimStreak, FOTD_SLOTS, fotdFor, readClaims, today } from "./fotd.ts";

const ALL = Array.from({ length: 15 }, (_, i) => i);

test("the Fish of the Day is the same all day and for the same waters", () => {
  assert.deepEqual(fotdFor("2026-11-02", ALL), fotdFor("2026-11-02", ALL));
  assert.deepEqual(fotdFor("2026-11-02", [0, 1, 2]), fotdFor("2026-11-02", [2, 1, 0, 1]));
});

test("it rotates by date: a month of days gives many different fish", () => {
  const seen = new Set<string>();
  for (let d = 1; d <= 30; d++) seen.add(fotdFor(`2026-11-${String(d).padStart(2, "0")}`, ALL)!.key);
  assert.ok(seen.size >= 20, `${seen.size} different fish in 30 days`);
});

test("it only picks from waters you have open, and from fish a visit can always roll", () => {
  for (let d = 1; d <= 120; d++) {
    const date = `2027-${String(1 + (d % 12)).padStart(2, "0")}-${String(1 + (d % 28)).padStart(2, "0")}`;
    const f = fotdFor(date, [0, 5])!;
    assert.ok(f.biome === 0 || f.biome === 5);
    assert.ok(f.species >= 0 && f.species < FOTD_SLOTS);
    assert.equal(f.key, `${f.biome}-${f.species}`);
    assert.ok(f.name.length > 0);
  }
  assert.equal(fotdFor("2026-11-02", []), null);
  assert.equal(fotdFor("2026-11-02", [99, -1]), null);
});

test("only the first catch of the day claims the bonus", () => {
  const f = fotdFor("2026-11-02", ALL)!;
  assert.equal(claimsFotd(f, f.key, [], "2026-11-02"), true);
  assert.equal(claimsFotd(f, "0-99", [], "2026-11-02"), false, "a different fish is not it");
  assert.equal(claimsFotd(f, f.key, ["2026-11-02"], "2026-11-02"), false, "already claimed today");
  assert.equal(claimsFotd(f, f.key, ["2026-11-01"], "2026-11-02"), true, "yesterday does not count");
  assert.equal(claimsFotd(null, f.key, [], "2026-11-02"), false);
});

test("claims are filed once, newest last, and only 60 days are kept", () => {
  assert.deepEqual(addClaim(["2026-11-01"], "2026-11-02"), ["2026-11-01", "2026-11-02"]);
  assert.deepEqual(addClaim(["2026-11-02"], "2026-11-02"), ["2026-11-02"]);
  let c: string[] = [];
  for (let d = 0; d < 80; d++) c = addClaim(c, new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10));
  assert.equal(c.length, 60);
  assert.equal(c[59], "2026-03-21");
  assert.deepEqual(readClaims(["2026-01-01", "2026-01-01", "bad", 4, "2026-13-xx"]), ["2026-01-01"]);
});

test("streaks count the days in a row, ending today or yesterday", () => {
  assert.equal(claimStreak(["2026-11-02", "2026-11-01", "2026-10-31"], "2026-11-02"), 3);
  assert.equal(claimStreak(["2026-11-01", "2026-10-31"], "2026-11-02"), 2, "today not caught yet keeps the streak alive");
  assert.equal(claimStreak(["2026-10-30"], "2026-11-02"), 0);
  assert.equal(claimStreak([], "2026-11-02"), 0);
  assert.match(today(new Date(2026, 10, 2)), /^2026-11-02$/);
});
