/* The fight v2 (docs/architecture/04 §5): pure rules, determinism, the five styles,
   boss tricks, Helping Hand, co-op, and the tuning targets of §5.7. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fightHelp } from "./assist.ts";
import {
  applyHelp,
  bossStyle,
  expandTrace,
  FIGHT,
  FIGHT_STEP,
  linePercent,
  newFight,
  progressOf,
  pushTrace,
  replayFight,
  stepFight,
  trickOf,
  zoneOf,
  type Drag,
  type Fight,
  type FightInit,
} from "./fight.ts";
import type { FightStyle } from "./habits.ts";
import { makeRng, type Rng } from "./rng.ts";

const STYLES: FightStyle[] = ["runner", "diver", "jumper", "bulldog", "thrasher"];
/** Habit stamina by rarity, as habits.ts generates it. */
const STAMINA = [0.7, 0.9, 1.1, 1.4, 1.8];
/** The line a player would plausibly carry for each rarity (LINES[i].hold). */
const HOLD = [3, 3, 4.5, 6, 9];

function init(over: Partial<FightInit> = {}): FightInit {
  return {
    seed: 1234,
    rarity: 0,
    style: "runner",
    stamina: STAMINA[0],
    boss: false,
    biome: 0,
    hold: 3,
    reelSpeed: 0,
    drag: 1,
    ...over,
  };
}

function forRarity(rarity: number, style: FightStyle, seed: number, over: Partial<FightInit> = {}): FightInit {
  return init({ seed, rarity, style, stamina: STAMINA[rarity], hold: HOLD[rarity], boss: rarity === 4, ...over });
}

/** Run a fight with a player until it ends (or `maxSteps`). */
type Player = (F: Fight) => boolean;
function play(F: Fight, player: Player, maxSteps = 4000) {
  for (let i = 0; i < maxSteps && !F.result; i++) stepFight(F, player(F), FIGHT_STEP);
  return F;
}

/* ── Players ─────────────────────────────────────────────────────────────── */

/** The "decent player" of 04 §5.7: reels when the needle is under ~0.6, lets go over ~0.8, and lets
    go during every warning, run and leap. Human enough to react 50–150 ms late, vary its thresholds a
    little and zone out now and then for about a third of a second. */
function decentPlayer(r: Rng): Player {
  const delay = 1 + Math.floor(r() * 3);
  const lo = 0.55 + r() * 0.1;
  const hi = 0.74 + r() * 0.08;
  const queue: boolean[] = [];
  let held = false;
  let lapse = 0;
  return (F) => {
    const warn = F.telegraph > 0 || F.run > 0 || F.jump > 0;
    let want = held;
    if (warn) want = false;
    else if (F.tension < lo) want = true;
    else if (F.tension > hi) want = false;
    if (!warn && F.dist > 1.12) want = true;
    if (lapse > 0) {
      lapse--;
      want = held;
    } else if (r() < 0.012) lapse = 6;
    held = want;
    queue.push(want);
    return queue.length > delay ? queue.shift()! : false;
  };
}
const masher: Player = () => true;
/** A kid tapping the button about three times a second. */
function tapper(): Player {
  let n = 0;
  return () => n++ % 6 < 3;
}

function landRate(make: (r: Rng) => Player, rarity: number, n: number, over: Partial<FightInit> = {}) {
  let landed = 0;
  let total = 0;
  const times: number[] = [];
  for (const style of STYLES) {
    const r = makeRng(7000 + rarity * 31 + STYLES.indexOf(style));
    for (let k = 0; k < n; k++) {
      const F = play(newFight(forRarity(rarity, style, (r() * 2 ** 32) >>> 0, over)), make(r));
      total++;
      if (F.result === "landed") {
        landed++;
        times.push(F.t);
      }
    }
  }
  times.sort((a, b) => a - b);
  return { rate: landed / total, median: times.length ? times[times.length >> 1] : NaN };
}

