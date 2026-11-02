import assert from "node:assert/strict";
import test from "node:test";
import { computeEpoch, render, switchOf } from "./build-epoch.mjs";

const T = new Date(Date.UTC(2026, 10, 2, 18, 30, 45));

test("the epoch is the build time, with the commit in front when there is one", () => {
  assert.equal(computeEpoch({}, T), "20261102183045");
  assert.equal(computeEpoch({ VERCEL_GIT_COMMIT_SHA: "abcdef1234567" }, T), "abcdef1-20261102183045");
});

test("two builds a second apart differ", () => {
  assert.notEqual(computeEpoch({}, T), computeEpoch({}, new Date(T.getTime() + 1000)));
});

test("FAC_TEST_RESET_EPOCH forces an exact (cleaned) value", () => {
  assert.equal(computeEpoch({ FAC_TEST_RESET_EPOCH: " build-7 " }, T), "build-7");
});

test("the switch words", () => {
  assert.equal(switchOf("0"), false);
  assert.equal(switchOf("ON"), true);
  assert.equal(switchOf(""), null);
  assert.equal(switchOf("maybe"), null);
});

test("the generated file text carries both values", () => {
  const t = render("x1", false);
  assert.match(t, /BUILD_EPOCH: string = "x1"/);
  assert.match(t, /BUILD_SWITCH: boolean \| null = false/);
  assert.match(render("dev", null), /= null;/);
});
