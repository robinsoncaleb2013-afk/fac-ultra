import assert from "node:assert/strict";
import { test } from "node:test";
import {
  confettiFor,
  FpsMeter,
  governorStep,
  rainRingRate,
  rippleAmp,
  rippleDx,
  shouldSkipFrame,
  TIERS,
  tierDown,
  timeTint,
  wantsFanfare,
} from "./graphics.ts";
import { SUN_X, WATER_LINE, waterLineOf } from "./water.ts";

test("tier table matches the per-tier spec (09 §1.2)", () => {
  assert.deepEqual([TIERS.full.strip, TIERS.lite.strip, TIERS.mobile.strip], [2, 4, 6]);
  assert.deepEqual([TIERS.full.glints, TIERS.lite.glints, TIERS.mobile.glints], [40, 20, 12]);
  assert.deepEqual([TIERS.full.particles, TIERS.lite.particles, TIERS.mobile.particles], [90, 60, 30]);
  assert.deepEqual([TIERS.full.confetti, TIERS.lite.confetti, TIERS.mobile.confetti], [60, 40, 24]);
  assert.deepEqual([TIERS.full.swimmers, TIERS.lite.swimmers, TIERS.mobile.swimmers], [5, 5, 3]);
  assert.deepEqual([TIERS.full.rays, TIERS.lite.rays, TIERS.mobile.rays], [true, false, false]);
  assert.deepEqual([TIERS.full.plankton, TIERS.lite.plankton, TIERS.mobile.plankton], [true, false, false]);
  assert.equal(TIERS.mobile.rippleEvery, 2, "mobile ripples every other frame");
  assert.equal(TIERS.full.rippleEvery, 1);
  assert.equal(TIERS.mobile.waterOnly, true);
  assert.deepEqual([TIERS.full.art, TIERS.lite.art, TIERS.mobile.art], [1600, 1600, 800]);
  assert.equal(TIERS.mobile.dprCap, 1.5);
  assert.equal(TIERS.full.dprCap, 2);
  assert.equal(TIERS.mobile.swimmersThroughWater, false);
});

test("tiers only step down", () => {
  assert.equal(tierDown("full"), "lite");
  assert.equal(tierDown("lite"), "mobile");
  assert.equal(tierDown("mobile"), "mobile");
});

test("ripples grow toward the camera and scale with the weather", () => {
  assert.equal(rippleAmp(0, 0), 1.5);
  assert.equal(rippleAmp(1, 0), 7.5);
  assert.ok(rippleAmp(0.5, 2) > rippleAmp(0.5, 1));
  assert.ok(rippleAmp(0.5, 1) > rippleAmp(0.5, 0));
  assert.ok(rippleAmp(0.5, 3) < rippleAmp(0.5, 0), "fog calms the water");
  assert.equal(rippleAmp(1, 2), 7.5 * 1.9);
  assert.equal(rippleAmp(-3, 0), 1.5, "depth is clamped");
  assert.equal(rippleAmp(0.5, 0) * 1.3, rippleAmp(0.5, 1));
});

test("the ripple push stays small and moves with time", () => {
  const a = rippleDx(300, 0, 5);
  const b = rippleDx(300, 1, 5);
  assert.notEqual(a, b);
  assert.ok(Math.abs(a) <= 5 * 1.35 + 1e-9);
});

test("rain rings: a third of the rain rate, thinned on phones, none when dry", () => {
  assert.equal(rainRingRate(0, "full"), 0);
  assert.equal(rainRingRate(3, "full"), 0);
  assert.ok(Math.abs(rainRingRate(1, "full") - 28 / 3) < 1e-9);
  assert.ok(Math.abs(rainRingRate(2, "full") - 50 / 3) < 1e-9);
  assert.equal(rainRingRate(1, "mobile"), rainRingRate(1, "full") / 2);
});

test("time of day follows the clock windows", () => {
  assert.equal(timeTint(6, 0, true).color, "#ffb37a");
  assert.equal(timeTint(6, 0, true).alpha, 0.12);
  assert.equal(timeTint(12, 0, true).color, null);
  assert.equal(timeTint(17, 0, true).color, "#ff8c5a");
  assert.equal(timeTint(18.99, 0, true).alpha, 0.16);
  assert.equal(timeTint(19, 0, true).night, true);
  assert.equal(timeTint(23, 0, true).alpha, 0.32);
  assert.equal(timeTint(3, 0, true).color, "#0b1a33");
  assert.equal(timeTint(5, 0, true).night, false);
  assert.equal(timeTint(7, 0, true).color, null);
  assert.equal(timeTint(24.5, 0, true).night, true, "wraps past midnight");
});