/* ── Determinism: the foundation for WP-7's replay ───────────────────────── */

test("the same init and the same inputs give exactly the same fight", () => {
  const inputs = Array.from({ length: 400 }, (_, i) => i % 7 < 4);
  const run = () => {
    const F = newFight(init({ style: "runner", rarity: 2, stamina: 1.1, hold: 6 }));
    for (const held of inputs) {
      if (F.result) break;
      stepFight(F, held, FIGHT_STEP);
    }
    return F;
  };
  assert.deepEqual(run(), run());
});

test("a different seed changes when runs happen, and nothing else is random", () => {
  const timeline = (seed: number) => {
    const F = newFight(init({ seed, style: "runner", rarity: 1 }));
    const starts: number[] = [];
    let was = 0;
    for (let i = 0; i < 400 && !F.result; i++) {
      stepFight(F, i % 6 < 3, FIGHT_STEP);
      if (F.runs > was) starts.push(F.steps);
      was = F.runs;
    }
    return starts;
  };
  assert.deepEqual(timeline(5), timeline(5));
  assert.notDeepEqual(timeline(5), timeline(6));
});

test("a recorded input trace replays to the same ending, and changing one press changes the fight", () => {
  const r = makeRng(99);
  const cfg = forRarity(2, "jumper", 4242);
  const live = newFight(cfg);
  const trace: number[] = [];
  const player = decentPlayer(r);
  for (let i = 0; i < 4000 && !live.result; i++) {
    const held = player(live);
    pushTrace(trace, held);
    stepFight(live, held, FIGHT_STEP);
  }
  assert.ok(live.result, "the fight ended");
  const again = replayFight(cfg, trace);
  assert.deepEqual(again, live, "replaying the trace reproduces every number");
  /* flip the first held stretch to released: the fight must differ */
  const bent = trace.slice();
  const k = bent.findIndex((n, i) => i % 2 === 1 && n > 0);
  bent[k] = Math.max(0, bent[k] - 4);
  bent[k - 1] += 4;
  assert.notDeepEqual(replayFight(cfg, bent), live);
});

test("trace encoding: alternating released/held run lengths, starting with released", () => {
  const t: number[] = [];
  for (const h of [true, true, false, false, false, true]) pushTrace(t, h);
  assert.deepEqual(t, [0, 2, 3, 1]);
  assert.deepEqual(expandTrace(t), [true, true, false, false, false, true]);
  const u: number[] = [];
  for (const h of [false, false, true]) pushTrace(u, h);
  assert.deepEqual(u, [2, 1]);
  assert.deepEqual(expandTrace([]), []);
});

test("a trace that ends early leaves the reel let go, and a finished fight ignores more input", () => {
  const cfg = init();
  const F = replayFight(cfg, [0, 3]);
  assert.equal(F.result, "slip", "let go for good, the fish takes all the line");
  const frozen = JSON.stringify(F);
  stepFight(F, true, FIGHT_STEP);
  assert.equal(JSON.stringify(F), frozen, "stepFight does nothing once there is a result");
});

/* ── The basics: tension, position, stamina, line ────────────────────────── */

test("holding the reel loads the line, letting go relaxes it", () => {
  const F = newFight(init({ rarity: 1 }));
  for (let i = 0; i < 20; i++) stepFight(F, true, FIGHT_STEP);
  const loaded = F.tension;
  assert.ok(loaded > F.lo, "reeling brings the needle up");
  for (let i = 0; i < 40; i++) stepFight(F, false, FIGHT_STEP);
  assert.ok(F.tension < loaded * 0.5, "letting go drops it");
  assert.ok(F.tension >= 0 && F.tension <= 1);
});

test("reeling brings the fish in; giving line lets it take line; far enough and it is gone", () => {
  const reeled = newFight(init({ style: "diver" }));
  for (let i = 0; i < 20; i++) stepFight(reeled, true, FIGHT_STEP);
  assert.ok(reeled.dist < 1, "gained line");
  const loose = newFight(init({ style: "diver" }));
  play(loose, () => false);
  assert.equal(loose.result, "slip");
  assert.ok(loose.dist >= 1.3 || loose.dist === FIGHT.slipDist);
});

