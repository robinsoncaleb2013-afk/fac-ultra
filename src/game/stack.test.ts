import assert from "node:assert/strict";
import test from "node:test";
import { noEvents, readEvents } from "./events.ts";
import {
  CALM_STACK,
  offerRestack,
  stackCatchXp,
  stackChance,
  stackIds,
  stackTitle,
  takeRestack,
  worthFactor,
  xpFactor,
} from "./stack.ts";
import { MUTATIONS } from "./content.ts";

test("stack chance falls with more mutations and floors at 1%", () => {
  assert.equal(stackChance(0), 0);
  assert.equal(stackChance(1), 0.25);
  assert.equal(stackChance(2), 0.2);
  assert.equal(stackChance(5), 0.05);
  assert.equal(stackChance(6), 0.04);
  assert.equal(stackChance(9), 0.01);
  assert.equal(stackChance(20), 0.01);
});

test("worth and XP bonuses add, they do not multiply", () => {
  /* Neon is 8x, Cosmic is 60x → 1 + 7 + 59 = 67x, not 480x. */
  assert.equal(worthFactor([3, 5]), 67);
  assert.equal(xpFactor([3, 5]), 1);
  assert.equal(worthFactor([]), 1);
});

test("stack title joins mutation names", () => {
  assert.equal(stackTitle([3, 1], "Perch"), "Neon Albino Perch");
  assert.equal(stackTitle([], "Perch"), "Perch");
});

test("stackIds ignores zero and de-dupes", () => {
  assert.deepEqual(stackIds({ m: 0 }), []);
  assert.deepEqual(stackIds({ m: 2, extra: [2, 3] }), [2, 3]);
});

test("offerRestack never arms for plain or boss fish", () => {
  const st = { ...noEvents(), seed: 1 };
  const plain = offerRestack(st, { b: 0, i: 1, m: 0, v: 10, w: 1, name: "Perch", boss: false });
  assert.equal(plain.armed, false);
  const boss = offerRestack(st, { b: 0, i: 1, m: 2, v: 10, w: 1, name: "Boss", boss: true });
  assert.equal(boss.armed, false);
});

test("some seeds arm a restack and takeRestack adds a mutation", () => {
  let armed = false;
  let state = { ...noEvents(), seed: 7 };
  const fish = { b: 0, i: 3, m: 2, v: 100, w: 2, name: "Golden Perch", boss: false };
  for (let d = 0; d < 80 && !armed; d++) {
    const r = offerRestack({ ...state, draws: d }, fish);
    if (r.armed) {
      armed = true;
      state = r.state;
    }
  }
  assert.ok(armed, "at least one seed should arm restack");
  assert.ok(state.restack);
  const taken = takeRestack(state, { ...fish, m: 0, name: "Other", v: 5 });
  assert.equal(taken.hit, true);
  assert.equal(taken.fish.b, 0);
  assert.equal(taken.fish.i, 3);
  assert.ok(stackIds(taken.fish).length >= 2);
  assert.equal(taken.state.restack, null);
  assert.ok(taken.fish.v >= 100);
});

test("Calm Down Man threshold is five mutations", () => {
  assert.equal(CALM_STACK, 5);
  assert.ok(MUTATIONS.length > CALM_STACK);
});

test("an armed restack survives a save round-trip, and junk becomes none", () => {
  let state = { ...noEvents(), seed: 7 };
  const fish = { b: 0, i: 3, m: 2, v: 100, w: 2, name: "Golden Perch", boss: false };
  for (let d = 0; d < 80 && !state.restack; d++) {
    const r = offerRestack({ ...state, draws: d }, fish);
    if (r.armed) state = r.state;
  }
  assert.ok(state.restack, "a restack is armed");
  const back = readEvents(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(back.restack, state.restack, "the saved restack reads back whole");
  const taken = takeRestack(back, { ...fish, m: 0, name: "Other", v: 5 });
  assert.equal(taken.hit, true, "the reloaded restack still lands on the next catch");
  assert.equal(readEvents({}).restack, null, "an old save with no restack field reads as none");
  assert.equal(readEvents({ restack: { b: 99, i: 0, ids: [1], v: 5, w: 1 } }).restack, null, "a water that does not exist is dropped");
  assert.equal(readEvents({ restack: { b: 0, i: 3, ids: [0, 0], v: 5, w: 1 } }).restack, null, "no real mutation, no restack");
});

test("stackCatchXp uses additive XP factors", () => {
  const base = stackCatchXp(0, [], 0, false);
  const withStarlight = stackCatchXp(0, [6], 0, false);
  assert.ok(withStarlight >= base);
});
