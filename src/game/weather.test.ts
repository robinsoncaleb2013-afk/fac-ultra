import assert from "node:assert/strict";
import { test } from "node:test";
import { makeRng } from "./rng.ts";
import { stationary, weatherAt, WEATHER_STEP_MS, WX_MATRIX } from "./weather.ts";

test("the matrix rows are probabilities and every sky keeps itself 70% of the time", () => {
  WX_MATRIX.forEach((row, i) => {
    assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.equal(row[i], 0.7);
  });
});

test("weatherAt is a pure function of the seed and the time", () => {
  for (const seed of [1, 99, 4_000_000_000]) {
    for (const ms of [0, 1, WEATHER_STEP_MS - 1, WEATHER_STEP_MS, 7 * WEATHER_STEP_MS + 5, 86_400_000]) {
      assert.equal(weatherAt(seed, ms), weatherAt(seed, ms));
    }
  }
  assert.equal(weatherAt(5, -1000), weatherAt(5, 0), "before the start is the start");
});

test("the sky only changes on five-minute steps", () => {
  const seed = 31337;
  for (let step = 0; step < 50; step++) {
    const a = weatherAt(seed, step * WEATHER_STEP_MS);
    assert.equal(weatherAt(seed, step * WEATHER_STEP_MS + WEATHER_STEP_MS - 1), a);
  }
});

test("over thousands of events the weather follows the stationary distribution within 5%", () => {
  const want = stationary();
  const counts = [0, 0, 0, 0];
  const total = 10_000;
  /* Many short, independent events (different seeds) sampled at a spread of times. */
  const pick = makeRng(7);
  for (let n = 0; n < total; n++) {
    const seed = (pick() * 4294967296) >>> 0;
    counts[weatherAt(seed, Math.floor(pick() * 60) * WEATHER_STEP_MS)]++;
  }
  counts.forEach((c, i) => assert.ok(Math.abs(c / total - want[i]) < 0.05, `state ${i}: ${c / total} vs ${want[i]}`));
});

test("one long event spends its time close to the stationary distribution too", () => {
  const want = stationary();
  const counts = [0, 0, 0, 0];
  const steps = 10_000;
  /* Walk a single chain by asking for each step (20,000 steps is the cap weatherAt allows). */
  for (let k = 0; k < steps; k += 1) counts[weatherAt(2026, k * WEATHER_STEP_MS)]++;
  counts.forEach((c, i) => assert.ok(Math.abs(c / steps - want[i]) < 0.05, `state ${i}: ${c / steps} vs ${want[i]}`));
});