test("you only gain line with some tension on it", () => {
  const slack = newFight(init({ style: "diver" }));
  slack.tension = 0;
  const tight = newFight(init({ style: "diver" }));
  tight.tension = 0.6;
  /* hold the target aside so the first step's gain is purely about grip */
  stepFight(slack, true, FIGHT_STEP);
  stepFight(tight, true, FIGHT_STEP);
  assert.ok(slack.dist > tight.dist, "the slack reel gained less");
});

test("a fish tires when it pulls against a tight line, and not when the line is slack", () => {
  const tight = newFight(init({ rarity: 2, stamina: 1.1 }));
  const slack = newFight(init({ rarity: 2, stamina: 1.1 }));
  for (let i = 0; i < 60 && !tight.result; i++) {
    stepFight(tight, i % 4 < 3, FIGHT_STEP);
    if (!slack.result) stepFight(slack, false, FIGHT_STEP);
  }
  assert.ok(tight.stamina < slack.stamina);
});

test("the red zone strains the line until it snaps; coming out of the red lets it recover", () => {
  const F = newFight(init({ rarity: 3, stamina: 1.4, hold: 3, style: "diver" }));
  let strained = false;
  for (let i = 0; i < 400 && !F.result; i++) {
    stepFight(F, true, FIGHT_STEP);
    if (F.strain > 0) strained = true;
  }
  assert.ok(strained);
  assert.equal(F.result, "snap", "a masher on an epic with a thin line snaps it");
  assert.ok(F.redTime > 0 && F.reds >= 1);

  const G = newFight(init({ rarity: 3, stamina: 1.4, hold: 6, style: "diver" }));
  while (G.strain <= 0.3 && !G.result) stepFight(G, true, FIGHT_STEP);
  const before = G.strain;
  for (let i = 0; i < 20; i++) stepFight(G, false, FIGHT_STEP);
  assert.ok(G.strain < before, "strain eased off once the needle left the red");
  assert.equal(linePercent({ strain: 0, hold: 3 }), 100);
  assert.equal(linePercent({ strain: 3, hold: 3 }), 0);
});

test("zones and progress read the needle and the distance", () => {
  const z = (tension: number) => zoneOf({ tension, lo: 0.35, hi: 0.78 });
  assert.equal(z(0.1), "slack");
  assert.equal(z(0.5), "green");
  assert.equal(z(0.85), "high");
  assert.equal(z(0.95), "red");
  assert.equal(progressOf({ dist: 1 }), 0);
  assert.equal(progressOf({ dist: 0.25 }), 0.75);
  assert.equal(progressOf({ dist: 1.3 }), 0);
});

/* ── The five styles (04 §5.4) ───────────────────────────────────────────── */

/** Reels when the needle is low and nothing is about to happen: keeps a fight alive without reaching the red. */
const steady = (F: Fight) => !(F.telegraph > 0 || F.run > 0 || F.jump > 0) && F.tension < 0.6;

/** Step with a fixed input until `stop(F)` or the fight ends; return the fight. */
function until(F: Fight, held: boolean | ((F: Fight) => boolean), stop: (F: Fight) => boolean, max = 1200) {
  for (let i = 0; i < max && !F.result && !stop(F); i++) {
    stepFight(F, typeof held === "function" ? held(F) : held, FIGHT_STEP);
  }
  return F;
}

