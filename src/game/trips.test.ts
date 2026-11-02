import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addTrip,
  creelLine,
  finishTrip,
  MAX_TRIPS,
  photoCaption,
  readTrip,
  readTrips,
  startTrip,
  tripCardLines,
  tripCatch,
  tripHeadline,
  tripIsStale,
  tripMinutes,
  tripRelease,
  tripTitle,
  TRIP_IDLE_MS,
  windowHour,
  windowLabel,
  weatherLabel,
  type Trip,
} from "./trips.ts";
import { windowOf } from "./match.ts";
import { WINDOWS } from "./presentation.ts";

const T0 = Date.UTC(2026, 10, 2, 9, 0, 0);
const fish = (name: string, w: number, o: Partial<{ rarity: number; discovered: boolean; record: boolean }> = {}) => ({
  name,
  w,
  rarity: o.rarity ?? 0,
  discovered: o.discovered ?? false,
  record: o.record ?? false,
});

test("a new trip is empty, open, and clamps its inputs", () => {
  const t = startTrip(T0, 3, "dawn", 1);
  assert.equal(t.end, 0);
  assert.equal(t.caught + t.kept + t.released, 0);
  assert.equal(t.keptLb, 0);
  assert.equal(t.best, null);
  assert.equal(t.window, "dawn");
  assert.equal(t.weather, 1);
  assert.equal(startTrip(T0, 99, "clock", 4).water, 14, "water clamps to the last one");
  assert.equal(startTrip(T0, -3).water, 0);
  assert.equal(startTrip(T0, 0, "clock", 4).weather, -1, "Night is a time of day, not a trip weather");
  assert.equal(startTrip(T0, 0, "clock", 9).weather, -1);
});

test("catching a fish puts it in the creel and tracks the biggest", () => {
  let t = startTrip(T0, 1);
  t = tripCatch(t, fish("Brown Trout", 3.4), T0 + 1000);
  t = tripCatch(t, fish("Bluegill", 0.6), T0 + 2000);
  t = tripCatch(t, fish("Brown Trout", 3.1), T0 + 3000);
  assert.equal(t.caught, 3);
  assert.equal(t.kept, 3);
  assert.equal(t.keptLb, 7.1);
  assert.equal(t.totalLb, 7.1);
  assert.deepEqual(t.best, { n: "Brown Trout", w: 3.4, t: 0 });
  assert.equal(t.last, T0 + 3000);
});

test("new species and personal bests are listed once each", () => {
  let t = startTrip(T0, 0);
  t = tripCatch(t, fish("Perch", 1, { discovered: true }), T0);
  t = tripCatch(t, fish("Perch", 2, { record: true }), T0);
  t = tripCatch(t, fish("Perch", 3, { record: true }), T0);
  t = tripCatch(t, fish("Pike", 5, { discovered: true, record: true }), T0);
  assert.deepEqual(t.fresh, ["Perch", "Pike"]);
  assert.deepEqual(t.recs, ["Perch", "Pike"]);
});

test("releasing the last fish takes it out of the creel but not off the day's count", () => {
  let t = startTrip(T0, 0);
  t = tripCatch(t, fish("Perch", 1.5), T0);
  t = tripCatch(t, fish("Pike", 4.25), T0);
  t = tripRelease(t, 4.25, T0 + 5);
  assert.equal(t.caught, 2);
  assert.equal(t.kept, 1);
  assert.equal(t.released, 1);
  assert.equal(t.keptLb, 1.5);
  assert.equal(t.totalLb, 5.8, "weight landed stays counted (5.75 rounds to 5.8)");
  assert.deepEqual(t.best?.n, "Pike", "the biggest fish was still the biggest");
  const empty = tripRelease(startTrip(T0, 0), 2, T0);
  assert.equal(empty.released, 0, "nothing to release from an empty creel");
  assert.equal(tripRelease(tripRelease(t, 1.5, T0), 9, T0).keptLb, 0, "the creel weight never goes below zero");
});

test("the creel line reads like a person said it", () => {
  assert.equal(creelLine(7, 22.4), "Creel today: 7 fish, 22.4 lb");
  assert.equal(creelLine(1, 3), "Creel today: 1 fish, 3.0 lb");
  assert.equal(creelLine(0, 0), "Creel today: empty");
});

test("finishing a trip stamps the end and the card has a headline, a creel line and a duration", () => {
  let t = startTrip(T0, 1, "dawn", 1);
  t = tripCatch(t, fish("Brown Trout", 3.4, { discovered: true }), T0 + 60_000);
  t = tripCatch(t, fish("Brown Trout", 3.9, { record: true }), T0 + 120_000);
  t = tripRelease(t, 3.9, T0 + 125_000);
  const done = finishTrip(t, T0 + 15 * 60_000);
  assert.equal(done.end, T0 + 15 * 60_000);
  assert.equal(tripMinutes(done), 15);
  const lines = tripCardLines({ trip: done, creelCount: 1, creelLb: 3.4 });
  assert.equal(lines.length, 3);
  assert.match(lines[0], /Caught 2, let 1 go\./);
  assert.match(lines[0], /Biggest: Brown Trout, 3\.9 lb\./);
  assert.match(lines[0], /1 new species\./);
  assert.match(lines[0], /1 personal best\./);
  assert.equal(lines[1], "Creel today: 1 fish, 3.4 lb");
  assert.equal(lines[2], "15 minutes on the water.");
  assert.equal(tripTitle(done), "River at dawn in the rain");
});

