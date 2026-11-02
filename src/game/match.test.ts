import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BIOMES,
  BOSS_INDEX,
  fishWeights,
  matchWeight,
  rollFish,
  sizeBiasOf,
  SPECIES_PER_BIOME,
} from "./content.ts";
import { habitOf, type Habit } from "./habits.ts";
import {
  averageMatch,
  biteFactor,
  HINT_AFTER,
  hintFor,
  hintForCast,
  matchScore,
  matchVector,
  MAX_MATCH,
  missNote,
  planCast,
  rigHint,
  spotResidents,
  whereToFind,
  windowOf,
} from "./match.ts";
import { FAMILIES, RETRIEVES, WINDOWS, type Presentation } from "./presentation.ts";
import { makeRng, rng, setRng } from "./rng.ts";
import { defaultSpot, SPOTS, type Spot } from "./spots.ts";

const spotOf = (s: Partial<Spot>): Spot => ({ ...SPOTS[0][0], ...s });
const HABIT: Habit = {
  structures: ["weeds", "dock"],
  depth: 1,
  feeds: ["dawn", "dusk"],
  likes: ["worm", "crank"],
  retrieve: ["slow"],
  weather: [1],
  fight: "runner",
  stamina: 1,
};
const PERFECT: Presentation = { family: "worm", depth: 1, retrieve: "slow" };

/** The ideal cast for one species: a spot it holds at, and the rig and time it likes best. */
function ideal(b: number, i: number) {
  const h = habitOf(b, i);
  const spot = SPOTS[b].find((s) => h.structures.includes(s.structure)) ?? SPOTS[b][0];
  const p: Presentation = { family: h.likes[0], depth: h.depth, retrieve: h.retrieve[0] };
  return { spot, p, weather: h.weather[0] ?? 0, window: h.feeds[0] };
}

function withSeed<T>(seed: number, fn: () => T): T {
  const saved = rng;
  setRng(makeRng(seed));
  try {
    return fn();
  } finally {
    setRng(saved);
  }
}

/* ── matchScore ──────────────────────────────────────────────────────────── */

test("a perfect cast scores 9.5 and a hopeless one scores 0", () => {
  assert.equal(matchScore(HABIT, spotOf({ structure: "weeds" }), PERFECT, 1, "dawn"), 9.5);
  assert.equal(MAX_MATCH, 9.5);
  const bad: Presentation = { family: "glow", depth: 1, retrieve: "fast" };
  assert.equal(
    matchScore(
      { ...HABIT, depth: 0 },
      spotOf({ structure: "rocks" }),
      { ...bad, depth: 2 },
      0,
      "night",
    ),
    0,
  );
});

test("each part of the score is worth what the spec says", () => {
  const spot = spotOf({ structure: "weeds" });
  const none = {
    ...HABIT,
    structures: [],
    depth: 0 as const,
    feeds: [],
    likes: ["spoon" as const],
    retrieve: ["fast" as const],
    weather: [],
  };
  const base: Presentation = { family: "worm", depth: 2, retrieve: "still" };
  assert.equal(matchScore(none, spot, base, 0, "day"), 0);
  assert.equal(matchScore({ ...none, structures: ["weeds"] }, spot, base, 0, "day"), 2);
  assert.equal(matchScore({ ...none, depth: 2 }, spot, base, 0, "day"), 2);
  assert.equal(matchScore({ ...none, depth: 1 }, spot, base, 0, "day"), 0.5);
  assert.equal(matchScore({ ...none, likes: ["worm"] }, spot, base, 0, "day"), 2);
  assert.equal(matchScore({ ...none, retrieve: ["still"] }, spot, base, 0, "day"), 1);
  assert.equal(matchScore({ ...none, feeds: ["day"] }, spot, base, 0, "day"), 1.5);
  assert.equal(matchScore({ ...none, weather: [3] }, spot, base, 3, "day"), 1);
});

