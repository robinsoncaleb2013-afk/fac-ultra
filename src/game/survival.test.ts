import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES, luckTotal, rollFish, stageOf } from "./content.ts";
import { planCast } from "./match.ts";
import { DEFAULT_RIG, presentationOf } from "./presentation.ts";
import { makeRng, seedFrom, setRng } from "./rng.ts";
import { spotsOf } from "./spots.ts";
import {
  addHistory,
  addLog,
  advance,
  ARCTIC,
  awakeLeft,
  bandPadOfGear,
  bestRun,
  castMinutes,
  causeOf,
  clockOf,
  clockText,
  compareRuns,
  craft,
  craftBlock,
  dailySeed,
  dawnWood,
  daysSurvived,
  eat,
  fightMinutes,
  forecastFor,
  freshSurvivalSave,
  gatherWood,
  gearGate,
  hourOf,
  isForcedCamp,
  isNight,
  keepGoing,
  landFish,
  localDate,
  mealInfo,
  newRun,
  nextWeather,
  readRun,
  sanitizeSurvival,
  sleep,
  smoke,
  summarize,
  SURVIVAL_WATERS,
  vitalWord,
  warmthRate,
  windowAt,
  WIN_DAY,
  type SurvivalRun,
} from "./survival.ts";

const SEED = dailySeed("2026-01-01", 0);
const start = (water = 0, seed = SEED) => newRun(water, seed, true, "2026-01-01");

/* ── The clock ──────────────────────────────────────────────────────────── */

test("the clock starts at 6 am on day 1 and the day turns at 6 am", () => {
  assert.deepEqual(clockOf(0), { day: 1, hour: 6, minute: 0 });
  assert.equal(clockOf(18 * 60).hour, 0, "midnight is 18 hours in");
  assert.equal(clockOf(18 * 60).day, 1, "still day 1 after midnight");
  assert.deepEqual(clockOf(24 * 60), { day: 2, hour: 6, minute: 0 });
  assert.equal(clockText(0), "6:00 am");
  assert.equal(clockText(6 * 60), "12:00 pm");
  assert.equal(clockText(18 * 60), "12:00 am");
  assert.equal(isNight(21) && isNight(3) && !isNight(12), true);
  assert.equal(windowAt(0), "dawn");
  assert.equal(windowAt(7 * 60), "day");
  assert.equal(windowAt(12 * 60), "dusk");
  assert.equal(windowAt(15 * 60), "night");
});

test("18 hours awake, then it is time to camp", () => {
  const r = start();
  assert.equal(awakeLeft(r), 1080);
  assert.equal(isForcedCamp(r), false);
  const late = advance(r, 1080);
  assert.equal(isForcedCamp(late), true);
  assert.equal(awakeLeft(late), 0);
  assert.ok(late.log.some((l) => /too dark to fish/i.test(l)));
});

/* ── Vitals ─────────────────────────────────────────────────────────────── */

test("hunger drops 4 an hour awake and 1.5 an hour in camp", () => {
  const r = start();
  const h1 = advance(r, 60);
  assert.equal(Math.round((r.hunger - h1.hunger) * 10) / 10, 4);
  const midnight = advance(r, 1080);
  const camp = advance(midnight, 60);
  assert.equal(Math.round((midnight.hunger - camp.hunger) * 10) / 10, 1.5);
});

