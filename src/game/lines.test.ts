/* Line wear, crafting and packs (docs/architecture/10 §1). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { LINES } from "./content.ts";
import { applyHelp, FIGHT_STEP, linePercent, newFight, pushTrace, replayFight, stepFight, type Fight, type FightInit } from "./fight.ts";
import { OLDEST_RULES_VERSION, RULES_VERSION, rulesVersionOf, tickPoints, WEAR, wearFactor, wearPct } from "./line-wear.ts";
import {
  allLineGear,
  applyOpen,
  canUse,
  checkCraft,
  CRAFT_GATE,
  craft,
  craftCap,
  freeLineGear,
  givePack,
  healthOf,
  LINE_HEALTH,
  LINE_PACKS,
  LINE_TIERS,
  lineGearFromOld,
  openPack,
  packForLevel,
  packFromCatch,
  readLineGear,
  RECIPE_DUPES,
  secondsAgainst,
  wearMulFor,
} from "./lines.ts";
import { makeRng } from "./rng.ts";

function init(over: Partial<FightInit> = {}): FightInit {
  return { seed: 99, rarity: 0, style: "bulldog", stamina: 1.4, boss: false, biome: 0, hold: 9, reelSpeed: 0, drag: 1, ...over };
}

/** A player who never touches the reel. */
const sits = () => false;

function run(F: Fight, player: (F: Fight) => boolean, max = 6000) {
  for (let i = 0; i < max && !F.result; i++) stepFight(F, player(F), FIGHT_STEP);
  return F;
}

test("the drain table is the owner's: 1, 2, 3, 5, 10 percent, and 15 for bosses and anything above legendary", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((r) => wearPct(r, false)), [1, 2, 3, 5, 10]);
  assert.equal(wearPct(0, true), 15);
  assert.equal(wearPct(7, false), 15);
  assert.equal(tickPoints(4, false), 10);
  assert.equal(WEAR.tickSteps * FIGHT_STEP, 1, "a tick is one second");
});

test("better lines have more health, every tier", () => {
  assert.equal(LINE_HEALTH.length, LINES.length);
  for (let t = 1; t < LINE_TIERS; t++) assert.ok(LINE_HEALTH[t] > LINE_HEALTH[t - 1]);
  assert.equal(healthOf(0), 100);
});

test("sitting without reeling wears the line out; the fish is not needed to be tired", () => {
  const F = run(newFight(init({ lineHealth: healthOf(0) })), sits);
  assert.ok(F.result === "snap" || F.result === "slip" || F.result === "landed");
  /* With only a hand line a legendary cannot be outlasted by waiting. */
  const G = run(newFight(init({ rarity: 4, boss: false, lineHealth: 30, hold: 99 })), sits);
  assert.equal(G.result, "snap");
  assert.equal(G.worn, true);
  assert.equal(G.life, 0);
});

test("wear is exact and replayable: the same trace gives the same life, step for step", () => {
  const i = init({ rarity: 2, lineHealth: healthOf(3), wearMul: 1 });
  const A = newFight(i);
  const trace: number[] = [];
  let down = false;
  for (let s = 0; s < 400 && !A.result; s++) {
    if (A.tension < 0.5) down = true;
    else if (A.tension > 0.75) down = false;
    pushTrace(trace, down);
    stepFight(A, down, FIGHT_STEP);
  }
  const B = replayFight(i, trace);
  assert.equal(B.life, A.life);
  assert.equal(B.result, A.result);
  assert.equal(B.steps, A.steps);
  assert.ok(A.life < A.lifeMax, "the line did wear");
});

test("steady reeling in the green halves the wear, a fish in the air takes none, a tired fish less", () => {
  const base = { reeling: false, tension: 0.5, lo: 0.35, hi: 0.78, stamina: 1, jump: 0, still: 0 };
  const f = (o: Partial<typeof base>) => wearFactor({ ...base, ...o });
  assert.equal(f({}), 1);
  assert.equal(f({ reeling: true }), WEAR.reelingInGreen);
  assert.equal(f({ reeling: true, tension: 0.95 }), 1);
  assert.equal(f({ jump: 0.5 }), 0);
  assert.equal(f({ stamina: 0.1 }), WEAR.tired);
});