test("no habit, spot, rig, time and weather can ever score outside 0 … 9.5", () => {
  for (let b = 0; b < BIOMES.length; b++)
    for (let i = 0; i < SPECIES_PER_BIOME; i += 3)
      for (const spot of SPOTS[b])
        for (const depth of [0, 1, 2] as const)
          for (const retrieve of RETRIEVES)
            for (const family of FAMILIES) {
              const s = matchScore(
                habitOf(b, i),
                spot,
                { family, depth, retrieve },
                (i + depth) % 5,
                WINDOWS[(i + depth) % 4],
              );
              assert.ok(s >= 0 && s <= 9.5 && Number.isFinite(s));
            }
});

test("matchWeight grows with the score, is 1 at zero, and rewards near-perfect rigs sharply", () => {
  assert.equal(matchWeight(0), 1);
  for (let s = 0.5; s <= 9.5; s += 0.5) assert.ok(matchWeight(s) > matchWeight(s - 0.5));
  assert.ok(matchWeight(4) >= 4 && matchWeight(4) <= 10, `score 4 ≈ ${matchWeight(4)}`);
  assert.ok(matchWeight(9.5) > 1000);
  assert.equal(matchWeight(-3), 1);
  assert.equal(matchWeight(50), matchWeight(9.5));
});

/* ── Time windows ───────────────────────────────────────────────────────── */

test("windows follow the clock: 05–08 dawn, 08–17 day, 17–20 dusk, otherwise night", () => {
  const at = (h: number) => windowOf(h);
  assert.equal(at(4.99), "night");
  assert.equal(at(5), "dawn");
  assert.equal(at(7.99), "dawn");
  assert.equal(at(8), "day");
  assert.equal(at(16.99), "day");
  assert.equal(at(17), "dusk");
  assert.equal(at(19.99), "dusk");
  assert.equal(at(20), "night");
  assert.equal(at(0), "night");
  assert.equal(at(24), "night");
  assert.equal(at(29), "dawn");
  assert.equal(at(-1), "night");
});

test("night weather forces night, any hour", () => {
  assert.equal(windowOf(12, 4), "night");
  assert.equal(windowOf(6, 4), "night");
  assert.equal(windowOf(12, 1), "day");
});

/* ── Bite time ──────────────────────────────────────────────────────────── */

test("a great rig bites in about a third of the time; a poor one is slower than normal", () => {
  assert.ok(Math.abs(biteFactor(9.5) - 0.495) < 1e-9);
  assert.equal(biteFactor(0), 1.35);
  assert.equal(biteFactor(100), 0.45);
  assert.equal(biteFactor(-5), 1.35);
  assert.ok(biteFactor(5) < biteFactor(2));
});

test("averageMatch weighs species by how often they come, and copes with no fish", () => {
  assert.equal(averageMatch([10, 0], [1, 1]), 5);
  assert.equal(averageMatch([10, 0], [3, 1]), 7.5);
  assert.equal(averageMatch([4], [0]), 0);
  assert.equal(averageMatch([], []), 0);
});

test("planCast: the right rig at the right time bites sooner than the wrong one", () => {
  const b = 0;
  const { spot, p, weather, window } = ideal(b, 0);
  const good = planCast(b, spot, p, weather, window, 0, { stage: 0 });
  const wrongSpot = SPOTS[b].find((s) => !habitOf(b, 0).structures.includes(s.structure))!;
  const bad = planCast(
    b,
    wrongSpot,
    { family: "glow", depth: 2, retrieve: "fast" },
    0,
    "night",
    0,
    { stage: 0 },
  );
  assert.ok(good.avg > bad.avg);
  assert.ok(good.wait < bad.wait);
  assert.equal(good.ms.length, SPECIES_PER_BIOME);
  assert.ok(good.wait >= 0.45 && bad.wait <= 1.35);
});

/* ── Tuning targets (04 §4) ─────────────────────────────────────────────── */

function landRate(
  b: number,
  i: number,
  luck: number,
  ms: number[],
  casts: number,
  seed: number,
  stage = 3,
) {
  return withSeed(seed, () => {
    let n = 0;
    for (let k = 0; k < casts; k++) if (rollFish(b, luck, { stage, match: ms }).i === i) n++;
    return n / casts;
  });
}

function share(b: number, i: number, luck: number, ms: number[], stage = 3) {
  const w = fishWeights(b, luck, { stage, match: ms });
  return w[i] / w.reduce((a, x) => a + x, 0);
}

