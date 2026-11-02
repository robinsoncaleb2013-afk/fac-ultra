/* Long-play events and mutations (docs/architecture/11): the table, the simulated clock, the night/Astral rules,
   multipliers that apply once, the save round trip, and a tournament's replayed stream staying untouched. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { catchXp } from "./keep.ts";
import { BIOMES, FIRST_EVENT_MUTATION, MUTATIONS, betterMutation, rollFish } from "./content.ts";
import { AWAY_RESET_MS, COOLDOWN_MS, HOUR_MS, IDLE_MS } from "./event-data.ts";
import {
  ASTRAL_BIOME,
  EVENTS,
  EVENT_RARITIES,
  activeEvent,
  catchLine,
  countLanded,
  eligibleEvents,
  eventModeOn,
  eventOfMutation,
  mutateFish,
  mutationName,
  mutationOfEvent,
  nextChanceHint,
  noEvents,
  readEvents,
  rollHour,
  stepEvents,
  type EventsSave,
} from "./events.ts";
import { MODES } from "./modes.ts";
import { makeRng, rng, setRng } from "./rng.ts";

const T0 = 1_800_000_000_000;
const SEED = 424242;

/** Play a session of `ms` on a fake clock, stepping every 30 s, always active. Returns every event started, in order. */
function play(ms: number, opts: { night?: boolean; biome?: number; seed?: number; from?: EventsSave } = {}) {
  let st: EventsSave = opts.from ?? { ...noEvents(), seed: opts.seed ?? SEED, lastAt: T0 };
  const started: string[] = [];
  let now = st.lastAt;
  const end = now + ms;
  while (now < end) {
    now += 30_000;
    const r = stepEvents(st, { now, on: true, visible: true, active: true, night: !!opts.night, biome: opts.biome ?? 0 });
    st = r.state;
    if (r.started) started.push(r.started.id);
  }
  return { st, started, now };
}

test("the table is exactly Caleb's: 11 events, rarities, hours, mutations, multipliers", () => {
  const rows = EVENTS.map((e) => [e.name, EVENT_RARITIES[e.rarity].name, e.hours, e.mutation, e.kind, EVENT_RARITIES[e.rarity].mult]);
  assert.deepEqual(rows, [
    ["Shooting Stars", "Common", 1, "Starlight", "xp", 2],
    ["Meteor Collision", "Common", 1, "Trembling", "worth", 2],
    ["Blood Moon", "Uncommon", 2, "Blood Red", "xp", 3],
    ["Meteorite Strike", "Uncommon", 2, "Stone Scales", "worth", 3],
    ["Snowfall", "Rare", 3, "Chilly", "xp", 5],
    ["Alien Invasion", "Rare", 3, "Alien", "worth", 5],
    ["Radioactive Rain", "Epic", 4, "Radioactive", "xp", 10],
    ["Northern Lights", "Epic", 4, "Mesmerized", "worth", 10],
    ["Divine Intervention", "Legendary", 6, "Blessed", "xp", 15],
    ["Armageddon", "Legendary", 6, "Cursed", "worth", 15],
    ["Legend of the Fisherman", "Mythic", 10, "Fisherman's Dream", "both", 60],
  ]);
  assert.deepEqual(EVENTS.filter((e) => e.night).map((e) => e.id), ["shooting-stars", "northern-lights"]);
  assert.deepEqual(EVENTS.filter((e) => e.astral).map((e) => e.id), ["legend-of-the-fisherman"]);
  assert.ok(EVENT_RARITIES.every((r, i) => i === 0 || r.fishShare <= EVENT_RARITIES[i - 1].fishShare), "rarer events mutate fewer fish");
  assert.ok(EVENT_RARITIES.every((r) => r.fishShare > 0 && r.fishShare < 1), "never all fish");
});