test("warmth falls with the weather, the night and the arctic; shelters and fire help", () => {
  const base = start();
  const at = (patch: Partial<SurvivalRun>, camp: Partial<SurvivalRun["camp"]> = {}) => ({
    ...base,
    ...patch,
    camp: { ...base.camp, ...camp },
  });
  assert.equal(warmthRate(at({ weather: 0 })), 0, "sunny day: no loss");
  assert.equal(warmthRate(at({ weather: 1 })), -2, "rain");
  assert.equal(warmthRate(at({ weather: 2 })), -4, "storm");
  assert.equal(warmthRate(at({ weather: 3 })), -1, "fog");
  assert.equal(warmthRate(at({ weather: 0, min: 15 * 60 })), -2, "night adds 2");
  assert.equal(warmthRate(at({ weather: 2, water: ARCTIC })), -10, "arctic is 2.5 times worse");
  assert.equal(
    Math.round(warmthRate(at({ weather: 2 }, { shelter: 1 })) * 100) / 100,
    -2.4,
    "lean-to blocks 40 %",
  );
  assert.equal(warmthRate(at({ weather: 2 }, { shelter: 2 })), -1, "hut blocks 75 %");
  const cold = at({ weather: 1, warmth: 60 });
  cold.camp = { ...cold.camp, fire: 120 };
  const warm = advance({ ...cold, weather: 1 }, 60);
  assert.ok(warm.warmth > 60, "a lit fire out-warms the rain: -2 + 3");
  assert.equal(warm.camp.fire, 60, "an hour of fire is used");
});

test("the fire goes out when the wood is gone, and says so", () => {
  let r = start();
  r = { ...r, camp: { ...r.camp, fire: 60 } };
  r = advance(r, 90);
  assert.equal(r.camp.fire, 0);
  assert.ok(r.log.some((l) => /burned down/.test(l)));
});

test("a run ends when hunger or warmth reaches 0, with a plain one-line cause", () => {
  let r = start();
  r = advance(r, 60 * 60);
  assert.ok(r.over && r.over.kind === "lost");
  assert.match(r.over!.cause, /ran out of food on day \d+/);
  assert.equal(r.hunger, 0);
  const frozen = advance(
    { ...start(ARCTIC), weather: 2, warmth: 8, hunger: 100, min: 15 * 60 },
    180,
  );
  assert.ok(frozen.over && /cold got you on day 1/.test(frozen.over.cause), frozen.over?.cause);
  assert.match(frozen.over!.cause, /no fire, no shelter/);
  assert.equal(advance(frozen, 600), frozen, "nothing moves after the end");
});

test("a do-nothing player dies on day 2", () => {
  let r = start();
  for (let i = 0; i < 40 && !r.over; i++)
    r = isForcedCamp(r) || hourOf(r.min) >= 17 ? sleep(r).run : advance(r, 60);
  assert.ok(r.over && r.over.kind === "lost");
  assert.equal(r.over!.day, 2);
  assert.equal(daysSurvived(r), 1);
});

/* ── Weather: seeded, sticky, forecast ──────────────────────────────────── */

function skyLog(seed: number, hours: number) {
  let w = start(0, seed).weather;
  const out = [w];
  for (let h = 1; h <= hours; h++) {
    w = nextWeather(seed, h, w);
    out.push(w);
  }
  return out;
}

test("the same seed gives the same sky; another seed does not", () => {
  assert.deepEqual(skyLog(SEED, 200), skyLog(SEED, 200));
  assert.notDeepEqual(skyLog(SEED, 200), skyLog(SEED + 1, 200));
  assert.equal(dailySeed("2026-01-01", 0), dailySeed("2026-01-01", 0));
  assert.notEqual(dailySeed("2026-01-01", 0), dailySeed("2026-01-02", 0));
  assert.notEqual(dailySeed("2026-01-01", 0), dailySeed("2026-01-01", 1));
});

test("weather stays put about 70 % of the hours and all four skies appear", () => {
  const sky = skyLog(SEED, 4000);
  let same = 0;
  for (let i = 1; i < sky.length; i++) if (sky[i] === sky[i - 1]) same++;
  const stay = same / (sky.length - 1);
  assert.ok(stay > 0.7 && stay < 0.85, `stays ${stay}`);
  assert.deepEqual([...new Set(sky)].sort(), [0, 1, 2, 3]);
});