test("20:00 in the rain is night", () => {
  const t = timeTint(20, 1, true);
  assert.equal(t.night, true);
  assert.equal(t.alpha, 0.32);
});

test("Follow the clock off means always day, except Night weather", () => {
  assert.equal(timeTint(23, 0, false).color, null);
  assert.equal(timeTint(23, 0, false).night, false);
  assert.equal(timeTint(12, 4, false).night, true, "Night weather forces the night window");
  assert.equal(timeTint(12, 4, true).night, true);
});

test("fps meter averages the last 60 frames", () => {
  const m = new FpsMeter();
  assert.equal(m.full, false);
  for (let i = 0; i < 60; i++) m.push(1 / 30);
  assert.equal(m.full, true);
  assert.ok(Math.abs(m.fps - 30) < 1e-3);
  for (let i = 0; i < 60; i++) m.push(1 / 60);
  assert.ok(Math.abs(m.fps - 60) < 1e-2, "old frames fall out");
  m.reset();
  assert.equal(m.full, false);
});

test("governor steps down after 3 s under 45 fps, once, and never up", () => {
  let gov = { lowFor: 0 };
  let tier: "full" | "lite" | "mobile" = "full";
  let steps = 0;
  for (let i = 0; i < 400; i++) {
    const r = governorStep(gov, { fps: 30, dt: 1 / 30, ready: true, pinned: false, tier });
    gov = r.gov;
    if (r.down) {
      tier = r.down;
      steps++;
      if (steps === 1) assert.ok(i >= 89 && i <= 91, `first step near 3 s (frame ${i})`);
    }
  }
  assert.equal(tier, "mobile", "keeps stepping while slow, then stops at the bottom");
  assert.equal(steps, 2);
  const up = governorStep({ lowFor: 0 }, { fps: 120, dt: 0.01, ready: true, pinned: false, tier: "lite" });
  assert.equal(up.down, null);
});

test("governor: a recovery resets the timer, a pin disables it, and it waits for a full meter", () => {
  let gov = { lowFor: 0 };
  gov = governorStep(gov, { fps: 30, dt: 2, ready: true, pinned: false, tier: "full" }).gov;
  assert.equal(gov.lowFor, 2);
  gov = governorStep(gov, { fps: 60, dt: 0.5, ready: true, pinned: false, tier: "full" }).gov;
  assert.equal(gov.lowFor, 0);
  assert.equal(governorStep({ lowFor: 5 }, { fps: 10, dt: 1, ready: true, pinned: true, tier: "full" }).down, null);
  assert.equal(governorStep({ lowFor: 5 }, { fps: 10, dt: 1, ready: false, pinned: false, tier: "full" }).down, null);
  assert.equal(governorStep({ lowFor: 5 }, { fps: 10, dt: 1, ready: true, pinned: false, tier: "mobile" }).down, null);
});

test("mobile drops to 30 fps only after a quiet minute with no cast", () => {
  assert.equal(shouldSkipFrame("mobile", 59_000, "idle", 1), false);
  assert.equal(shouldSkipFrame("mobile", 60_000, "idle", 1), true);
  assert.equal(shouldSkipFrame("mobile", 60_000, "idle", 2), false);
  assert.equal(shouldSkipFrame("mobile", 90_000, "wait", 1), false);
  assert.equal(shouldSkipFrame("full", 90_000, "idle", 1), false);
});

test("confetti only for rare and up, counted by tier", () => {
  assert.equal(confettiFor("full", 1), 0);
  assert.equal(confettiFor("full", 2), 60);
  assert.equal(confettiFor("lite", 4), 40);
  assert.equal(confettiFor("mobile", 3), 24);
});

test("the brass fanfare is for epic catches, new species and bosses", () => {
  const c = { rarity: 0, discovered: false, record: false, boss: false, perfect: false };
  assert.equal(wantsFanfare(c), false);
  assert.equal(wantsFanfare({ ...c, rarity: 3 }), true);
  assert.equal(wantsFanfare({ ...c, discovered: true }), true);
  assert.equal(wantsFanfare({ ...c, boss: true }), true);
});

test("every one of the 15 waters has a waterline and a sun position", () => {
  assert.equal(WATER_LINE.length, 15);
  assert.equal(SUN_X.length, 15);
  for (const v of [...WATER_LINE, ...SUN_X]) assert.ok(v > 0 && v < 1);
  assert.equal(waterLineOf(99), 0.5);
  assert.equal(WATER_LINE[0], 0.52);
  assert.equal(WATER_LINE[13], 0.6);
});