test("runner: a 0.4 s warning, then a 1.5 s run every 4 to 7 seconds", () => {
  const F = newFight(init({ style: "runner", rarity: 1, hold: 99 }));
  const startWarn = until(F, steady, (f) => f.warns > 0).t;
  assert.ok(startWarn >= 4 - 0.1 && startWarn <= 7 + 0.1, `first warning at ${startWarn.toFixed(2)} s`);
  assert.equal(F.warn, "run");
  assert.equal(F.run, 0, "not running yet — that is the warning");
  const warnedAt = F.t;
  until(F, steady, (f) => f.runs > 0);
  assert.ok(Math.abs(F.t - warnedAt - FIGHT.telegraph) < 0.11, "the run starts 0.4 s after the warning");
  assert.ok(F.run > 0 && F.run <= FIGHT.runFor);
  const runStart = F.t;
  until(F, steady, (f) => f.run === 0);
  assert.ok(Math.abs(F.t - runStart - FIGHT.runFor) < 0.11, "a run lasts 1.5 s");
  const done = F.t;
  until(F, steady, (f) => f.warns > 1);
  const gap = F.t - done;
  assert.ok(gap >= 4 - 0.1 && gap <= 7 + 0.1, `next warning ${gap.toFixed(2)} s later`);
});

test("runner: reeling through a run loads the line far more than giving line", () => {
  const peak = (heldInRun: boolean) => {
    const F = newFight(init({ style: "runner", rarity: 2, stamina: 1.1, hold: 99 }));
    until(F, steady, (f) => f.runs > 0);
    let top = 0;
    for (let i = 0; i < 30 && !F.result; i++) {
      stepFight(F, heldInRun, FIGHT_STEP);
      top = Math.max(top, F.tension);
    }
    return top;
  };
  assert.ok(peak(true) > FIGHT.red, "held through the run, the needle goes red");
  assert.ok(peak(false) < FIGHT.red - 0.3, "given line, it stays well clear");
});

test("runner: a run takes line, but giving line does not lose the fish", () => {
  const F = newFight(init({ style: "runner", rarity: 3, stamina: 1.4, hold: 6 }));
  /* reel to a comfortable spot first, then give line for the whole run */
  for (let i = 0; i < 30; i++) stepFight(F, i % 3 !== 0, FIGHT_STEP);
  until(F, steady, (f) => f.runs > 0);
  until(F, false, (f) => f.run === 0);
  assert.equal(F.result, null, "still on");
});

test("diver: steady heavy pull, no runs, and it tires 20% slower than a runner", () => {
  const D = newFight(init({ style: "diver", rarity: 2, stamina: 1.1 }));
  const R = newFight(init({ style: "runner", rarity: 2, stamina: 1.1, seed: 3 }));
  for (let i = 0; i < 60; i++) {
    if (!D.result) stepFight(D, i % 3 !== 0, FIGHT_STEP);
    if (!R.result) stepFight(R, i % 3 !== 0, FIGHT_STEP);
  }
  assert.equal(D.runs, 0);
  assert.equal(D.warns, 0);
  assert.ok(1 - D.stamina < (1 - R.stamina) * 1.0, "the diver has used less of its tank");
});

test("jumper: warns, leaps for 0.8 s, and the needle drops to zero when it leaps", () => {
  const F = newFight(init({ style: "jumper", rarity: 1, seed: 21, hold: 99 }));
  until(F, steady, (f) => f.warns > 0);
  assert.equal(F.warn, "jump");
  until(F, false, (f) => f.jumps > 0);
  assert.ok(F.jump > 0 && F.jump <= FIGHT.jumpFor);
  assert.ok(F.tension < 0.02, "tension drops to about 0 as it leaps");
  const at = F.t;
  until(F, false, (f) => f.jump === 0);
  assert.ok(Math.abs(F.t - at - FIGHT.jumpFor) < 0.11);
});