test("tuning: at luck 0 a perfect match on a common's preferred spot bites at least 55% of casts", () => {
  for (let b = 0; b < BIOMES.length; b++)
    for (const i of [0, 1]) {
      const c = ideal(b, i);
      const ms = matchVector(b, c.spot, c.p, c.weather, c.window);
      assert.ok(
        share(b, i, 0, ms) >= 0.55,
        `${BIOMES[b].fish[i]} analytic share ${share(b, i, 0, ms).toFixed(2)}`,
      );
    }
  /* And through the real roller with a seeded stream. */
  const c = ideal(0, 0);
  const ms = matchVector(0, c.spot, c.p, c.weather, c.window);
  assert.ok(landRate(0, 0, 0, ms, 4000, 101) >= 0.55);
});

test("tuning: at luck 0 and a zero-point match an epic bites on fewer than 1% of casts", () => {
  let proven = 0;
  for (let b = 0; b < BIOMES.length; b++)
    for (const i of [21, 22, 23]) {
      const h = habitOf(b, i);
      /* Find a cast the epic scores exactly 0 on: wrong structure, depth two away, nothing it likes. */
      let ms: number[] | null = null;
      for (const spot of SPOTS[b]) {
        if (h.structures.includes(spot.structure)) continue;
        for (const depth of [0, 1, 2] as const) {
          if (Math.abs(depth - h.depth) < 2) continue;
          for (const family of FAMILIES) {
            if (h.likes.includes(family)) continue;
            for (const retrieve of RETRIEVES) {
              if (h.retrieve.includes(retrieve)) continue;
              for (const window of WINDOWS) {
                if (h.feeds.includes(window)) continue;
                const v = matchVector(b, spot, { family, depth, retrieve }, 0, window);
                if (v[i] === 0 && !ms) ms = v;
              }
            }
          }
        }
      }
      if (!ms) continue;
      proven++;
      assert.ok(share(b, i, 0, ms) < 0.01, `${BIOMES[b].fish[i]} share ${share(b, i, 0, ms)}`);
    }
  assert.ok(proven >= 20, `only ${proven} epics had a zero-point cast to test`);
  const b = 0;
  const h = habitOf(b, 21);
  const spot = SPOTS[b].find((s) => !h.structures.includes(s.structure))!;
  const ms = matchVector(
    b,
    spot,
    {
      family: FAMILIES.find((f) => !h.likes.includes(f))!,
      depth: h.depth === 0 ? 2 : 0,
      retrieve: RETRIEVES.find((r) => !h.retrieve.includes(r))!,
    },
    0,
    WINDOWS.find((w) => !h.feeds.includes(w))!,
  );
  assert.ok(landRate(b, 21, 0, ms, 4000, 7) < 0.01);
});

test("tuning: at luck 40 a perfect epic match bites at least 12% of casts", () => {
  const shares: number[] = [];
  for (let b = 0; b < BIOMES.length; b++)
    for (const i of [21, 22, 23]) {
      const c = ideal(b, i);
      shares.push(share(b, i, 40, matchVector(b, c.spot, c.p, c.weather, c.window)));
    }
  const passing = shares.filter((s) => s >= 0.12).length;
  assert.ok(
    passing >= 40,
    `${passing} of 45 epics reached 12% (min ${Math.min(...shares).toFixed(3)})`,
  );
  assert.ok(Math.min(...shares) >= 0.05, "even the worst epic must be clearly boosted");
  /* The real roller agrees, on the easiest epic. */
  const best = shares.indexOf(Math.max(...shares));
  const b = Math.floor(best / 3);
  const i = 21 + (best % 3);
  const c = ideal(b, i);
  const ms = matchVector(b, c.spot, c.p, c.weather, c.window);
  assert.ok(landRate(b, i, 40, ms, 4000, 33) >= 0.12);
});

