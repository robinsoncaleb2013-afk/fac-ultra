/* The cloud-save rule book (docs/architecture/07 §4.2): when to push, pull, or ask the player. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { changeKey, decideSync, describe, fingerprint, hasProgress, newerOf, summarize, type Summary } from "./cloud.ts";
import { fresh, sanitize, snapshot } from "./engine.ts";
import { money } from "./content.ts";

const S = (caught: number, tot: number, c = 0): Summary => ({ caught, tot, c, lv: 1, species: caught ? 1 : 0 });
const base = { cloudRev: 3, syncedRev: 3, localChanged: false };

test("nothing to sync: both empty, or the cloud has nothing and this device is new", () => {
  assert.equal(decideSync({ ...base, local: null, cloud: null, cloudRev: 0, syncedRev: 0 }), "none");
  assert.equal(decideSync({ ...base, local: S(0, 0), cloud: null, cloudRev: 0, syncedRev: 0 }), "none");
});

test("first sign-in: a played device with an empty cloud pushes; an empty device with a cloud save pulls", () => {
  assert.equal(decideSync({ ...base, local: S(10, 100), cloud: null, cloudRev: 0, syncedRev: 0 }), "push");
  assert.equal(decideSync({ ...base, local: S(0, 0), cloud: S(10, 100), syncedRev: 0 }), "pull");
  assert.equal(decideSync({ ...base, local: null, cloud: S(10, 100), syncedRev: 0 }), "pull");
});

test("in step: only this device changed -> push; nobody changed -> nothing", () => {
  assert.equal(decideSync({ ...base, local: S(10, 100), cloud: S(10, 100), localChanged: true }), "push");
  assert.equal(decideSync({ ...base, local: S(10, 100), cloud: S(10, 100) }), "none");
});

test("another device moved the cloud on and this one is untouched -> pull (never the other way round silently)", () => {
  assert.equal(decideSync({ ...base, cloudRev: 5, local: S(10, 100), cloud: S(30, 400) }), "pull");
  /* the cloud went DOWN in both counts (someone erased it): we ask rather than throw this device's fish away */
  assert.equal(decideSync({ ...base, cloudRev: 5, local: S(30, 400), cloud: S(2, 10) }), "choose");
});

test("both sides changed: the one that has everything wins; if each has something the other lacks, ask", () => {
  const both = { ...base, cloudRev: 5, localChanged: true };
  assert.equal(decideSync({ ...both, local: S(10, 100), cloud: S(30, 400) }), "pull");
  assert.equal(decideSync({ ...both, local: S(30, 400), cloud: S(10, 100) }), "push");
  assert.equal(decideSync({ ...both, local: S(212, 48_000), cloud: S(198, 51_000) }), "choose");
});

test("a device that never synced meets a cloud save: same counts means nothing to ask; different means ask", () => {
  const fresh0 = { ...base, cloudRev: 4, syncedRev: 0, localChanged: true };
  assert.equal(decideSync({ ...fresh0, local: S(10, 100, 5), cloud: S(10, 100, 5) }), "none");
  assert.equal(decideSync({ ...fresh0, local: S(10, 100, 5), cloud: S(10, 100, 9) }), "choose");
  assert.equal(decideSync({ ...fresh0, local: S(50, 900), cloud: S(10, 100) }), "push");
  assert.equal(decideSync({ ...fresh0, local: S(5, 900), cloud: S(10, 100) }), "choose");
});

test("summaries describe real saves and read junk as empty", () => {
  assert.deepEqual(summarize("expedition", null), { caught: 0, tot: 0, c: 0, lv: 0, species: 0 });
  assert.equal(hasProgress(summarize("expedition", fresh())), false);
  const played = sanitize({ ...snapshot(fresh()), caught: 212, tot: 9e6, c: 48_000, lv: 12, dex: { "0-0": { c: 3, w: 1 }, "0-1": { c: 1, w: 2 } } });
  const s = summarize("recreational", played);
  assert.deepEqual([s.caught, s.c, s.lv, s.species], [212, 48_000, 12, 2]);
  assert.equal(describe(s, money, "expedition"), `212 fish, ${money(48_000)}`);
  const sv = summarize("survival", { dex: { "0-0": { c: 4 } }, history: [{}, {}] });
  assert.deepEqual([sv.caught, sv.tot, sv.species], [4, 2, 1]);
  assert.match(describe(sv, money, "survival"), /1 kinds of fish, 2 runs/);
});

test("keep the newer one, and the change fingerprint ignores the Aquarium clock", () => {
  assert.equal(newerOf(2000, 1000), "device");
  assert.equal(newerOf(1000, 2000), "cloud");
  assert.equal(newerOf(1000, 1000), "cloud");
  assert.equal(fingerprint("a"), fingerprint("a"));
  assert.notEqual(fingerprint("a"), fingerprint("b"));
  const a = snapshot(fresh());
  assert.equal(changeKey(a), changeKey({ ...a, tank: { ...a.tank, at: 12345 } }));
  assert.notEqual(changeKey(a), changeKey({ ...a, c: a.c + 1 }));
});