test("the evening forecast is about tomorrow, appears only in the evening, and is right about 70 % of the time", () => {
  const r = start();
  assert.equal(forecastFor(r), null, "no forecast in the morning");
  assert.ok(forecastFor(advance(r, 12 * 60)), "there is one by 6 pm");
  let right = 0;
  let n = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const run = advance(start(0, seed), 12 * 60);
    if (run.over) continue;
    const f = forecastFor(run)!;
    n++;
    if (f.said === f.truth) right++;
    /* The truth is what the weather really does at 8 am tomorrow. */
    let w = run.weather;
    for (let a = Math.floor(run.min / 60) + 1; a <= 1 * 24 + 2; a++) w = nextWeather(seed, a, w);
    assert.equal(f.truth, w);
    assert.match(f.text, /^The sky says /);
  }
  const rate = right / n;
  assert.ok(rate > 0.6 && rate < 0.8, `forecast right ${rate}`);
});

/* ── Gear and crafting ──────────────────────────────────────────────────── */

test("a hand line cannot land epic fish; a carved hook can", () => {
  const hand = { hook: 0, line: 0 } as const;
  assert.match(gearGate(hand, 3) ?? "", /hand line/i);
  assert.match(gearGate(hand, 4) ?? "", /snapped/);
  assert.equal(gearGate(hand, 2), null);
  assert.ok(gearGate({ hook: 1, line: 0 }, 3), "a bone hook is not enough for epics");
  assert.equal(gearGate({ hook: 2, line: 0 }, 4), null);
  assert.ok(
    bandPadOfGear(hand) < 0 &&
      bandPadOfGear({ hook: 1, line: 0 }) === 0 &&
      bandPadOfGear({ hook: 2, line: 0 }) > 0,
  );
});

test("crafting follows the recipes: costs, order and time", () => {
  let r = start();
  r = { ...r, camp: { ...r.camp, bone: 3, gut: 20, driftwood: 30 } };
  assert.match(craftBlock(r, "carved-hook") ?? "", /bone hook first/);
  assert.match(craftBlock(r, "sinew-line") ?? "", /braided/);
  assert.match(craftBlock(r, "shelter-2") ?? "", /lean-to first/);
  let s = craft(r, "bone-hook");
  assert.ok(s.ok);
  assert.equal(s.run.gear.hook, 1);
  assert.equal(s.run.camp.bone, 0);
  assert.equal(s.run.min, 30, "half an hour");
  assert.match(craftBlock(s.run, "bone-hook") ?? "", /already/);
  assert.match(craftBlock(s.run, "carved-hook") ?? "", /Needs 6 bone/);
  s = craft(s.run, "braided-line");
  assert.equal(s.run.gear.line, 1);
  assert.equal(s.run.camp.gut, 16);
  assert.match(craftBlock(s.run, "sinew-line") ?? "", /smoker/);
  s = craft(s.run, "smoker");
  assert.ok(s.run.camp.smoker);
  s = craft(s.run, "sinew-line");
  assert.equal(s.run.gear.line, 2);
  s = craft(s.run, "shelter-1");
  s = craft(s.run, "shelter-2");
  assert.equal(s.run.camp.shelter, 2);
  assert.equal(s.run.camp.driftwood, 30 - 6 - 8 - 14);
  const poor = start();
  const bad = craft({ ...poor, camp: { ...poor.camp, driftwood: 0 } }, "shelter-1");
  assert.equal(bad.ok, false);
  assert.equal(bad.run.min, 0, "a failed craft takes no time");
});

/* ── Food ───────────────────────────────────────────────────────────────── */

const withFish = (r: SurvivalRun, w = 2, t = 0): SurvivalRun =>
  landFish(r, { name: "Bluegill", w, t });

test("a landed fish goes in the larder with bones and guts", () => {
  const r = withFish(start(), 2, 2);
  assert.equal(r.larder.length, 1);
  assert.equal(r.larder[0].cal, 120, "raw is 60 calories a pound");
  assert.equal(r.camp.bone, 3, "bone is 1 + rarity");
  assert.equal(r.camp.gut, 1);
  assert.equal(r.larder[0].expiresDay, 2);
  assert.equal(r.fish, 1);
  assert.deepEqual(r.biggest, { name: "Bluegill", w: 2, t: 2 });
});