test("tuning: knowing fish beats luck — a perfect rig beats the average rig at the same luck", () => {
  for (const [b, i] of [
    [5, 12],
    [0, 14],
    [8, 17],
    [12, 10],
  ]) {
    const c = ideal(b, i);
    const perfect = share(b, i, 20, matchVector(b, c.spot, c.p, c.weather, c.window));
    let sum = 0;
    let n = 0;
    for (const spot of SPOTS[b])
      for (const depth of [0, 1, 2] as const)
        for (const retrieve of RETRIEVES)
          for (const family of FAMILIES) {
            sum += share(b, i, 20, matchVector(b, spot, { family, depth, retrieve }, 0, "day"));
            n++;
          }
    assert.ok(
      perfect > (sum / n) * 3,
      `${BIOMES[b].fish[i]}: perfect ${perfect.toFixed(3)} vs average ${(sum / n).toFixed(3)}`,
    );
  }
});

test("without a match vector the odds are exactly what they were before WP-2", () => {
  const plain = fishWeights(0, 10, { stage: 3 });
  const zeros = fishWeights(0, 10, { stage: 3, match: new Array(25).fill(0) });
  assert.deepEqual(zeros, plain);
  assert.equal(plain[BOSS_INDEX], 0);
});

/* ── Size ───────────────────────────────────────────────────────────────── */

test("size bias runs from -0.1 to +0.35 and is zero-ish at a middling score", () => {
  assert.equal(sizeBiasOf(0), -0.1);
  assert.equal(sizeBiasOf(3), 0);
  assert.ok(Math.abs(sizeBiasOf(5) - 0.12) < 1e-9);
  assert.equal(sizeBiasOf(9.5), 0.35);
});

test("a well-matched cast lands heavier fish than a poorly matched one", () => {
  const ms = (score: number) =>
    Array.from({ length: SPECIES_PER_BIOME }, (_, n) => (n === BOSS_INDEX ? score : 0));
  const mean = (score: number) =>
    withSeed(9, () => {
      let sum = 0;
      for (let k = 0; k < 3000; k++) sum += rollFish(0, 0, { boss: true, match: ms(score) }).w;
      return sum / 3000;
    });
  const heavy = mean(9.5);
  const light = mean(0);
  assert.ok(heavy > light * 1.3, `heavy ${heavy.toFixed(1)} vs light ${light.toFixed(1)}`);
});

/* ── Seeded determinism ─────────────────────────────────────────────────── */

test("the same seed replays the same fish, weights, values and mutations; another seed does not", () => {
  const c = ideal(3, 4);
  const ms = matchVector(3, c.spot, c.p, c.weather, c.window);
  const run = (seed: number) =>
    withSeed(seed, () =>
      Array.from({ length: 200 }, () => rollFish(3, 12, { stage: 3, match: ms })),
    );
  const a = run(2024);
  const b = run(2024);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, run(2025));
});

test("a tournament cast is reproducible: seedFrom → setRng → the same catch, however often you ask", () => {
  const cast = () => withSeed(0xabc, () => rollFish(1, 30, { stage: 3 }));
  assert.deepEqual(cast(), cast());
});

test("rollFish never returns the boss unless asked, nor a species above the stage cap", () => {
  withSeed(4, () => {
    for (let k = 0; k < 3000; k++) {
      const f = rollFish(2, 100, { stage: 0 });
      assert.ok(f.i <= 15 && f.i !== BOSS_INDEX);
    }
    assert.equal(rollFish(2, 0, { boss: true }).i, BOSS_INDEX);
  });
});

/* ── Words for the player ───────────────────────────────────────────────── */