test("every event has its own mutation in the one mutation table, with the right XP / worth multipliers", () => {
  assert.equal(MUTATIONS.length, FIRST_EVENT_MUTATION + EVENTS.length);
  for (const e of EVENTS) {
    const m = MUTATIONS[mutationOfEvent(e)];
    const x = EVENT_RARITIES[e.rarity].mult;
    assert.equal(m.name, e.mutation);
    assert.equal(m.w, 0, "event mutations are never rolled naturally");
    assert.equal(m.xp, e.kind === "worth" ? 1 : x);
    assert.equal(m.mult, e.kind === "xp" ? 1 : x);
    assert.equal(eventOfMutation(mutationOfEvent(e)), e);
  }
  const names = new Set(MUTATIONS.map((m) => m.name));
  assert.equal(names.size, MUTATIONS.length, "no duplicate mutation names");
});

test("eligibility by hours: 1h..10h produce exactly the right events; night-only and Astral-only rules hold", () => {
  const day = { night: false, biome: 0 };
  const night = { night: true, biome: 0 };
  const astral = { night: false, biome: ASTRAL_BIOME };
  const ids = (h: number, c: { night: boolean; biome: number }) => eligibleEvents(h, c).map((e) => e.id);
  assert.deepEqual(ids(0, night), []);
  assert.deepEqual(ids(1, day), ["meteor-collision"]);
  assert.deepEqual(ids(1, night), ["shooting-stars", "meteor-collision"]);
  assert.deepEqual(ids(2, day), ["meteor-collision", "blood-moon", "meteorite-strike"]);
  assert.deepEqual(ids(3, day).slice(-2), ["snowfall", "alien-invasion"]);
  assert.ok(!ids(3, day).includes("radioactive-rain"));
  assert.ok(ids(4, day).includes("radioactive-rain") && !ids(4, day).includes("northern-lights"));
  assert.ok(ids(4, night).includes("northern-lights"));
  assert.ok(ids(5, night).every((id) => id !== "divine-intervention"));
  assert.ok(ids(6, day).includes("divine-intervention") && ids(6, day).includes("armageddon"));
  assert.ok(!ids(9, astral).includes("legend-of-the-fisherman"));
  assert.ok(ids(10, astral).includes("legend-of-the-fisherman"));
  assert.ok(!ids(10, { night: true, biome: 3 }).includes("legend-of-the-fisherman"), "not outside the Astral Sea");
  assert.equal(BIOMES[ASTRAL_BIOME].id, "astral");
});

test("scripted sessions on a simulated clock: nothing before 1 hour, and only eligible events ever start", () => {
  assert.deepEqual(play(HOUR_MS - 60_000, { night: true }).started, []);
  for (let seed = 1; seed <= 60; seed++) {
    for (const hrs of [1, 2, 3, 4, 6, 10]) {
      const r = play(hrs * HOUR_MS + 60_000, { night: false, biome: 0, seed });
      for (const id of r.started) {
        const e = EVENTS.find((x) => x.id === id)!;
        assert.ok(e.hours <= hrs, `${id} needs ${e.hours}h, session was ${hrs}h`);
        assert.ok(!e.night && !e.astral, "no night or Astral event in a daytime session in the Pond");
      }
    }
  }
});

test("over many seeds each event can happen, in the right conditions only", () => {
  const seen = new Set<string>();
  const lateNight = new Set<string>();
  for (let seed = 1; seed <= 400; seed++) {
    for (const id of play(12 * HOUR_MS, { night: true, biome: ASTRAL_BIOME, seed }).started) lateNight.add(id);
    for (const id of play(12 * HOUR_MS, { night: false, biome: ASTRAL_BIOME, seed }).started) seen.add(id);
  }
  assert.equal(lateNight.size, EVENTS.length, "all eleven can happen at night in the Astral Sea");
  assert.ok(!seen.has("shooting-stars") && !seen.has("northern-lights"), "night events never start by day");
  assert.ok(seen.has("legend-of-the-fisherman"));
});

test("deterministic: same seed and same play give the same events; a different seed gives different ones somewhere", () => {
  const a = play(8 * HOUR_MS, { seed: 7, night: true });
  const b = play(8 * HOUR_MS, { seed: 7, night: true });
  assert.deepEqual(a.started, b.started);
  assert.deepEqual(a.st, b.st);
  assert.equal(rollHour(7, 1, 3, { night: true, biome: 0 })?.id, rollHour(7, 1, 3, { night: true, biome: 0 })?.id);
  let differs = false;
  for (let s = 1; s < 50 && !differs; s++) differs = play(8 * HOUR_MS, { seed: s }).started.join() !== a.started.join();
  assert.ok(differs);
});

