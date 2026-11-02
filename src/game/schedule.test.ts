import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES } from "./content.ts";
import {
  dailyAt,
  dateStamp,
  DAY,
  eventSeed,
  HOUR,
  isCode,
  privateSpec,
  quickAt,
  schedule,
  SURVIVAL_WATERS,
  survivalAt,
  survivalSeed,
  weekStart,
  weeklyAt,
} from "./schedule.ts";
import { seedFrom } from "./rng.ts";

const T = Date.UTC(2026, 10, 2, 13, 37, 12); // Monday 2026-11-02

test("schedule() is a pure function of time", () => {
  assert.deepEqual(schedule(T), schedule(T));
  assert.deepEqual(schedule(T), schedule(T + 5000), "same hour, same day: nothing moves");
  assert.notDeepEqual(schedule(T), schedule(T + HOUR));
});

test("every hour has exactly one Quick event, ten minutes long, on the hour", () => {
  const ids = new Set<string>();
  for (let h = 0; h < 24 * 8; h++) {
    const now = T - (T % HOUR) + h * HOUR + 123_456;
    const quicks = schedule(now).filter((e) => e.kind === "quick" && e.startsAt <= now && now < e.startsAt + HOUR);
    assert.equal(quicks.length, 1, `hour ${h}`);
    const q = quicks[0];
    assert.equal(q.startsAt % HOUR, 0);
    assert.equal(q.endsAt - q.startsAt, 10 * 60_000);
    assert.equal(q.rules.castBudget, 40);
    ids.add(q.id);
  }
  assert.equal(ids.size, 24 * 8, "ids are unique per hour");
});

test("quick waters rotate through all fifteen and the three categories all turn up", () => {
  const waters = new Set<number>();
  const cats = new Set<string>();
  for (let h = 0; h < 45; h++) {
    const q = quickAt(T + h * HOUR);
    waters.add(q.water);
    cats.add(q.rules.category);
  }
  assert.equal(waters.size, BIOMES.length);
  assert.deepEqual([...cats].sort(), ["big", "sprint", "total"]);
});

test("dailies rotate categories as 06 §2.2 says: Mon/Thu big, Tue/Fri total, Wed/Sat sprint, Sun value", () => {
  const want = ["value", "big", "total", "sprint", "big", "total", "sprint"]; // Sun … Sat
  for (let d = 0; d < 14; d++) {
    const at = Date.UTC(2026, 10, 1 + d, 9);
    const e = dailyAt(at);
    assert.equal(e.rules.category, want[new Date(at).getUTCDay()], dateStamp(at));
    assert.equal(e.endsAt - e.startsAt, DAY);
    assert.equal(e.startsAt, Date.UTC(2026, 10, 1 + d));
    assert.equal(e.rules.fishingSeconds, 1200);
    assert.equal(e.rules.gear, "fixed");
    assert.equal(e.rules.assist, false);
    assert.equal(e.id, `d-${dateStamp(at)}`);
  }
});

test("a week runs Monday to Sunday over three waters that add up as one series", () => {
  assert.equal(new Date(weekStart(T)).getUTCDay(), 1);
  assert.equal(weekStart(T), Date.UTC(2026, 10, 2));
  assert.equal(weekStart(Date.UTC(2026, 10, 8, 23, 59)), Date.UTC(2026, 10, 2), "Sunday is still that week");
  assert.equal(weekStart(Date.UTC(2026, 10, 9)), Date.UTC(2026, 10, 9));
  const w = weeklyAt(T);
  assert.equal(w.length, 3);
  assert.equal(new Set(w.map((e) => e.water)).size, 3);
  assert.equal(new Set(w.map((e) => e.series)).size, 1);
  for (const e of w) {
    assert.equal(e.endsAt - e.startsAt, 7 * DAY);
    assert.equal(e.rules.category, "total");
  }
});

test("the Survival daily uses the survival seed and one of the eight survival waters", () => {
  const e = survivalAt(T);
  assert.ok(SURVIVAL_WATERS.includes(e.water));
  assert.equal(e.kind, "survival");
  assert.equal(e.seed, seedFrom("survival", "2026-11-02", e.water));
  assert.equal(e.seed, survivalSeed("2026-11-02", e.water));
  const seen = new Set<number>();
  for (let d = 0; d < 8; d++) seen.add(survivalAt(T + d * DAY).water);
  assert.equal(seen.size, 8);
});

test("event ids are unique across a schedule and seeds come from the id", () => {
  const list = schedule(T);
  assert.equal(new Set(list.map((e) => e.id)).size, list.length);
  for (const e of list) {
    if (e.kind !== "survival") assert.equal(e.seed, eventSeed(e.id));
    assert.ok(e.endsAt > e.startsAt);
  }
});

test("private events clamp what the host asks for", () => {
  const p = privateSpec("ABCD", 4, { category: "sprint", castBudget: 9999, fishingSeconds: 5 }, 9999, T);
  assert.equal(p.id, "p-ABCD");
  assert.equal(p.kind, "private");
  assert.equal(p.water, 4);
  assert.equal(p.rules.category, "sprint");
  assert.equal(p.rules.castBudget, 120);
  assert.equal(p.rules.fishingSeconds, 60);
  assert.equal(p.endsAt - p.startsAt, 180 * 60_000);
  assert.equal(p.rules.maxPlayers, 16);
  const d = privateSpec("WXYZ", "lake", { category: "survival" }, null, T);
  assert.equal(d.water, 0);
  assert.equal(d.rules.category, "total", "private events can't be Survival");
  assert.equal(d.rules.gear, "fixed");
});

test("codes use letters that read aloud", () => {
  assert.ok(isCode("ABCD"));
  for (const bad of ["ABC", "ABCDE", "abcd", "AB0D", "ABID", "ABOD", "AB1D", "", 12]) assert.ok(!isCode(bad), String(bad));
});