test("hints name what to change, and never a species", () => {
  const spot = spotOf({ structure: "weeds" });
  assert.equal(hintFor(HABIT, spot, { ...PERFECT, depth: 0 }, "dawn"), "Fish deeper here.");
  assert.equal(
    hintFor({ ...HABIT, depth: 0 }, spot, { ...PERFECT, depth: 1 }, "dawn"),
    "Try fishing shallower here.",
  );
  assert.equal(
    hintFor(HABIT, spot, { ...PERFECT, retrieve: "fast" }, "dawn"),
    "Try a slower retrieve.",
  );
  assert.equal(
    hintFor({ ...HABIT, retrieve: ["fast"] }, spot, PERFECT, "dawn"),
    "Try a faster retrieve.",
  );
  assert.equal(hintFor(HABIT, spot, PERFECT, "night"), "This spot wakes up at dawn.");
  assert.equal(
    hintFor({ ...HABIT, feeds: ["day"] }, spot, PERFECT, "night"),
    "This spot wakes up at midday.",
  );
  assert.equal(hintFor(HABIT, spot, { ...PERFECT, family: "glow" }, "dawn"), "Try plastic worms.");
  assert.equal(
    hintFor(HABIT, spotOf({ structure: "rocks" }), PERFECT, "dawn"),
    "Try a different spot.",
  );
  assert.equal(hintFor(HABIT, spot, PERFECT, "dawn"), null);
  /* Never a species name. */
  const names = BIOMES.flatMap((x) => x.fish);
  for (let b = 0; b < BIOMES.length; b++)
    for (let i = 0; i < 24; i += 2) {
      const h = habitOf(b, i);
      const t =
        hintFor(h, SPOTS[b][1], { family: "glow", depth: 2, retrieve: "still" }, "night") ?? "";
      for (const n of names) assert.ok(!t.includes(n), `"${t}" names ${n}`);
    }
});

test("the post-catch note says what the fish wanted, or stays quiet when the rig was right", () => {
  assert.equal(
    missNote(HABIT, { ...PERFECT, retrieve: "fast" }),
    "That one wanted a slower retrieve.",
  );
  assert.equal(
    missNote({ ...HABIT, retrieve: ["fast"] }, PERFECT),
    "That one wanted a faster retrieve.",
  );
  assert.equal(missNote(HABIT, { ...PERFECT, depth: 0 }), "That one was hiding deeper.");
  assert.equal(missNote({ ...HABIT, depth: 0 }, PERFECT), "That one was up near the top.");
  assert.equal(missNote(HABIT, { ...PERFECT, family: "glow" }), "That one likes plastic worms.");
  assert.equal(missNote(HABIT, PERFECT), null);
});

test("hintForCast looks at the best uncaught fish at this spot and says one thing", () => {
  const b = 0;
  const spot = SPOTS[b][1];
  const p: Presentation = { family: "glow", depth: 2, retrieve: "still" };
  const none = () => false;
  const hint = hintForCast(b, spot, p, 0, "night", 3, none);
  assert.ok(hint && hint.length > 5 && hint.length < 60, String(hint));
  /* Everything that holds here is already caught: nothing new to hint about. */
  const all = hintForCast(b, spot, p, 0, "night", 3, () => true);
  assert.match(all ?? "", /another spot/);
  /* Stage 0 only knows the first 16 species. */
  assert.ok(hintForCast(b, spot, p, 0, "night", 0, none));
});

test("the hint arrives after a wait the game can actually produce", () => {
  /* Longest possible wait: 4 s × the slowest bite factor (1.35). 8 s (the spec's number) is unreachable. */
  assert.ok(HINT_AFTER < 4 * 1.35);
  assert.equal(HINT_AFTER, 3);
});

test("the two commonest residents of a spot hold at that kind of spot", () => {
  for (let b = 0; b < BIOMES.length; b++)
    for (const spot of SPOTS[b]) {
      const res = spotResidents(b, spot, 2);
      assert.ok(res.length >= 1, `${spot.id} has residents`);
      for (const i of res) assert.ok(habitOf(b, i).structures.includes(spot.structure));
      if (res.length === 2) assert.ok(res[0] < res[1] + 1);
    }
});

test("whereToFind lists the spots whose structure the species likes", () => {
  const pond = BIOMES[0].fish.indexOf("Bluegill");
  const spots = whereToFind(0, pond).map((s) => s.id);
  assert.ok(
    spots.includes("pond-pads") && spots.includes("pond-dock") && spots.includes("pond-shade"),
  );
  assert.ok(!spots.includes("pond-hole"));
});

test("the rig hint names a fish only when the player has caught it", () => {
  const spot = defaultSpot(0);
  const unknown = rigHint(0, spot, () => null);
  assert.match(unknown, /good start at this spot\.$/);
  const known = rigHint(0, spot, (i) => BIOMES[0].fish[i]);
  assert.match(known, / is good for [A-Za-z ]+ here\.$/);
});