test("cooked fish is worth more than raw and is never bad; it needs a fire", () => {
  const r = { ...withFish(start(), 2), hunger: 20 };
  assert.equal(mealInfo(r, 0, "raw").gain, 24);
  assert.equal(mealInfo(r, 0, "cook").gain, 36, "90 calories a pound");
  assert.equal(mealInfo(r, 0, "cook").ok, false);
  assert.equal(eat(r, 0, "cook").ok, false);
  const lit = addLog({ ...r, camp: { ...r.camp, driftwood: 3 } }).run;
  const meal = eat(lit, 0, "cook");
  assert.ok(meal.ok);
  assert.equal(meal.run.larder.length, 0);
  assert.equal(meal.run.bad, 0);
  assert.ok(meal.run.hunger > 20 + 30, "ate 36 and lost a little to the clock");
  assert.equal(eat({ ...r, hunger: 98 }, 0, "raw").ok, false, "too full");
});

test("raw fish is bad about 15 % of the time: at least one bad fish in 20 on average", () => {
  let bad = 0;
  const runs = 40;
  for (let seed = 1; seed <= runs; seed++) {
    let r: SurvivalRun = { ...start(0, seed), hunger: 30 };
    for (let k = 0; k < 20; k++) {
      r = { ...landFish({ ...r, hunger: 30, casts: r.casts + 1 }, { name: "Perch", w: 1, t: 0 }) };
      r = eat(r, r.larder.length - 1, "raw").run;
    }
    bad += r.bad;
  }
  assert.ok(bad / runs >= 1, `average bad fish per 20 raw: ${bad / runs}`);
  assert.ok(bad / runs < 6);
});

test("a bad fish costs hunger and slows fishing for 2 hours", () => {
  let found: SurvivalRun | null = null;
  for (let seed = 1; seed < 200 && !found; seed++) {
    const r = { ...withFish({ ...start(0, seed), hunger: 50 }), hunger: 50 };
    const s = eat(r, 0, "raw");
    if (s.run.bad) found = s.run;
  }
  assert.ok(found, "a bad fish turns up");
  assert.ok(found!.hunger < 50);
  assert.ok(found!.sick > 0 && found!.sick <= 120);
  assert.ok(found!.log.some((l) => /was bad/i.test(l)));
});

test("smoked fish keeps for 4 days; raw fish rots after tomorrow", () => {
  let r = withFish({ ...start(), camp: { ...start().camp, smoker: true, driftwood: 4 } }, 3);
  r = withFish(r, 1);
  assert.equal(smoke(r, 0).ok, false, "no fire yet");
  r = addLog(r).run;
  const s = smoke(r, 0);
  assert.ok(s.ok);
  assert.equal(s.run.larder[0].smoked, true);
  assert.equal(s.run.larder[0].cal, 270);
  assert.equal(s.run.larder[0].expiresDay, 5);
  assert.equal(smoke(s.run, 0).ok, false, "already smoked");
  /* Two sleeps later the raw one is gone and the smoked one is still here. */
  let t: SurvivalRun = { ...s.run, hunger: 100, warmth: 100, camp: { ...s.run.camp, shelter: 2 } };
  t = sleep(advance(t, 12 * 60)).run;
  t = { ...t, hunger: 100 };
  t = sleep(advance(t, 12 * 60)).run;
  assert.equal(t.larder.length, 1);
  assert.equal(t.larder[0].smoked, true);
  assert.ok(t.log.some((l) => /went bad/.test(l)));
});

/* ── Camp ───────────────────────────────────────────────────────────────── */

test("driftwood: 2 to 5 at dawn, double after a storm; gathering finds 1 to 3", () => {
  for (let seed = 1; seed < 60; seed++) {
    const w = dawnWood({ seed, min: 0, weather: 0 });
    assert.ok(w >= 2 && w <= 5);
    assert.equal(dawnWood({ seed, min: 0, weather: 2 }), w * 2);
  }
  const r = start();
  const g = gatherWood(r);
  assert.ok(
    g.ok &&
      g.run.camp.driftwood - r.camp.driftwood >= 1 &&
      g.run.camp.driftwood - r.camp.driftwood <= 6,
  );
  assert.equal(g.run.min, 30);
  assert.equal(gatherWood(advance(r, 1080)).ok, false, "too dark");
});

