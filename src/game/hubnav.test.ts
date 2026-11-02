import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_PAD,
  freshPad,
  heldDirs,
  hubTargetFor,
  keyAction,
  PAD,
  padEvents,
  REPEAT_FIRST_MS,
  REPEAT_MS,
  resolveNav,
  stepIndex,
  tabsForMode,
  wheelSlice,
  type PadSnap,
} from "./hubnav.ts";

test("keys: arrows and WASD, Q and E for tabs, Enter, Esc", () => {
  assert.equal(keyAction("ArrowUp"), "up");
  assert.equal(keyAction("KeyS"), "down");
  assert.equal(keyAction("KeyA"), "left");
  assert.equal(keyAction("ArrowRight"), "right");
  assert.equal(keyAction("KeyQ"), "prevTab");
  assert.equal(keyAction("KeyE"), "nextTab");
  assert.equal(keyAction("Enter"), "select");
  assert.equal(keyAction("Escape"), "close");
  assert.equal(keyAction("KeyZ"), null);
});

test("left and right move the tab strip, or the cards in the Play tab; Q and E always change tab", () => {
  assert.deepEqual(resolveNav("right", { horizontal: false, inDetail: false }), { tab: 1 });
  assert.deepEqual(resolveNav("right", { horizontal: true, inDetail: false }), { item: 1 });
  assert.deepEqual(resolveNav("nextTab", { horizontal: true, inDetail: false }), { tab: 1 });
  assert.deepEqual(resolveNav("up", { horizontal: false, inDetail: false }), { item: -1 });
});

test("Esc backs out of a full-screen detail first, then closes", () => {
  assert.deepEqual(resolveNav("close", { horizontal: false, inDetail: true }), { back: true });
  assert.deepEqual(resolveNav("close", { horizontal: false, inDetail: false }), { close: true });
  assert.deepEqual(resolveNav("back", { horizontal: false, inDetail: false }), {});
});

test("stepIndex stops at the ends, or wraps", () => {
  assert.equal(stepIndex(0, -1, 5), 0);
  assert.equal(stepIndex(4, 1, 5), 4);
  assert.equal(stepIndex(4, 1, 5, true), 0);
  assert.equal(stepIndex(0, -1, 5, true), 4);
  assert.equal(stepIndex(0, 1, 0), 0);
});

test("modes show the right tabs", () => {
  assert.deepEqual(tabsForMode("expedition"), ["play", "tackle", "lodge", "waters", "players", "settings"]);
  assert.ok(!tabsForMode("tournament").includes("tackle"), "event gear is fixed");
  assert.ok(!tabsForMode("tournament").includes("waters"));
  assert.ok(!tabsForMode("survival").includes("waters"), "no travel in Survival");
  assert.ok(tabsForMode("survival").includes("tackle"), "the camp lives there");
});

test("every old panel name lands somewhere in the Hub", () => {
  assert.equal(hubTargetFor("cast", "record"), null);
  assert.deepEqual(hubTargetFor("gear", "record"), { tab: "tackle", item: "rod" });
  assert.deepEqual(hubTargetFor("lures", "record"), { tab: "tackle", item: "box" });
  assert.deepEqual(hubTargetFor("bag", "record"), { tab: "tackle", item: "satchel" });
  assert.deepEqual(hubTargetFor("camp", "record"), { tab: "tackle", item: "camp" });
  assert.deepEqual(hubTargetFor("waters", "record"), { tab: "waters" });
  assert.deepEqual(hubTargetFor("dex", "record"), { tab: "lodge", item: "book" });
  assert.deepEqual(hubTargetFor("lodge", "tank"), { tab: "lodge", item: "tank" });
  assert.deepEqual(hubTargetFor("lodge", "settings"), { tab: "settings" });
});

const snap = (buttons: number[] = [], axes: number[] = []): PadSnap => {
  const b: boolean[] = [];
  for (const i of buttons) b[i] = true;
  return { buttons: b, axes };
};

test("gamepad: buttons fire once on press, bumpers change tab, Start toggles the Hub", () => {
  let mem = freshPad();
  let r = padEvents(mem, snap([PAD.A]), 0);
  assert.deepEqual(r.events, ["select"]);
  mem = r.mem;
  r = padEvents(mem, snap([PAD.A]), 50);
  assert.deepEqual(r.events, [], "holding A does not repeat");
  mem = r.mem;
  r = padEvents(mem, snap([PAD.RB, PAD.START]), 100);
  assert.deepEqual(r.events, ["nextTab", "toggleHub"]);
  r = padEvents(freshPad(), snap([PAD.LB]), 0);
  assert.deepEqual(r.events, ["prevTab"]);
  r = padEvents(freshPad(), snap([PAD.B]), 0);
  assert.deepEqual(r.events, ["close"]);
});

test("gamepad: a held direction repeats after a pause, then steadily", () => {
  let mem = freshPad();
  const fired: number[] = [];
  for (let t = 0; t <= 1000; t += 10) {
    const r = padEvents(mem, snap([PAD.DOWN]), t);
    mem = r.mem;
    if (r.events.includes("down")) fired.push(t);
  }
  assert.equal(fired[0], 0);
  assert.ok(fired[1] >= REPEAT_FIRST_MS && fired[1] < REPEAT_FIRST_MS + 20);
  assert.ok(fired[2] - fired[1] >= REPEAT_MS && fired[2] - fired[1] < REPEAT_MS + 20);
  const r = padEvents(mem, EMPTY_PAD, 1010);
  assert.deepEqual(r.mem.held, {}, "letting go forgets the hold");
});

test("gamepad: the stick counts past its dead zone only; triggers open and close the wheel", () => {
  assert.deepEqual(heldDirs({ buttons: [], axes: [0.3, -0.3] }), []);
  assert.deepEqual(heldDirs({ buttons: [], axes: [0.9, -0.8] }), ["up", "right"]);
  let r = padEvents(freshPad(), snap([PAD.LT]), 0);
  assert.deepEqual(r.events, ["wheelDown"]);
  r = padEvents(r.mem, EMPTY_PAD, 20);
  assert.deepEqual(r.events, ["wheelUp"]);
  r = padEvents(freshPad(), snap([PAD.Y]), 0);
  assert.deepEqual(r.events, ["satchelDown"]);
});

test("wheel: slices go clockwise from straight up, with a dead zone in the middle", () => {
  assert.equal(wheelSlice(0, -100, 8), 0);
  assert.equal(wheelSlice(100, 0, 8), 2);
  assert.equal(wheelSlice(0, 100, 8), 4);
  assert.equal(wheelSlice(-100, 0, 8), 6);
  assert.equal(wheelSlice(70, -70, 8), 1);
  assert.equal(wheelSlice(3, 3, 8), -1);
  assert.equal(wheelSlice(0, -100, 0), -1);
  assert.equal(wheelSlice(0, -100, 4), 0);
  assert.equal(wheelSlice(100, 5, 4), 1);
});
