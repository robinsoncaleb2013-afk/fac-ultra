/* The graphics levels and the governor, driven by simulated frame times (docs/architecture/09 §1.4). */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  autoCeiling,
  defaultLevel,
  LEVEL_TIER,
  LEVELS,
  levelDown,
  levelUp,
  normPref,
  readDeviceSettings,
  resolveLevel,
  type Form,
  type Level,
} from "./device.ts";
import {
  freshGovernor,
  FpsMeter,
  governorStep,
  GOV_SECONDS,
  levelCapFromRenderer,
  levelFromFps,
  levelFromProbe,
  setActiveLevel,
  tierSpec,
  TIERS,
  UP_SECONDS,
  type Governor,
} from "./graphics.ts";

/** Play `seconds` of frames at `frame` seconds each through the governor and the meter, like the stage does. */
function run(
  start: { level: Level; form: Form; pinned?: boolean; gov?: Governor },
  frames: Array<[seconds: number, frame: number]>,
) {
  let level = start.level;
  let gov = start.gov ?? freshGovernor();
  const meter = new FpsMeter();
  const changes: Array<{ at: number; to: Level; why: string | null }> = [];
  let t = 0;
  for (const [seconds, frame] of frames) {
    const n = Math.round(seconds / frame);
    for (let i = 0; i < n; i++) {
      t += frame;
      meter.push(frame);
      const r = governorStep(gov, { fps: meter.fps, dt: frame, ready: meter.full, pinned: !!start.pinned, level, form: start.form });
      gov = r.gov;
      if (r.change) {
        meter.reset();
        level = r.change;
        changes.push({ at: t, to: r.change, why: r.why });
      }
    }
  }
  return { level, gov, changes };
}

test("the five levels map onto the three tiers", () => {
  assert.deepEqual(LEVELS, ["ultra", "high", "medium", "low", "potato"]);
  assert.deepEqual(LEVELS.map((l) => LEVEL_TIER[l]), ["full", "full", "lite", "mobile", "mobile"]);
  assert.equal(levelDown("potato"), "potato");
  assert.equal(levelUp("ultra"), "ultra");
  assert.equal(levelDown("high"), "medium");
});

test("old saved names still mean something", () => {
  assert.equal(normPref("full"), "ultra");
  assert.equal(normPref("lite"), "medium");
  assert.equal(normPref("mobile"), "low");
  assert.equal(normPref("potato"), "potato");
  assert.equal(normPref("auto"), "auto");
  assert.equal(normPref("turbo"), null);
  assert.equal(normPref(7), null);
  assert.equal(readDeviceSettings({ gfx: "lite" }).gfx, "medium");
  assert.equal(readDeviceSettings({ gfx: "nonsense" }).gfx, undefined);
});

test("a measured frame rate earns a level; the GPU name can only hold it back", () => {
  assert.equal(levelFromFps(60), "ultra");
  assert.equal(levelFromFps(50), "high");
  assert.equal(levelFromFps(40), "medium");
  assert.equal(levelFromFps(25), "low");
  assert.equal(levelFromFps(10), "potato");
  assert.equal(levelCapFromRenderer("ANGLE (NVIDIA GeForce RTX 4070 Ti)"), "ultra");
  assert.equal(levelCapFromRenderer("Google SwiftShader"), "low");
  assert.equal(levelCapFromRenderer("ANGLE (Intel, Intel(R) UHD Graphics 620)"), "high");
  assert.equal(levelCapFromRenderer(null), "ultra");
  assert.equal(levelFromProbe(60, "ANGLE (NVIDIA GeForce GTX 1080)"), "ultra", "the GPU name does not lower a machine that is fast");
  assert.equal(levelFromProbe(60, "llvmpipe"), "low", "software drawing is held back");
  assert.equal(levelFromProbe(20, "ANGLE (NVIDIA GeForce RTX 4090)"), "potato", "a slow measurement beats a proud GPU name");
});

test("Auto start: PCs follow the speed test, phones and tablets only go lower", () => {
  assert.equal(resolveLevel("auto", "desktop", undefined, undefined, "high"), "high");
  assert.equal(resolveLevel("auto", "desktop"), "ultra");
  assert.equal(resolveLevel("auto", "phone", 4, 8, "ultra"), "low", "a phone never starts above Low");
  assert.equal(resolveLevel("auto", "phone", 4, 8, "potato"), "potato");
  assert.equal(resolveLevel("auto", "tablet", 8, 8, "ultra"), "medium");
  assert.equal(resolveLevel("ultra", "phone"), "ultra", "a pinned level is respected anywhere");
  assert.equal(defaultLevel("phone"), "low");
  assert.equal(autoCeiling("phone"), "low");
});