test("at most one roll per real hour, one event at a time, and a cooldown after each event", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const r = play(24 * HOUR_MS, { seed, night: true, biome: ASTRAL_BIOME });
    assert.ok(r.st.rolled <= 24, "a roll per hour of play at most");
    assert.ok(r.started.length <= 24);
  }
  /* Start one by hand and check the cooldown blocks the next roll. */
  const st: EventsSave = { ...noEvents(), seed: 1, lastAt: T0, streakMs: HOUR_MS - 30_000, rolled: 0 };
  let found: EventsSave | null = null;
  for (let seed = 1; seed < 200 && !found; seed++) {
    const r = stepEvents({ ...st, seed }, { now: T0 + 30_000, on: true, visible: true, active: true, night: false, biome: 0 });
    if (r.started) found = r.state;
  }
  assert.ok(found?.active, "found a seed that starts Meteor Collision at 1 hour");
  const dur = EVENT_RARITIES[0].minutes * 60_000;
  assert.equal(found!.active!.endsAt - found!.active!.startedAt, dur);
  const after = stepEvents(found!, { now: found!.active!.endsAt + 1000, on: true, visible: true, active: true, night: false, biome: 0 });
  assert.ok(after.ended && !after.state.active);
  assert.ok(after.state.cooldownUntil >= found!.active!.endsAt + COOLDOWN_MS);
});

test("what 'straight' means: idle and hidden time pause the clock; a long break resets it; short breaks keep it", () => {
  let st: EventsSave = { ...noEvents(), seed: 3, lastAt: T0 };
  const s = (now: number, over: Partial<{ visible: boolean; active: boolean }> = {}) => {
    st = stepEvents(st, { now, on: true, visible: true, active: true, night: false, biome: 0, ...over }).state;
  };
  s(T0 + 60_000);
  assert.equal(st.streakMs, 60_000);
  s(T0 + 120_000, { active: false });
  assert.equal(st.streakMs, 60_000, "idle time is not counted");
  s(T0 + 180_000, { visible: false });
  assert.equal(st.streakMs, 60_000, "hidden time is not counted");
  s(T0 + 240_000);
  assert.equal(st.streakMs, 120_000, "a short break only pauses it");
  assert.equal(st.awayMs, 0);
  /* Away longer than the limit while the tab stays open. */
  for (let t = 1; t <= 11; t++) s(T0 + 240_000 + t * 60_000, { active: false });
  assert.equal(st.streakMs, 0, `more than ${AWAY_RESET_MS / 60_000} minutes away ends the streak`);
  assert.equal(st.session, 1);
  assert.ok(IDLE_MS < AWAY_RESET_MS);
});

test("a reload inside the tolerance keeps the streak; closing the game for longer loses it", () => {
  const first = play(90 * 60_000, { seed: 9 });
  const saved = readEvents(JSON.parse(JSON.stringify(first.st)));
  assert.deepEqual(saved, first.st, "events survive a save round trip");
  const quick = stepEvents(saved, { now: first.now + 4 * 60_000, on: true, visible: true, active: true, night: false, biome: 0 });
  assert.equal(quick.state.streakMs, first.st.streakMs + 4 * 60_000);
  assert.equal(quick.reset, false);
  const slow = stepEvents(saved, { now: first.now + 30 * 60_000, on: true, visible: true, active: true, night: false, biome: 0 });
  assert.equal(slow.state.streakMs, 0);
  assert.equal(slow.reset, true);
  assert.deepEqual(slow.state.seen, saved.seen, "seen events are kept");
});

test("a new streak rolls new dice (not a repeat of the last streak)", () => {
  const dayCtx = { night: false, biome: 0 };
  let differs = false;
  for (let seed = 1; seed < 100 && !differs; seed++) {
    for (let h = 3; h <= 6; h++) differs ||= rollHour(seed, 1, h, dayCtx)?.id !== rollHour(seed, 2, h, dayCtx)?.id;
  }
  assert.ok(differs);
});