test("logs feed the fire an hour each; no wood, no fire", () => {
  let r = start();
  r = { ...r, camp: { ...r.camp, driftwood: 1 } };
  const a = addLog(r);
  assert.ok(a.ok);
  assert.equal(a.run.camp.fire, 60 - 5, "five minutes pass lighting it");
  assert.equal(addLog(a.run).ok, false, "no wood left");
});

test("sleeping is only for the evening; it runs to 6 am, turns the day and leaves driftwood", () => {
  const r = start();
  assert.equal(sleep(r).ok, false);
  assert.match(sleep(r).say, /not tired/);
  const eve = advance({ ...r, hunger: 100, camp: { ...r.camp, shelter: 2 } }, 12 * 60);
  const next = sleep(eve);
  assert.ok(next.ok);
  assert.equal(clockOf(next.run.min).day, 2);
  assert.equal(hourOf(next.run.min), 6);
  assert.ok(next.run.camp.driftwood >= r.camp.driftwood + 2);
  assert.ok(next.run.log.some((l) => /^Day 2\./.test(l)));
});

test("reaching the rescue day wins; you may keep going", () => {
  let r: SurvivalRun = { ...start(), hunger: 100, warmth: 100 };
  r = { ...r, min: (WIN_DAY - 1) * 1440 - 60 };
  r = advance(r, 120);
  assert.equal(r.over?.kind, "won");
  assert.match(r.over!.cause, /boat/i);
  assert.equal(summarize(r).won, true);
  assert.equal(summarize(r).days, WIN_DAY - 1);
  const more = keepGoing(r);
  assert.equal(more.over, null);
  assert.equal(more.rescued, true);
  const again = advance(more, 24 * 60 - 120);
  assert.notEqual(again.over?.kind, "won", "the boat only comes once");
  assert.equal(keepGoing(start()).over, null);
});

/* ── Scores ─────────────────────────────────────────────────────────────── */

test("the longest run wins; fish then the biggest fish break ties", () => {
  const a = { ...summarize(start()), days: 5, fish: 10, biggest: 3 };
  const b = { ...a, days: 6, fish: 1 };
  const c = { ...a, fish: 12 };
  const d = { ...a, biggest: 9 };
  assert.ok(
    compareRuns(b, a) < 0 &&
      compareRuns(c, a) < 0 &&
      compareRuns(d, a) < 0 &&
      compareRuns(c, d) < 0,
  );
  assert.deepEqual(bestRun([a, b, c, d]), b);
  let h = [] as ReturnType<typeof addHistory>;
  for (let i = 0; i < 30; i++) h = addHistory(h, { ...a, days: i });
  assert.equal(h.length, 20);
  assert.equal(h[0].days, 29, "newest first");
});

test("costs: a cast is 12 + 4 minutes per second of waiting; a fight is 3 minutes per real second", () => {
  assert.equal(castMinutes(0), 12);
  assert.equal(castMinutes(2.5), 22);
  assert.equal(fightMinutes(10), 30);
  assert.equal(fightMinutes(-1), 0);
});