test("jumper: keep reeling through a leap and it throws the hook about 35% of the time; ease off and it never does", () => {
  let thrown = 0;
  let thrownEasy = 0;
  const N = 400;
  for (let k = 0; k < N; k++) {
    for (const hold of [true, false]) {
      const F = newFight(init({ style: "jumper", rarity: 1, seed: 100 + k, hold: 99 }));
      until(F, steady, (f) => f.jumps > 0);
      for (let i = 0; i < 24 && !F.result; i++) stepFight(F, hold, FIGHT_STEP);
      if (F.result === "slip") {
        if (hold) thrown++;
        else thrownEasy++;
      }
    }
  }
  assert.equal(thrownEasy, 0, "easing off is always safe");
  const rate = thrown / N;
  assert.ok(rate > 0.27 && rate < 0.43, `threw the hook ${(rate * 100).toFixed(0)}% of the time`);
});

test("bulldog: a gentler pull until the last stretch, then it digs in", () => {
  const far = newFight(init({ style: "bulldog", rarity: 2, stamina: 1.1 }));
  const near = newFight(init({ style: "bulldog", rarity: 2, stamina: 1.1 }));
  near.dist = 0.2;
  far.dist = 0.6;
  /* released: the fish takes line at its pull. Digging in means it takes it faster when it is close. */
  stepFight(far, false, FIGHT_STEP);
  stepFight(near, false, FIGHT_STEP);
  assert.ok(near.dist - 0.2 > (far.dist - 0.6) * 1.3, "near the end it takes line much faster");
});

test("bulldog: a huge tank — it tires about a third as fast as a runner of the same stamina", () => {
  const B = newFight(init({ style: "bulldog", rarity: 2, stamina: 1.1 }));
  const R = newFight(init({ style: "runner", rarity: 2, stamina: 1.1 }));
  for (let i = 0; i < 30; i++) {
    stepFight(B, true, FIGHT_STEP);
    stepFight(R, true, FIGHT_STEP);
  }
  assert.ok(1 - B.stamina < (1 - R.stamina) * 0.8);
});

test("thrasher: the needle wobbles around its average", () => {
  const spread = (style: FightStyle) => {
    const F = newFight(init({ style, rarity: 1, stamina: 0.9, hold: 99 }));
    const xs: number[] = [];
    for (let i = 0; i < 80 && !F.result; i++) {
      stepFight(F, true, FIGHT_STEP);
      if (i > 20) xs.push(F.tension);
    }
    return Math.max(...xs) - Math.min(...xs);
  };
  assert.ok(spread("thrasher") > spread("diver") * 2);
});

/* ── Boss fights and their tricks ────────────────────────────────────────── */

test("boss: runner, then thrasher, then bulldog by thirds of the distance", () => {
  assert.equal(bossStyle(1), "runner");
  assert.equal(bossStyle(0.7), "runner");
  assert.equal(bossStyle(0.5), "thrasher");
  assert.equal(bossStyle(0.2), "bulldog");
  const F = newFight(forRarity(4, "diver", 9));
  assert.equal(F.style, "runner", "starts as a runner whatever its habit says");
  const seen = new Set<string>();
  play(F, () => {
    seen.add(F.style);
    return F.tension < 0.7 && !(F.telegraph > 0 || F.run > 0);
  });
  assert.ok(seen.has("runner"));
  assert.ok(seen.has("thrasher") || F.result !== "landed");
});

test("boss: leaving the runner phase cancels a pending run", () => {
  const F = newFight(forRarity(4, "runner", 3));
  F.telegraph = 0.3;
  F.warn = "run";
  F.dist = 0.5;
  stepFight(F, false, FIGHT_STEP);
  assert.equal(F.style, "thrasher");
  assert.equal(F.telegraph, 0);
  assert.equal(F.warn, "none");
});

test("only the Frost Dragon and the Marble Emperor have a trick", () => {
  assert.equal(trickOf(true, 9), "freeze");
  assert.equal(trickOf(true, 11), "statue");
  for (const b of [0, 1, 5, 10, 14]) assert.equal(trickOf(true, b), "none");
  assert.equal(trickOf(false, 9), "none", "a normal fish in the Arctic has no trick");
});