test("an empty trip says so kindly", () => {
  const done = finishTrip(startTrip(T0, 0), T0 + 20_000);
  assert.match(tripHeadline(done), /No bites this time/);
  assert.equal(tripCardLines({ trip: done, creelCount: 0, creelLb: 0 })[2], "Less than a minute on the water.");
});

test("titles say when and in what weather (and say nothing about weather you left to chance)", () => {
  assert.equal(tripTitle(startTrip(T0, 0, "night")), "Pond at night");
  assert.equal(tripTitle(startTrip(T0, 0, "day", 0)), "Pond in the daytime in the sun");
  assert.equal(tripTitle(startTrip(T0, 0, "dusk", 3)), "Pond at dusk in the fog");
  const real = tripTitle(startTrip(new Date(2026, 10, 2, 6, 30).getTime(), 0, "clock"));
  assert.equal(real, "Pond at dawn", "real time uses the clock the trip began at");
});

test("the logbook keeps the last 50, newest first", () => {
  let log: Trip[] = [];
  for (let i = 0; i < 60; i++) log = addTrip(log, finishTrip(startTrip(T0 + i * 1000, 0), T0 + i * 1000 + 1));
  assert.equal(log.length, MAX_TRIPS);
  assert.equal(log[0].start, T0 + 59 * 1000, "newest first");
  assert.equal(log[49].start, T0 + 10 * 1000, "the ten oldest fell off");
});

test("a trip left alone for half an hour is stale; a closed one never is", () => {
  const t = startTrip(T0, 0);
  assert.equal(tripIsStale(t, T0 + TRIP_IDLE_MS), false);
  assert.equal(tripIsStale(t, T0 + TRIP_IDLE_MS + 1), true);
  assert.equal(tripIsStale(finishTrip(t, T0 + 5), T0 + 99 * TRIP_IDLE_MS), false);
  assert.equal(tripIsStale(tripCatch(t, fish("a", 1), T0 + TRIP_IDLE_MS), T0 + TRIP_IDLE_MS + 5), false, "activity refreshes it");
});

test("picked times of day map to hours inside their own window", () => {
  for (const w of WINDOWS) assert.equal(windowOf(windowHour(w)), w, w);
  assert.equal(windowLabel("clock"), "Real time");
  assert.equal(windowLabel("dusk"), "Dusk");
  assert.equal(weatherLabel(-1), "Whatever comes");
  assert.equal(weatherLabel(2), "Storm");
});

test("the photo caption names the water, the fish if one is up, and the date", () => {
  const at = new Date(2026, 10, 2, 12);
  assert.equal(photoCaption({ water: 1, at }), "River · 2 Nov 2026");
  assert.equal(photoCaption({ water: 1, fish: { name: "Brown Trout", w: 3.44 }, at }), "River · Brown Trout, 3.4 lb · 2 Nov 2026");
  assert.equal(photoCaption({ water: 1, fish: null, at }), "River · 2 Nov 2026");
});

test("readTrip cleans hostile data and rejects non-trips", () => {
  for (const junk of [null, 5, "x", [], {}, { start: 0 }, { start: "now" }]) assert.equal(readTrip(junk), null);
  const t = readTrip({
    start: T0,
    end: -5,
    last: "never",
    water: 99,
    window: "midnight",
    weather: 40,
    caught: 3.6,
    kept: 99,
    released: 2,
    keptLb: -3,
    totalLb: Number.POSITIVE_INFINITY,
    best: { n: 5, w: 4.44, t: 99 },
    fresh: ["Perch", 7, "x".repeat(200)],
    recs: "nope",
  });
  assert.ok(t);
  assert.equal(t.end, 0);
  assert.equal(t.last, T0, "a bad last-activity time falls back to the start");
  assert.equal(t.water, 14);
  assert.equal(t.window, "clock");
  assert.equal(t.weather, 3);
  assert.equal(t.caught, 4);
  assert.equal(t.released, 2);
  assert.equal(t.kept, 2, "kept can never exceed caught minus released");
  assert.equal(t.keptLb, 0);
  assert.ok(Number.isFinite(t.totalLb));
  assert.deepEqual(t.best, { n: "Fish", w: 4.4, t: 4 });
  assert.deepEqual(t.fresh.map((x) => x.length), [5, 60]);
  assert.deepEqual(t.recs, []);
});

test("readTrips keeps only finished trips, at most 50, and survives junk", () => {
  const done = finishTrip(startTrip(T0, 0), T0 + 1);
  const open = startTrip(T0, 0);
  assert.equal(readTrips([done, open, null, 5]).length, 1, "the open trip is not a logbook entry");
  assert.equal(readTrips(new Array(80).fill(done)).length, MAX_TRIPS);
  for (const junk of [null, 5, "str", {}, undefined]) assert.deepEqual(readTrips(junk), []);
  const round = readTrips(JSON.parse(JSON.stringify([done])));
  assert.deepEqual(round, [done]);
});