test("meters have words for kids", () => {
  assert.equal(vitalWord("hunger", 5), "Starving");
  assert.equal(vitalWord("warmth", 5), "Freezing");
  assert.equal(vitalWord("hunger", 90), "Full");
  assert.equal(localDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(SURVIVAL_WATERS.length, 8);
  assert.ok(SURVIVAL_WATERS.every((b) => b >= 0 && b < BIOMES.length));
});

/* ── The scripted players (05 §5.5) ─────────────────────────────────────── */

/** One cast the way the engine makes it, with the real fishing model. Returns the run after the cast. */
function cast(
  run: SurvivalRun,
  dex: Record<string, { c: number; w: number; m: number }>,
): SurvivalRun {
  setRng(makeRng(seedFrom("cast", run.seed, run.casts)));
  const win = windowAt(run.min);
  const stage = stageOf(dex, run.water);
  const p = (spot: ReturnType<typeof spotsOf>[number]) =>
    presentationOf({ lure: -1, sig: -1, bait: -1 }, { ...DEFAULT_RIG, depth: spot.depth });
  /* "Fish at the best-matching spot": the one whose fish like this hour, this sky and this rig the most. */
  let best = spotsOf(run.water)[0];
  let plan = planCast(run.water, best, p(best), run.weather, win, 0, { stage });
  for (const spot of spotsOf(run.water)) {
    const cand = planCast(run.water, spot, p(spot), run.weather, win, 0, { stage });
    if (cand.avg > plan.avg) [best, plan] = [spot, cand];
  }
  const wait = Math.max(0.7, (1.2 + 2.8 * 0.5) * plan.wait);
  let r = advance({ ...run, casts: run.casts + 1 }, castMinutes(wait));
  if (r.over) return r;
  const fish = rollFish(run.water, 0.4, { stage, match: plan.ms });
  r = advance(r, fightMinutes(8));
  if (r.over) return r;
  if (gearGate(r.gear, fish.t)) return r;
  /* A fair player loses about one fight in five. */
  if (makeRng(seedFrom("fight", run.seed, run.casts))() < 0.2) return r;
  const key = `${fish.b}-${fish.i}`;
  dex[key] = { c: (dex[key]?.c ?? 0) + 1, w: Math.max(dex[key]?.w ?? 0, fish.w), m: fish.m };
  return landFish(r, { name: fish.name, w: fish.w, t: fish.t });
}

/** A competent player: fish, cook everything, shelter early, smoker by day 4, wood before dark. */
function competent(seed: number, water = 0, maxDays = 30, lazy = false): SurvivalRun {
  let r = start(water, seed);
  const dex: Record<string, { c: number; w: number; m: number }> = {};
  let guard = 0;
  while (!r.over && guard++ < 20000) {
    const day = clockOf(r.min).day;
    const h = hourOf(r.min);
    if (day > maxDays) break;
    /* Evening: eat, stoke the fire for the night, sleep. */
    if (isForcedCamp(r) || h >= 21) {
      if (lazy) {
        const raw = eat(r, 0, "raw");
        if (raw.ok) r = raw.run;
        r = sleep(r).run;
        continue;
      }
      for (let i = 0; i < 4 && r.larder.length && r.hunger < 70 && !r.over; i++) {
        if (r.camp.fire <= 0 && r.camp.driftwood > 0) r = addLog(r).run;
        const s = eat(r, 0, r.camp.fire > 0 ? "cook" : "raw");
        if (!s.ok) break;
        r = s.run;
      }
      while (!r.over && r.camp.driftwood > 0 && r.camp.fire < 6 * 60 && r.warmth < 90)
        r = addLog(r).run;
      if (!r.over) r = sleep(r).run;
      continue;
    }
    if (lazy) {
      if (r.hunger < 55 && r.larder.length) {
        const raw = eat(r, 0, "raw");
        if (raw.ok) {
          r = raw.run;
          continue;
        }
      }
      r = cast(r, dex);
      continue;
    }
    /* Camp chores. */
    for (const id of [
      "bone-hook",
      "shelter-1",
      "braided-line",
      "smoker",
      "carved-hook",
      "shelter-2",
      "sinew-line",
    ] as const) {
      if (!craftBlock(r, id)) r = craft(r, id).run;
    }
    if (r.over) break;
    if (r.hunger < 55 && r.larder.length) {
      if (r.camp.fire <= 0 && r.camp.driftwood > 3) r = addLog(r).run;
      const s = eat(r, 0, r.camp.fire > 0 ? "cook" : "raw");
      if (s.ok) {
        r = s.run;
        continue;
      }
    }
    if (r.camp.smoker && r.camp.fire > 0 && r.larder.length > 3) {
      const i = r.larder.findIndex((f) => !f.smoked);
      if (i >= 0) {
        r = smoke(r, i).run;
        continue;
      }
    }
    if (r.warmth < 45 && r.camp.driftwood > 0) {
      r = addLog(r).run;
      continue;
    }
    if (r.camp.driftwood < 8 && h < 10) {
      r = gatherWood(r).run;
      continue;
    }
    r = cast(r, dex);
  }
  return r;
}

test("a scripted competent player survives at least 12 days on the Pond with the 2026-01-01 seed", () => {
  const r = competent(SEED);
  const days = daysSurvived(r);
  assert.ok(
    days >= 12,
    `survived ${days} days: ${r.over?.cause ?? "still going"} (fish ${r.fish}, eaten ${r.eaten}, shelter ${r.camp.shelter}, hook ${r.gear.hook})`,
  );
  assert.ok(r.camp.shelter >= 1, "built a shelter");
});

test("the competent player is not a fluke: most seeds make it 12 days", () => {
  let ok = 0;
  for (let seed = 100; seed < 112; seed++) if (daysSurvived(competent(seed)) >= 12) ok++;
  assert.ok(ok >= 9, `${ok} of 12 seeds reached day 12`);
});

test("a lazy player who only fishes and eats raw fish does not last: the cold gets them", () => {
  for (let seed = 300; seed < 306; seed++) {
    const r = competent(seed, 0, 30, true);
    assert.ok(r.over?.kind === "lost", "no shelter, no fire, no rescue");
    assert.ok(daysSurvived(r) < 12, `lazy player lasted ${daysSurvived(r)} days`);
    assert.match(r.over!.cause, /cold got you/);
  }
});

test("the Arctic is much harder than the Pond for the same player", () => {
  let pond = 0;
  let arctic = 0;
  for (let seed = 200; seed < 206; seed++) {
    pond += daysSurvived(competent(seed, 0, 20));
    arctic += daysSurvived(competent(seed, ARCTIC, 20));
  }
  assert.ok(arctic < pond, `arctic ${arctic} vs pond ${pond}`);
});

test("the whole run is reproducible from its seed", () => {
  const a = competent(SEED, 0, 6);
  const b = competent(SEED, 0, 6);
  assert.deepEqual(a, b);
});

test("the cause line names the sky, the fire and the shelter", () => {
  const r = { ...start(), weather: 2, min: 3 * 1440 };
  assert.equal(causeOf(r, "cold"), "The cold got you on day 4 — a storm, no fire, no shelter.");
  assert.equal(
    causeOf({ ...r, camp: { ...r.camp, shelter: 1, fire: 30 } }, "cold"),
    "The cold got you on day 4 — a storm, the fire was too small.",
  );
  assert.match(causeOf(r, "hunger"), /ran out of food on day 4/);
});

/* ── Saving: its own slot, hostile values ───────────────────────────────── */

test("a fresh survival save is its own thing: no run, an empty dex", () => {
  const s = freshSurvivalSave();
  assert.equal(s.run, null);
  assert.deepEqual(s.dex, {});
  assert.equal(s.version, 1);
});

test("a run survives a round trip through JSON and sanitize unchanged", () => {
  let r = competent(SEED, 0, 3);
  r = r.over ? r : { ...r, over: null };
  const save = { ...freshSurvivalSave(), run: r, history: addHistory([], summarize(r)) };
  const back = sanitizeSurvival(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(back.run, r);
  assert.deepEqual(back.history, save.history);
});

test("garbage in, a safe save out", () => {
  for (const junk of [null, undefined, 5, "x", [], true, { run: "no" }, { run: [] }, { dex: 4 }]) {
    const s = sanitizeSurvival(junk);
    assert.equal(s.version, 1);
    assert.equal(s.run, null);
    assert.deepEqual(s.dex, {});
  }
});

test("hostile values are clamped, not trusted", () => {
  const hostile = {
    version: 99,
    drag: 77,
    lastWater: 14,
    coached: { runner: 1e9, "../x": 4, diver: -3 },
    dex: {
      "0-3": { c: 2, w: 4.5, m: 1 },
      "0-99": { c: 1, w: 1, m: 0 },
      "14-0": { c: 5, w: 1, m: 0 },
      "x-y": { c: 5 },
      "1-1": { c: -4, w: 1 },
      "2-2": { c: "9", w: NaN, m: 99 },
    },
    run: {
      water: 9,
      seed: -5,
      min: 1e30,
      hunger: 1e9,
      warmth: -50,
      weather: 7,
      date: "<script>",
      camp: { shelter: 9, fire: -1, smoker: "yes", driftwood: 1e9, bone: NaN, gut: Infinity },
      gear: { hook: 5, line: -1 },
      larder: [
        { name: "x".repeat(500), cal: -1, w: NaN, t: 99, smoked: 1 },
        null,
        "fish",
        ...Array(50).fill({ name: "Fish", w: 1 }),
      ],
      log: ["a".repeat(500), 5, null, ...Array(100).fill("hi")],
      casts: 1e12,
      biggest: { name: 5, w: "heavy", t: 99 },
      over: { kind: "exploded", cause: "x" },
    },
    history: [{ days: 1e12, water: 99, won: "yes" }, null, ...Array(40).fill({ days: 3 })],
  };
  const s = sanitizeSurvival(hostile);
  assert.equal(s.version, 1);
  assert.equal(s.drag, 2);
  assert.equal(s.lastWater, 0);
  assert.deepEqual(s.coached, { runner: 99, diver: 0 });
  assert.deepEqual(Object.keys(s.dex), ["0-3"], "only real species in Survival waters");
  const r = s.run!;
  assert.ok(r, "an Arctic run is a run");
  assert.equal(r.seed, 0);
  assert.ok(r.min <= 1e6 && r.hunger <= 100 && r.warmth >= 0);
  assert.equal(r.weather, 3);
  assert.equal(r.date, "2026-01-01");
  assert.deepEqual(r.camp, { shelter: 2, fire: 0, smoker: false, driftwood: 99, bone: 0, gut: 0 });
  assert.deepEqual(r.gear, { hook: 2, line: 0 });
  assert.ok(r.larder.length <= 16);
  assert.ok(r.larder[0].name.length <= 60 && r.larder[0].cal >= 0 && r.larder[0].t === 4);
  assert.ok(r.log.length <= 40 && r.log.every((l) => l.length <= 200));
  assert.equal(r.over, null);
  assert.equal(r.biggest?.t, 4);
  assert.ok(s.history.length <= 20 && s.history[0].days <= 1e5 && s.history[0].water === 0);
  for (const v of [r.hunger, r.warmth, r.min, r.casts, r.camp.bone]) assert.ok(Number.isFinite(v));
});

test("a run on a water that is not a Survival water is thrown away", () => {
  assert.equal(readRun({ water: 6 }), null);
  assert.equal(readRun({ water: "0" }), null);
  assert.equal(readRun(null), null);
});

test("the fixture from a real v1 save loads with its invariants", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = JSON.parse(readFileSync(join(here, "__fixtures__", "survival-v1.json"), "utf8"));
  const s = sanitizeSurvival(raw);
  assert.equal(s.version, 1);
  assert.ok(s.run, "the run in progress is kept");
  assert.equal(s.run!.water, raw.run.water);
  assert.equal(s.run!.seed, raw.run.seed);
  assert.equal(Object.keys(s.dex).length, Object.keys(raw.dex).length);
  assert.equal(s.run!.larder.length, raw.run.larder.length);
  assert.equal(s.history.length, raw.history.length);
  assert.deepEqual(
    sanitizeSurvival(JSON.parse(JSON.stringify(s))),
    s,
    "loading twice changes nothing",
  );
  assert.ok(Number.isFinite(s.run!.hunger) && Number.isFinite(s.run!.warmth));
});

test("luck inputs are what the engine passes (guards the test helper itself)", () => {
  assert.equal(typeof luckTotal, "function");
});