test("slow frames step down quickly: three seconds under 45 fps, one level at a time", () => {
  const first = run({ level: "ultra", form: "desktop" }, [[1, 1 / 60], [10, 1 / 25]]);
  assert.ok(first.changes.length >= 1);
  assert.equal(first.changes[0].to, "high");
  assert.equal(first.changes[0].why, "slow");
  /* the meter needs 60 frames before it is trusted (2.4 s at 25 fps), and then the 3 s of low frames count */
  assert.ok(first.changes[0].at < 1 + 2.5 + GOV_SECONDS + 0.2, `stepped at ${first.changes[0].at}`);
  /* it keeps going while slow, and stops at the floor */
  const floor = run({ level: "high", form: "desktop" }, [[120, 1 / 12]]);
  assert.equal(floor.level, "potato");
  assert.deepEqual(floor.changes.map((c) => c.to), ["medium", "low", "potato"]);
});

test("a short stutter does not step down", () => {
  const r = run({ level: "ultra", form: "desktop" }, [[5, 1 / 60], [1.5, 1 / 20], [20, 1 / 60]]);
  assert.equal(r.changes.length, 0);
  assert.equal(r.level, "ultra");
});

test("slow step-up: about 30 s of smooth play, one level, once per session", () => {
  const r = run({ level: "medium", form: "desktop" }, [[29, 1 / 60]]);
  assert.equal(r.changes.length, 0, "not yet at 29 s");
  const up = run({ level: "medium", form: "desktop" }, [[40, 1 / 60]]);
  assert.equal(up.changes.length, 1);
  assert.equal(up.changes[0].to, "high");
  assert.equal(up.changes[0].why, "smooth");
  assert.ok(up.changes[0].at >= UP_SECONDS && up.changes[0].at < UP_SECONDS + 3, `stepped up at ${up.changes[0].at}`);
  /* a long smooth stretch never steps up twice */
  const long = run({ level: "low", form: "desktop" }, [[200, 1 / 60]]);
  assert.equal(long.changes.filter((c) => c.why === "smooth").length, 1);
  assert.equal(long.level, "medium");
});

test("step-up is not allowed after a manual pin, even if Auto comes back", () => {
  const pinned = run({ level: "medium", form: "desktop", pinned: true }, [[60, 1 / 60]]);
  assert.equal(pinned.changes.length, 0);
  assert.equal(pinned.gov.pinnedEver, true);
  const back = run({ level: "medium", form: "desktop", gov: pinned.gov }, [[90, 1 / 60]]);
  assert.equal(back.changes.length, 0, "the player chose; we stay out of it");
  /* but a step down still protects a choppy game */
  const choppy = run({ level: "medium", form: "desktop", gov: pinned.gov }, [[10, 1 / 20]]);
  assert.ok(choppy.changes.length >= 1);
  assert.equal(choppy.changes[0].why, "slow");
});

test("step-up never passes what a device kind may use", () => {
  const phone = run({ level: "low", form: "phone" }, [[120, 1 / 60]]);
  assert.equal(phone.changes.length, 0, "a phone on Low stays on Low");
  const tablet = run({ level: "low", form: "tablet" }, [[60, 1 / 60]]);
  assert.equal(tablet.level, "medium");
  const tablet2 = run({ level: "medium", form: "tablet" }, [[120, 1 / 60]]);
  assert.equal(tablet2.changes.length, 0);
  const pc = run({ level: "ultra", form: "desktop" }, [[120, 1 / 60]]);
  assert.equal(pc.changes.length, 0);
});

test("a janky stretch resets the smooth timer", () => {
  const r = run({ level: "medium", form: "desktop" }, [[20, 1 / 60], [3, 1 / 50], [20, 1 / 60]]);
  assert.equal(r.changes.length, 0, "20 s + a wobble + 20 s is not 30 s of smooth");
});

test("the levels that share a tier differ by a small trim", () => {
  setActiveLevel("ultra");
  assert.equal(tierSpec("full"), TIERS.full);
  setActiveLevel("high");
  assert.ok(tierSpec("full").glints < TIERS.full.glints);
  assert.equal(tierSpec("full").rays, true);
  assert.equal(tierSpec("lite"), TIERS.lite, "the trim only applies to its own tier");
  setActiveLevel("low");
  assert.equal(tierSpec("mobile"), TIERS.mobile);
  setActiveLevel("potato");
  assert.ok(tierSpec("mobile").particles < TIERS.mobile.particles);
  assert.ok(tierSpec("mobile").rippleEvery > TIERS.mobile.rippleEvery);
  setActiveLevel("ultra");
});
