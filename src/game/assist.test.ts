import assert from "node:assert/strict";
import { test } from "node:test";
import { fightHelp, helpingHand, HELP_SHOWN, isHelping } from "./assist.ts";

const base = { assist: true, misses: 0, failedFights: 0, wins: 0 };

test("a fresh start gets no help", () => {
  const h = helpingHand(base);
  assert.equal(h.zoneBonus, 0);
  assert.equal(h.speedFactor, 1);
  assert.equal(h.biteBonus, 0);
});

test("two misses widen the band by 6 points and slow the mark", () => {
  const h = helpingHand({ ...base, misses: 2 });
  assert.equal(h.missStreak, 2);
  assert.equal(h.zoneBonus, 6);
  assert.ok(Math.abs(h.speedFactor - 0.86) < 1e-9);
  assert.equal(h.biteBonus, 0.5);
});

test("a lost fight counts as two misses", () => {
  const h = helpingHand({ ...base, failedFights: 1 });
  assert.equal(h.missStreak, 2);
  assert.equal(h.zoneBonus, 6);
  assert.equal(helpingHand({ ...base, failedFights: 2, misses: 1 }).missStreak, 5);
});

test("help is capped: +14 points, mark never slower than 60%, bite window +1.2 s", () => {
  const h = helpingHand({ ...base, misses: 40 });
  assert.equal(h.zoneBonus, 14);
  assert.equal(h.speedFactor, 0.6);
  assert.equal(h.biteBonus, 1.2);
});

test("a winning streak tightens things a little, never past -4 points or 1.1x speed", () => {
  const h = helpingHand({ ...base, wins: 10 });
  assert.equal(h.zoneBonus, -4);
  assert.equal(h.speedFactor, 1.1);
  assert.equal(helpingHand({ ...base, wins: 2 }).zoneBonus, -3);
});

test("misses and wins offset each other", () => {
  assert.equal(helpingHand({ ...base, misses: 3, wins: 2 }).zoneBonus, 9 - 3);
});

test("switched off, nothing changes whatever the streaks are", () => {
  const h = helpingHand({ assist: false, misses: 9, failedFights: 3, wins: 0 });
  assert.equal(h.zoneBonus, 0);
  assert.equal(h.speedFactor, 1);
  assert.equal(h.biteBonus, 0);
  assert.equal(h.missStreak, 15, "the streak is still reported");
});

test("negative inputs are treated as zero", () => {
  assert.equal(helpingHand({ ...base, misses: -5, failedFights: -1, wins: -2 }).zoneBonus, 0);
});

/* ── In the tension fight (04 §5.6) ──────────────────────────────────────── */

test("switched off, there is no fight help at all", () => {
  assert.equal(fightHelp({ assist: false, misses: 9, failedFights: 4, wins: 0 }), null);
  assert.equal(isHelping(null), false);
});

test("a fresh start gets moderate help, and the glow shows", () => {
  const h = fightHelp(base)!;
  assert.ok(Math.abs(h.strength - 0.4) < 1e-9);
  assert.equal(h.pullMul, 1);
  assert.equal(isHelping(h), true);
});

test("losing more makes the help stronger, up to the widest green; winning fades it", () => {
  const s = (over: Partial<typeof base>) => fightHelp({ ...base, ...over })!.strength;
  assert.ok(s({ misses: 2 }) > s({}));
  assert.ok(s({ failedFights: 2 }) > s({ failedFights: 1 }));
  assert.equal(s({ misses: 50 }), 1);
  assert.ok(s({ wins: 2 }) < s({}));
  assert.ok(s({ wins: 50 }) >= 0.15, "never quite nothing while it is switched on");
});

test("after a couple of wins the glow and the 'helping hand' line go away", () => {
  assert.equal(isHelping(fightHelp({ ...base, wins: 1 })), true);
  assert.equal(isHelping(fightHelp({ ...base, wins: 2 })), false);
  assert.ok(fightHelp({ ...base, wins: 2 })!.strength < HELP_SHOWN);
  assert.equal(isHelping(fightHelp({ ...base, wins: 2, misses: 1 })), true, "one strain brings it back");
});

test("the fish pulls less after losses, never less than 60% or more than 110%", () => {
  assert.ok(fightHelp({ ...base, misses: 3 })!.pullMul < 1);
  assert.equal(fightHelp({ ...base, misses: 40 })!.pullMul, 0.6);
  assert.equal(fightHelp({ ...base, wins: 20 })!.pullMul, 1.1);
});