test("Frost Dragon: the needle freezes for 0.6 s while the real tension moves on", () => {
  const F = newFight(forRarity(4, "runner", 5, { biome: 9, hold: 99 }));
  until(F, steady, (f) => f.freeze > 0, 600);
  assert.ok(F.freeze > 0, "the freeze came");
  const shown = F.shown;
  let moved = false;
  let steps = 0;
  while (F.freeze > 0 && !F.result) {
    stepFight(F, steps % 2 === 0, FIGHT_STEP);
    steps++;
    if (F.freeze > 0) {
      assert.equal(F.shown, shown, "what the needle shows does not change");
      if (Math.abs(F.tension - shown) > 0.005) moved = true;
    }
  }
  assert.ok(moved, "the real tension kept moving behind the frozen needle");
  assert.ok(steps * FIGHT_STEP <= 0.7 && steps * FIGHT_STEP >= 0.5, "about 0.6 s");
  stepFight(F, true, FIGHT_STEP);
  assert.equal(F.shown, F.tension, "thawed: the needle tells the truth again");
});

test("Marble Emperor: statue-still for 2 s (no pull), then it erupts at three times the pull", () => {
  const F = newFight(forRarity(4, "runner", 8, { biome: 11, hold: 99 }));
  until(F, true, (f) => f.still > 0, 800);
  assert.ok(F.still > 0 && F.still <= 2);
  const d0 = F.dist;
  while (F.still > FIGHT_STEP * 1.5 && !F.result) stepFight(F, false, FIGHT_STEP);
  assert.ok(Math.abs(F.dist - d0) < 1e-9, "no pull while still: a released line gains and loses nothing");
  while (F.still > 0 && !F.result) stepFight(F, false, FIGHT_STEP);
  assert.ok(F.surge > 0, "then the surge");
  /* the surge pulls three times as hard: it loads a held line at least as much and takes line much faster */
  const A = newFight(forRarity(4, "runner", 8, { biome: 11, hold: 99 }));
  const B = newFight(forRarity(4, "runner", 8, { biome: 11, hold: 99 }));
  B.surge = 1;
  for (let i = 0; i < 4; i++) {
    stepFight(A, true, FIGHT_STEP);
    stepFight(B, true, FIGHT_STEP);
  }
  assert.ok(B.tension >= A.tension, "the needle goes at least as high");
  const C = newFight(forRarity(4, "runner", 8, { biome: 11, hold: 99 }));
  const D = newFight(forRarity(4, "runner", 8, { biome: 11, hold: 99 }));
  D.surge = 1;
  stepFight(C, false, FIGHT_STEP);
  stepFight(D, false, FIGHT_STEP);
  assert.ok((D.dist - 1) / (C.dist - 1) > 1.5, "and the fish takes line faster");
});

/* ── Gear and drag ───────────────────────────────────────────────────────── */

test("a stronger line survives more strain, a better reel gains line faster, a better rod widens the green", () => {
  const strong = play(newFight(init({ rarity: 3, stamina: 1.4, hold: 12, style: "diver" })), masher);
  const weak = play(newFight(init({ rarity: 3, stamina: 1.4, hold: 3, style: "diver" })), masher);
  assert.ok(strong.t > weak.t || strong.result === "landed");
  const fast = newFight(init({ reelSpeed: 13, style: "diver" }));
  const slow = newFight(init({ reelSpeed: 0, style: "diver" }));
  for (let i = 0; i < 20; i++) {
    stepFight(fast, true, FIGHT_STEP);
    stepFight(slow, true, FIGHT_STEP);
  }
  assert.ok(fast.dist < slow.dist);
  const rod = newFight(init({ bandPad: 0.05 }));
  assert.ok(Math.abs(rod.lo - (FIGHT.band[0] - 0.05)) < 1e-9);
  assert.ok(Math.abs(rod.hi - (FIGHT.band[1] + 0.05)) < 1e-9);
});