test("an event ends on the wall clock even if the game was closed; seen events are counted", () => {
  const seed = (() => {
    for (let x = 1; x < 500; x++) if (play(HOUR_MS + 60_000, { seed: x }).started.length) return x;
    return 0;
  })();
  const r = play(HOUR_MS + 60_000, { seed });
  assert.equal(r.started.length, 1);
  const id = r.started[0];
  assert.equal(r.st.seen[id], 1);
  assert.ok(activeEvent(r.st, r.now));
  assert.equal(activeEvent(r.st, r.now + 3 * HOUR_MS), null);
  const back = stepEvents(r.st, { now: r.now + 3 * HOUR_MS, on: true, visible: true, active: true, night: false, biome: 0 });
  assert.equal(back.ended?.id, id);
});

/* ── mutations ── */

const fish = (m = 0, boss = false) => ({ b: 0, i: 3, t: 0, m, name: "Perch", w: 2, v: 100, boss });

test("a mutation applies once: worth events multiply value only, XP events XP only, the Mythic both; nothing stacks", () => {
  const st = { ...noEvents(), seed: 11 };
  for (const e of EVENTS) {
    let hit = null as null | ReturnType<typeof mutateFish>;
    for (let d = 0; d < 400 && !hit?.hit; d++) hit = mutateFish({ ...st, draws: d }, fish(), e, "Perch");
    assert.ok(hit?.hit, `${e.id} mutates some fish`);
    const x = EVENT_RARITIES[e.rarity].mult;
    assert.equal(hit.fish.v, e.kind === "xp" ? 100 : 100 * x, `${e.id} worth`);
    assert.equal(hit.fish.name, `${e.mutation} Perch`);
    const base = catchXp(0, 0, 0, false);
    assert.equal(catchXp(0, hit.fish.m, 0, false), e.kind === "worth" ? base : Math.round(base * x), `${e.id} xp`);
    /* Run it again on the already-mutated fish: unchanged. */
    const again = mutateFish({ ...st, draws: 0 }, hit.fish, e, "Perch");
    assert.equal(again.hit, false);
    assert.equal(again.fish.v, hit.fish.v);
  }
});

test("only some fish mutate, in line with the event's share; bosses and already-mutated fish never do", () => {
  const e = EVENTS[0];
  let hits = 0;
  const N = 4000;
  for (let d = 0; d < N; d++) if (mutateFish({ ...noEvents(), seed: 5, draws: d }, fish(), e, "Perch").hit) hits++;
  const share = hits / N;
  assert.ok(Math.abs(share - EVENT_RARITIES[0].fishShare) < 0.03, `share ${share}`);
  assert.ok(share < 1);
  for (let d = 0; d < 300; d++) {
    assert.equal(mutateFish({ ...noEvents(), seed: 5, draws: d }, fish(0, true), e, "Perch").hit, false, "bosses");
    assert.equal(mutateFish({ ...noEvents(), seed: 5, draws: d }, fish(2), e, "Perch").hit, false, "a Golden fish stays Golden");
  }
});

test("existing mutation behaviour is unchanged: natural XP bonus, natural worth, and rolled fish are never event mutations", () => {
  assert.equal(catchXp(2, 1, 3, false), 3 + 16 + 5 + 6);
  assert.equal(catchXp(4, 5, 9, true), 3 + 32 + 25 + 18 + 12);
  setRng(makeRng(99));
  for (let n = 0; n < 3000; n++) assert.ok(rollFish(0, 100).m < FIRST_EVENT_MUTATION);
  assert.equal(betterMutation(5, FIRST_EVENT_MUTATION), 5, "Cosmic (60x) beats a 2x event mutation");
  assert.equal(betterMutation(1, mutationOfEvent(EVENTS[1])), 1, "an equal 2x boost keeps the one already in the book");
  assert.equal(betterMutation(5, mutationOfEvent(EVENTS[10])), mutationOfEvent(EVENTS[10]), "Fisherman's Dream (60x both) beats Cosmic");
});

