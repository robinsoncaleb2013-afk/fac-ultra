import assert from "node:assert/strict";
import { test } from "node:test";
import { BOARD_MIN, fillCount, fillRivals, MAX_FILL, rivalRows, rivalsAhead, type FillEvent } from "./fill.ts";
import { quickAt } from "./schedule.ts";
import { rng, setRng, makeRng } from "./rng.ts";

const q = quickAt(Date.UTC(2026, 10, 2, 13, 5));
const ev: FillEvent = { id: q.id, seed: q.seed, water: q.water, startsAt: q.startsAt, endsAt: q.endsAt, category: q.rules.category, castBudget: q.rules.castBudget };

test("only Quick boards are topped up, to six names, never more than five Regulars", () => {
  assert.equal(BOARD_MIN, 6);
  assert.equal(fillCount("quick", 0), 5);
  assert.equal(fillCount("quick", 1), 5);
  assert.equal(fillCount("quick", 3), 3);
  assert.equal(fillCount("quick", 6), 0);
  assert.equal(fillCount("quick", 40), 0);
  for (const k of ["daily", "weekly", "private", "survival"]) assert.equal(fillCount(k, 1), 0, k);
  assert.ok(MAX_FILL <= 5);
});

test("the same Regulars come first whatever the count, and there are no repeats", () => {
  const five = fillRivals(ev, 5).map((r) => r.id);
  assert.equal(new Set(five).size, 5);
  assert.deepEqual(fillRivals(ev, 2).map((r) => r.id), five.slice(0, 2));
});

test("a Regular's score is a pure, growing function of the clock", () => {
  const at = (s: number) => rivalRows(ev, 5, ev.startsAt + s * 1000);
  const a = at(300);
  const b = at(300);
  assert.deepEqual(a, b);
  const late = at(600);
  for (let i = 0; i < 5; i++) {
    assert.ok(late[i].casts >= a[i].casts);
    assert.ok(late[i].fish >= a[i].fish);
    if (ev.category === "total") assert.ok(late[i].score >= a[i].score);
  }
  assert.ok(late.some((r) => r.score > 0), "somebody has caught something after ten minutes");
});

test("before the start nobody has caught anything; after the end the scores stop changing", () => {
  assert.ok(rivalRows(ev, 5, ev.startsAt - 5000).every((r) => r.casts === 0 && r.score === 0));
  assert.deepEqual(rivalRows(ev, 5, ev.endsAt), rivalRows(ev, 5, ev.endsAt + 3_600_000));
});

test("Regulars never touch the live random stream", () => {
  setRng(makeRng(99));
  const before = rng();
  setRng(makeRng(99));
  rivalRows(ev, 5, ev.endsAt);
  assert.equal(rng(), before);
});

test("rivalsAhead: a human wins a tie with a Regular", () => {
  const rows = [{ score: 10, tiebreak: 1 }, { score: 5, tiebreak: 0 }, { score: 5, tiebreak: 3 }];
  assert.equal(rivalsAhead(rows, 5, 0), 2);
  assert.equal(rivalsAhead(rows, 10, 1), 0);
  assert.equal(rivalsAhead(rows, 4, 0), 3);
});

test("different events give different Regulars on different waters", () => {
  const other = quickAt(Date.UTC(2026, 10, 2, 14, 5));
  const ids = (e: typeof q) => fillRivals(e, 5).map((r) => r.id).join();
  assert.notEqual(ids(q) + q.water, ids(other) + other.water);
});