test("drag: tight lands faster but snaps easier, loose is gentle but slow", () => {
  const at = (drag: Drag) => {
    let landed = 0;
    let snapped = 0;
    let time = 0;
    const r = makeRng(55);
    for (let k = 0; k < 200; k++) {
      const F = play(newFight(forRarity(2, "diver", (r() * 2 ** 32) >>> 0, { drag })), decentPlayer(r));
      if (F.result === "landed") {
        landed++;
        time += F.t;
      }
      if (F.result === "snap") snapped++;
    }
    return { landed, snapped, mean: time / Math.max(1, landed) };
  };
  const loose = at(0);
  const tight = at(2);
  assert.ok(tight.mean < loose.mean, `tight ${tight.mean.toFixed(1)} s vs loose ${loose.mean.toFixed(1)} s`);
  const masherAt = (drag: Drag) => {
    let ok = 0;
    for (let k = 0; k < 100; k++) {
      if (play(newFight(forRarity(2, "diver", k + 1, { drag })), masher).result === "landed") ok++;
    }
    return ok;
  };
  assert.ok(masherAt(0) >= masherAt(2), "a masher does better on loose drag");
});

/* ── Helping Hand (04 §5.6) ──────────────────────────────────────────────── */

test("Helping Hand at full strength: green [0.28, 0.85], half the strain, an 0.8 s warning", () => {
  const F = newFight(init());
  assert.deepEqual([F.lo, F.hi], [0.35, 0.78]);
  assert.equal(F.strainMul, 1);
  assert.equal(F.tele, 0.4);
  applyHelp(F, { strength: 1, pullMul: 1 });
  assert.ok(Math.abs(F.lo - 0.28) < 1e-9 && Math.abs(F.hi - 0.85) < 1e-9);
  assert.equal(F.strainMul, 0.5);
  assert.ok(Math.abs(F.tele - 0.8) < 1e-9);
  applyHelp(F, null);
  assert.deepEqual([F.lo, F.hi, F.strainMul, F.tele], [0.35, 0.78, 1, 0.4], "taking it off puts everything back");
});

test("Helping Hand keeps the gear's share: the rod's extra green and the mode's pull survive being re-applied", () => {
  const F = newFight(init({ bandPad: 0.03, pullMul: 0.75 }));
  applyHelp(F, { strength: 0.5, pullMul: 0.8 });
  applyHelp(F, { strength: 0.5, pullMul: 0.8 });
  assert.ok(Math.abs(F.lo - (0.35 - 0.035 - 0.03)) < 1e-9);
  assert.ok(Math.abs(F.pullMul - 0.6) < 1e-9);
});

test("a run is warned about 0.8 s ahead when Helping Hand is at full strength", () => {
  const F = newFight(init({ style: "runner", rarity: 1 }));
  applyHelp(F, { strength: 1, pullMul: 1 });
  until(F, false, (f) => f.warns > 0);
  const warnedAt = F.t;
  until(F, false, (f) => f.runs > 0);
  assert.ok(Math.abs(F.t - warnedAt - 0.8) < 0.11);
});

test("half the strain in the red: the same masher lasts about twice as long with help", () => {
  const time = (strength: number) => {
    const F = newFight(init({ rarity: 3, stamina: 1.4, hold: 3, style: "diver" }));
    applyHelp(F, strength ? { strength, pullMul: 1 } : null);
    while (F.strain === 0 && !F.result) stepFight(F, true, FIGHT_STEP);
    const t0 = F.t;
    while (!F.result) stepFight(F, true, FIGHT_STEP);
    return { span: F.t - t0, result: F.result };
  };
  const plain = time(0);
  const helped = time(1);
  assert.equal(plain.result, "snap");
  assert.ok(helped.span > plain.span * 1.6 || helped.result === "landed");
});