test("a better line outlasts a worse one against the same fish", () => {
  const life = (tier: number) => run(newFight(init({ rarity: 3, lineHealth: healthOf(tier), hold: 99, pullMul: 0 })), sits).steps;
  assert.ok(life(6) > life(1));
  assert.ok(secondsAgainst(6, 4, false, false) > secondsAgainst(1, 4, false, false));
  assert.equal(secondsAgainst(0, 0, false, false), 100);
  assert.equal(secondsAgainst(0, 4, false, true), 20);
});

test("Kid Mode, Helping Hand and Recreational are forgiving; difficulty is a multiplier", () => {
  assert.equal(wearMulFor({}), 1);
  assert.equal(wearMulFor({ kid: true }), WEAR.kidMul);
  assert.equal(wearMulFor({ recreational: true, kid: true }), 0);
  assert.equal(wearMulFor({ difficulty: 2 }), 2);
  assert.equal(wearMulFor({ difficulty: Number.NaN }), 1);
  const F = newFight(init({ lineHealth: 100, wearMul: 1 }));
  applyHelp(F, { strength: 1, pullMul: 0.9 });
  assert.equal(F.wearMul, 1 - WEAR.helpEase);
  applyHelp(F, null);
  assert.equal(F.wearMul, 1);
  const none = run(newFight(init({ rarity: 4, lineHealth: 100, wearMul: 0, hold: 99 })), sits);
  assert.equal(none.worn, false, "a zero multiplier never wears the line");
});

test("the line percent the player sees is the lower of strain and wear", () => {
  const F = newFight(init({ lineHealth: 100 }));
  F.life = 40;
  assert.equal(linePercent(F), 40);
  F.life = 100;
  F.strain = F.hold / 2;
  assert.equal(linePercent(F), 50);
  assert.equal(linePercent({ strain: 0, hold: 3 }), 100, "a fight with no wear reads as before");
});

test("a fight with no lineHealth is the old fight, bit for bit", () => {
  const a = run(newFight(init({ rarity: 3 })), sits);
  const b = run(newFight(init({ rarity: 3, lineHealth: 0, wearMul: 5 })), sits);
  assert.equal(a.steps, b.steps);
  assert.equal(a.result, b.result);
  assert.equal(b.worn, false);
});

test("rules versions: old rows are version 1, new is 2, junk is 1", () => {
  assert.equal(OLDEST_RULES_VERSION, 1);
  assert.equal(RULES_VERSION, 2);
  assert.equal(rulesVersionOf(undefined), 1);
  assert.equal(rulesVersionOf(2), 2);
  assert.equal(rulesVersionOf(3), 1);
  assert.equal(rulesVersionOf("2"), 1);
});

/* ── Crafting ────────────────────────────────────────────────────────────── */

test("the recipe asks for more copies as the line gets better, and every step is craftable by someone", () => {
  assert.equal(RECIPE_DUPES.length, LINE_TIERS - 1);
  for (let t = 1; t < RECIPE_DUPES.length; t++) assert.ok(RECIPE_DUPES[t] >= RECIPE_DUPES[t - 1]);
  assert.equal(CRAFT_GATE.length, LINE_TIERS);
  for (let t = 1; t < LINE_TIERS; t++) {
    assert.ok(CRAFT_GATE[t].lv > CRAFT_GATE[t - 1].lv);
    assert.ok(CRAFT_GATE[t].bosses >= CRAFT_GATE[t - 1].bosses);
  }
});

test("crafting needs the copies, the level and the bosses; it spends the copies and makes one", () => {
  let g = freeLineGear();
  assert.equal(checkCraft(g, 1, 99, 99).ok, false, "no spares");
  g = { ...g, lines: g.lines.map((n, i) => (i === 0 ? 3 : n)) };
  assert.equal(checkCraft(g, 1, 1, 0).ok, false, "level 3 needed");
  assert.match(checkCraft(g, 1, 1, 0).why, /^Reach level 3\.$/);
  const made = craft(g, 1, 3, 0)!;
  assert.equal(made.lines[0], 0);
  assert.equal(made.lines[1], 1);
  assert.equal(craft(made, 1, 3, 0), null, "the copies are gone");
  /* a boss gate */
  const rich = { ...g, lines: g.lines.map((n, i) => (i === 3 ? RECIPE_DUPES[3] : n)) };
  const c = checkCraft(rich, 4, 15, 0);
  assert.equal(c.ok, false);
  assert.match(c.why, /Beat 2 bosses/);
  assert.equal(checkCraft(rich, 4, 15, 2).ok, true);
  assert.equal(craft(g, 0, 99, 99), null);
  assert.equal(craft(g, LINE_TIERS, 99, 99), null);
});

