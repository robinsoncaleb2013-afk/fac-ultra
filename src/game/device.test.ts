import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultGfx,
  layoutOf,
  mobileWaterHeight,
  overlayDevice,
  peekCollapsed,
  pickForm,
  readDeviceSettings,
  resolveGfx,
} from "./device.ts";

test("a 390×844 touch phone is a phone on the mobile tier", () => {
  const form = pickForm(true, 390, 844);
  assert.equal(form, "phone");
  assert.equal(defaultGfx(form, 4, 8), "mobile");
});

test("a 1440×900 mouse screen is a desktop on the full tier", () => {
  const form = pickForm(false, 1440, 900);
  assert.equal(form, "desktop");
  assert.equal(defaultGfx(form), "full");
});

test("a 1024×768 touch tablet with a healthy chip is a tablet on the lite tier", () => {
  const form = pickForm(true, 1024, 768);
  assert.equal(form, "tablet");
  assert.equal(defaultGfx(form, 8, 8), "lite");
  assert.equal(defaultGfx(form, 2, 4), "mobile", "a weak tablet drops to mobile");
  assert.equal(defaultGfx(form), "mobile", "unknown memory and 4 cores is cautious");
});

test("form uses the short side, so rotating a phone does not make it a tablet", () => {
  assert.equal(pickForm(true, 844, 390), "phone");
  assert.equal(pickForm(true, 599, 1200), "phone");
  assert.equal(pickForm(true, 600, 1200), "tablet");
});

test("a pinned tier beats the device default; auto follows it", () => {
  assert.equal(resolveGfx("ultra", "phone"), "full");
  assert.equal(resolveGfx("medium", "desktop"), "lite");
  assert.equal(resolveGfx("auto", "phone"), "mobile");
  assert.equal(resolveGfx("auto", "desktop"), "full");
});

test("layouts: desktop, landscape phone, big tablet and portrait phone", () => {
  assert.equal(layoutOf("desktop", 1440, 900).kind, "desktop");
  assert.equal(layoutOf("desktop", 1440, 900).railCollapsed, false);
  const land = layoutOf("phone", 844, 390);
  assert.equal(land.kind, "desktop");
  assert.equal(land.railCollapsed, true);
  assert.equal(land.drawerWidth, "60%");
  assert.equal(layoutOf("tablet", 1024, 768).kind, "desktop", "a big iPad on its side is a small PC");
  assert.equal(layoutOf("tablet", 900, 700).kind, "mobile", "a small tablet on its side keeps the column");
  assert.equal(layoutOf("tablet", 768, 1024).kind, "mobile");
  assert.equal(layoutOf("tablet", 768, 1024).twoColumns, true);
  const portrait = layoutOf("phone", 390, 844);
  assert.equal(portrait.kind, "mobile");
  assert.equal(portrait.twoColumns, false);
  assert.equal(portrait.bigRing, true);
});

test("mobile water is 52% of the screen (48% on tablets), kept between 280 and 480 px", () => {
  assert.equal(mobileWaterHeight(844, false), 439);
  assert.equal(mobileWaterHeight(400, false), 280);
  assert.equal(mobileWaterHeight(1400, false), 480);
  assert.equal(mobileWaterHeight(1024, true), 480);
});

test("the water shrinks to a peek strip after 40% of the panel has scrolled", () => {
  assert.equal(peekCollapsed(0, 500), false);
  assert.equal(peekCollapsed(200, 500), false);
  assert.equal(peekCollapsed(201, 500), true);
  assert.equal(peekCollapsed(100, 0), false);
});

test("device settings: a pinned tier survives a reload and beats the per-mode save", () => {
  const stored = JSON.parse(JSON.stringify({ gfx: "medium", sound: false, motion: true, flash: false, followClock: false, kid: true, volume: 20, cb: true }));
  const device = readDeviceSettings(stored);
  const modeSave = { gfx: "auto" as const, sound: true, motion: true, flash: true, followClock: true, kid: false, volume: 35, cb: false };
  assert.deepEqual(overlayDevice(modeSave, device), stored);
});

test("device settings: junk is ignored field by field", () => {
  assert.deepEqual(readDeviceSettings(null), {});
  assert.deepEqual(readDeviceSettings("x"), {});
  assert.deepEqual(readDeviceSettings({ gfx: "turbo", sound: "yes", motion: false }), { motion: false });
});