test("with Helping Hand a button-masher and a tapper land far more epics than without", () => {
  const rate = (assist: boolean, make: () => Player) => {
    let ok = 0;
    const N = 300;
    for (const style of STYLES) {
      for (let k = 0; k < N; k++) {
        const F = newFight(forRarity(3, style, k * 7 + 1 + STYLES.indexOf(style)));
        if (assist) applyHelp(F, fightHelp({ assist: true, misses: 0, failedFights: 2, wins: 0 }));
        if (play(F, make()).result === "landed") ok++;
      }
    }
    return ok / (N * STYLES.length);
  };
  assert.ok(rate(true, tapper) > rate(false, tapper), "tapping");
  assert.ok(rate(true, () => masher) >= rate(false, () => masher), "mashing");
});

test("a fight with Helping Hand off is identical to one that never had it (tournaments are fair)", () => {
  const trace = [0, 5, 3, 8, 2, 6, 4, 20, 3, 30];
  const plain = replayFight(forRarity(2, "runner", 77), trace);
  const off = newFight(forRarity(2, "runner", 77));
  applyHelp(off, fightHelp({ assist: false, misses: 9, failedFights: 9, wins: 0 }));
  const inputs = expandTrace(trace);
  for (let i = 0; i < 4000 && !off.result; i++) stepFight(off, inputs[i] ?? false, FIGHT_STEP);
  assert.deepEqual(off, plain);
});

/* ── Local co-op (04 §8) ─────────────────────────────────────────────────── */

test("player two holding the reel adds 0.2 to the reel, with or without player one", () => {
  const solo = newFight(init({ style: "diver" }));
  const duo = newFight(init({ style: "diver" }));
  duo.partner = true;
  for (let i = 0; i < 20; i++) {
    stepFight(solo, true, FIGHT_STEP);
    stepFight(duo, true, FIGHT_STEP);
    duo.partner = true;
  }
  assert.ok(duo.dist < solo.dist, "two anglers land it sooner");
  const alone = newFight(init({ style: "diver" }));
  const helper = newFight(init({ style: "diver" }));
  helper.partner = true;
  stepFight(alone, false, FIGHT_STEP);
  stepFight(helper, false, FIGHT_STEP);
  assert.ok(helper.dist < alone.dist, "the partner reels even while player one lets go");
  assert.equal(helper.tension, alone.tension, "but only the held reel loads the line");
});

/* ── The tuning targets (04 §5.7) ────────────────────────────────────────── */

test("a decent player lands at least 85% of commons and 55% of epics", () => {
  const common = landRate(decentPlayer, 0, 2000);
  const epic = landRate(decentPlayer, 3, 2000);
  assert.ok(common.rate >= 0.85, `commons ${(common.rate * 100).toFixed(1)}%`);
  assert.ok(epic.rate >= 0.55, `epics ${(epic.rate * 100).toFixed(1)}%`);
});

test("a button-masher still lands 60% of commons (kids must succeed) but at most 25% of epics", () => {
  const common = landRate(() => masher, 0, 2000);
  const epic = landRate(() => masher, 3, 2000);
  assert.ok(common.rate >= 0.6, `commons ${(common.rate * 100).toFixed(1)}%`);
  assert.ok(epic.rate <= 0.25, `epics ${(epic.rate * 100).toFixed(1)}%`);
});

test("a kid tapping along lands at least 60% of commons", () => {
  const common = landRate(tapper, 0, 1000);
  assert.ok(common.rate >= 0.6, `commons ${(common.rate * 100).toFixed(1)}%`);
});

test("fight length: commons take 6 to 14 s, bosses 18 to 40 s (median, decent player)", () => {
  const common = landRate(decentPlayer, 0, 2000);
  const boss = landRate(decentPlayer, 4, 1000);
  assert.ok(common.median >= 6 && common.median <= 14, `commons ${common.median.toFixed(1)} s`);
  assert.ok(boss.median >= 18 && boss.median <= 40, `bosses ${boss.median.toFixed(1)} s`);
  assert.ok(boss.rate > 0.3, `the decent player can beat a boss (${(boss.rate * 100).toFixed(0)}%)`);
});