test("catch-card lines and kid-friendly names", () => {
  assert.equal(catchLine(mutationOfEvent(EVENTS[0])), "Starlight! 2x XP");
  assert.equal(catchLine(mutationOfEvent(EVENTS[1])), "Trembling! 2x worth");
  assert.equal(catchLine(mutationOfEvent(EVENTS[10])), "Fisherman's Dream! 60x XP and 60x worth");
  assert.equal(catchLine(2), "");
  assert.equal(mutationName(mutationOfEvent(EVENTS[9])), "Cursed");
  assert.equal(mutationName(mutationOfEvent(EVENTS[9]), true), "Moonshadow");
  assert.equal(mutationName(mutationOfEvent(EVENTS[2]), true), "Ruby Red");
  assert.equal(mutationName(1, true), "Albino");
});

test("landed mutated fish are counted per event; ordinary fish change nothing", () => {
  const st = noEvents();
  assert.equal(countLanded(st, 3), st);
  const m = mutationOfEvent(EVENTS[4]);
  assert.deepEqual(countLanded(countLanded(st, m), m).fish, { snowfall: 2 });
});

test("the next-chance hint is gentle: silent early, silent during an event, rounded to 5 minutes", () => {
  const base = { ...noEvents(), seed: 1 };
  assert.equal(nextChanceHint({ ...base, streakMs: 60_000 }, T0), null);
  assert.equal(nextChanceHint({ ...base, streakMs: 20 * 60_000 }, T0), null);
  const h = nextChanceHint({ ...base, streakMs: 50 * 60_000 }, T0)!;
  assert.match(h, /about 10 minutes/);
  assert.equal(nextChanceHint({ ...base, streakMs: 50 * 60_000, active: { id: "blood-moon", startedAt: T0, endsAt: T0 + 1 } }, T0), null);
});

/* ── modes and the tournament stream ── */

test("events run in Expedition, Recreational and Co-op; never in Tournament or Survival", () => {
  assert.equal(eventModeOn(MODES.expedition), true);
  assert.equal(eventModeOn(MODES.recreational), true);
  assert.equal(eventModeOn(MODES.coop), true);
  assert.equal(eventModeOn(MODES.tournament), false);
  assert.equal(eventModeOn(MODES.survival), false);
});

test("the events clock does nothing when off, and never touches the shared fishing stream", () => {
  const off = stepEvents({ ...noEvents(), seed: 2, lastAt: T0 }, { now: T0 + 5 * HOUR_MS, on: false, visible: true, active: true, night: true, biome: ASTRAL_BIOME });
  assert.equal(off.started, null);
  assert.equal(off.state.streakMs, 0);
  /* The live stream before and after a whole day of events and mutation dice is identical. */
  setRng(makeRng(1234));
  const expect = Array.from({ length: 20 }, () => rng());
  setRng(makeRng(1234));
  play(24 * HOUR_MS, { seed: 8, night: true, biome: ASTRAL_BIOME });
  for (let d = 0; d < 500; d++) mutateFish({ ...noEvents(), seed: 8, draws: d }, fish(), EVENTS[3], "Perch");
  const got = Array.from({ length: 20 }, () => rng());
  assert.deepEqual(got, expect, "no event draw came from the shared rng()");
});

test("events.ts and event-data.ts never import or call the shared rng or Math.random", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  for (const f of ["events.ts", "event-data.ts", "event-hooks.ts"]) {
    const src = readFileSync(join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/Math\.random/.test(src), `${f} has no Math.random`);
    assert.ok(!/import[^;]*\b(rng|loose|setRng)\b[^;]*from "\.\/rng/.test(src), `${f} does not import the shared streams`);
  }
});

test("save reading: round trip, and junk becomes an empty state", () => {
  const some: EventsSave = { ...noEvents(), seed: 77, session: 3, streakMs: 123456, lastAt: T0, seen: { snowfall: 2 }, fish: { snowfall: 5 }, draws: 9, active: { id: "snowfall", startedAt: T0, endsAt: T0 + 5 } };
  assert.deepEqual(readEvents(JSON.parse(JSON.stringify(some))), some);
  for (const junk of [null, 5, "x", [], { active: 3, seen: [] }]) assert.deepEqual(readEvents(junk), noEvents());
});