test("the craft cap rises with level and bosses and stops at the top tier", () => {
  assert.equal(craftCap(1, 0), 0);
  assert.equal(craftCap(10, 0), 2);
  assert.equal(craftCap(10, 1), 3);
  assert.equal(craftCap(9999, 99), LINE_TIERS - 1);
  assert.equal(craftCap(84, 99), LINE_TIERS - 2);
});

test("a scripted player crafts the whole ladder from packs and reaches the top line", () => {
  const rand = makeRng(7);
  let g = freeLineGear();
  const lv = 85;
  const bosses = 14;
  for (let guard = 0; guard < 5000 && g.lines[LINE_TIERS - 1] === 0; guard++) {
    /* a pack every round, opened */
    g = givePack(g, guard % 4 === 3 ? 3 : 1);
    g = applyOpen(g, guard % 4 === 3 ? 3 : 1, rand)!;
    for (let t = LINE_TIERS - 1; t >= 1; t--) {
      const next = craft(g, t, lv, bosses);
      if (next) g = next;
    }
  }
  assert.ok(g.lines[LINE_TIERS - 1] >= 1, "the best line is reachable");
  /* ...and a level 1 player cannot do it, whatever they hold */
  const hoard = { ...g, lines: g.lines.map(() => 500) };
  assert.equal(craft(hoard, 5, 1, 0), null);
});

/* ── Packs ───────────────────────────────────────────────────────────────── */

test("packs hold three lines inside their tier range; the top two tiers never drop", () => {
  const rand = makeRng(11);
  LINE_PACKS.forEach((p, k) => {
    for (let n = 0; n < 300; n++) {
      const got = openPack(k, rand);
      assert.equal(got.length, 3);
      for (const t of got) assert.ok(t >= p.min && t < p.min + p.weights.length && t <= LINE_TIERS - 3);
    }
  });
  assert.deepEqual(openPack(99, rand), []);
});

test("opening a pack spends it and adds its lines; none left means nothing happens", () => {
  const g = givePack(freeLineGear(), 0, 2);
  const opened = applyOpen(g, 0, makeRng(3))!;
  assert.equal(opened.packs[0], 1);
  assert.equal(opened.last.length, 3);
  assert.equal(opened.lines.reduce((a, b) => a + b, 0), g.lines.reduce((a, b) => a + b, 0) + 3);
  assert.equal(applyOpen(freeLineGear(), 0, makeRng(3)), null);
});

test("pack sources: levels, catches", () => {
  assert.equal(packForLevel(2), 0);
  assert.equal(packForLevel(5), 1);
  assert.equal(packForLevel(10), 2);
  assert.equal(packForLevel(25), 3);
  assert.equal(packForLevel(50), 3);
  assert.equal(packFromCatch(0, () => 0.9), null);
  assert.equal(packFromCatch(4, () => 0), 3);
  assert.equal(packFromCatch(99, () => 0), 3);
});

/* ── Saves ───────────────────────────────────────────────────────────────── */

test("an old save's single line becomes one copy of each line up to it", () => {
  const g = lineGearFromOld(4);
  assert.deepEqual(g.lines.slice(0, 6), [1, 1, 1, 1, 1, 0]);
  assert.ok(canUse(g, 4));
  assert.ok(!canUse(g, 5));
  assert.ok(canUse(g, 0));
  assert.deepEqual(readLineGear(undefined, 2).lines.slice(0, 4), [1, 1, 1, 0]);
  assert.equal(allLineGear().lines.every((n) => n === 1), true);
});

test("hostile line gear is cleaned", () => {
  const g = readLineGear({ lines: ["x", -4, 1e12, 2.7], packs: [null, 9, "a"], last: [3, 99, "z", 4, 5, 6, 7] }, 0);
  assert.equal(g.lines.length, LINE_TIERS);
  assert.deepEqual(g.lines.slice(0, 4), [0, 0, 9999, 2]);
  assert.equal(g.packs.length, LINE_PACKS.length);
  assert.deepEqual(g.packs.slice(0, 3), [0, 9, 0]);
  assert.deepEqual(g.last, [3, 4, 5]);
});
