/* Holiday events (Update Three, P5): the calendar maths (eve / day / day-after windows, Thanksgiving's
   fourth Thursday, Easter by Computus, the New Year incoming-year mutation and midnight burst), the
   50 / 50 / 50 multipliers, and the interaction rule with the random long-play events. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { luckTotal } from "./content.ts";
import { HOLIDAYS, HOLIDAY_FISH_SHARE, HOLIDAY_MULT, NEW_YEAR_BURST_MINUTES } from "./event-data.ts";
import { EVENTS, applyEventsToFish, holidayMutateFish, mutationOfEvent, noEvents, type EventsSave } from "./events.ts";
import { burstDue, easterSunday, holidayDateInYear, holidayMultipliers, holidayOn, nextHoliday, nthWeekdayOfMonth } from "./holidays.ts";
import { catchXp } from "./keep.ts";

/** A local date at noon (safely inside the calendar day, whatever the timezone does at midnight). */
const local = (y: number, m: number, d: number, hh = 12, mm = 0) => new Date(y, m - 1, d, hh, mm);
const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

test("the holiday table: eight holidays, with Caleb's mutation names and a look each", () => {
  assert.deepEqual(
    HOLIDAYS.map((h) => [h.id, h.name, typeof h.mutation === "function" ? h.mutation(2027) : h.mutation]),
    [
      ["christmas", "Christmas", "jolly"],
      ["thanksgiving", "Thanksgiving", "thankful"],
      ["easter", "Easter", "joyful"],
      ["st-patricks", "St. Patrick's Day", "lucky"],
      ["valentines", "Valentine's Day", "loving"],
      ["veterans", "Veterans Day", "patriotic"],
      ["halloween", "Halloween", "spooky"],
      ["new-year", "New Year", "2027"],
    ],
  );
  for (const h of HOLIDAYS) {
    assert.ok(h.look.glyph.length > 0 && h.look.hue >= 0 && h.look.hue <= 360, `${h.id} has a look`);
    assert.ok(h.announce.length > 0 && h.blurb.length > 0, `${h.id} has player text`);
  }
  assert.deepEqual(HOLIDAYS.filter((h) => h.burst).map((h) => h.id), ["new-year"], "only New Year bursts");
  assert.equal(HOLIDAY_MULT, 50);
});

/* [holiday id, eve, day, day-after, two days before, two days after, mutation] — all in 2026 unless noted. */
const WINDOWS: [string, Date, Date, Date, Date, Date, string][] = [
  ["christmas", local(2026, 12, 24), local(2026, 12, 25), local(2026, 12, 26), local(2026, 12, 23), local(2026, 12, 27), "jolly"],
  ["thanksgiving", local(2026, 11, 25), local(2026, 11, 26), local(2026, 11, 27), local(2026, 11, 24), local(2026, 11, 28), "thankful"],
  ["easter", local(2026, 4, 4), local(2026, 4, 5), local(2026, 4, 6), local(2026, 4, 3), local(2026, 4, 7), "joyful"],
  ["st-patricks", local(2026, 3, 16), local(2026, 3, 17), local(2026, 3, 18), local(2026, 3, 15), local(2026, 3, 19), "lucky"],
  ["valentines", local(2026, 2, 13), local(2026, 2, 14), local(2026, 2, 15), local(2026, 2, 12), local(2026, 2, 16), "loving"],
  ["veterans", local(2026, 11, 10), local(2026, 11, 11), local(2026, 11, 12), local(2026, 11, 9), local(2026, 11, 13), "patriotic"],
  ["halloween", local(2026, 10, 30), local(2026, 10, 31), local(2026, 11, 1), local(2026, 10, 29), local(2026, 11, 2), "spooky"],
];

test("every holiday is active on its eve, day and day-after — and inactive two days out", () => {
  for (const [id, eve, day, after, before, past, mutation] of WINDOWS) {
    const onEve = holidayOn(eve);
    assert.equal(onEve?.def.id, id, `${id} on its eve`);
    assert.equal(onEve?.phase, "eve");
    assert.equal(onEve?.mutation, mutation);
    const onDay = holidayOn(day);
    assert.equal(onDay?.def.id, id, `${id} on its day`);
    assert.equal(onDay?.phase, "day");
    assert.equal(onDay?.mutation, mutation);
    assert.deepEqual(ymd(onDay!.date), ymd(day), `${id}'s holiday date is the day itself`);
    const onAfter = holidayOn(after);
    assert.equal(onAfter?.def.id, id, `${id} on its day-after`);
    assert.equal(onAfter?.phase, "after");
    assert.equal(holidayOn(before), null, `${id} is not active two days before`);
    assert.equal(holidayOn(past), null, `${id} is not active two days after`);
  }
});

test("Thanksgiving is the fourth Thursday of November (2026 and 2027 real dates)", () => {
  const def = HOLIDAYS.find((h) => h.id === "thanksgiving")!;
  assert.deepEqual(ymd(holidayDateInYear(def, 2026)), [2026, 11, 26]);
  assert.deepEqual(ymd(holidayDateInYear(def, 2027)), [2027, 11, 25]);
  assert.equal(holidayDateInYear(def, 2026).getDay(), 4, "a Thursday");
  assert.equal(holidayDateInYear(def, 2027).getDay(), 4, "a Thursday");
  assert.deepEqual(ymd(nthWeekdayOfMonth(2026, 11, 4, 1)), [2026, 11, 5], "the first Thursday, for scale");
  assert.deepEqual(ymd(nthWeekdayOfMonth(2027, 11, 4, 4)), [2027, 11, 25]);
  /* The full 2027 window, eve and day-after included. */
  assert.equal(holidayOn(local(2027, 11, 24))?.phase, "eve");
  assert.equal(holidayOn(local(2027, 11, 25))?.mutation, "thankful");
  assert.equal(holidayOn(local(2027, 11, 26))?.phase, "after");
  assert.equal(holidayOn(local(2027, 11, 27)), null);
});

test("Easter Sunday by Computus: Apr 5 in 2026, Mar 28 in 2027", () => {
  assert.deepEqual(ymd(easterSunday(2026)), [2026, 4, 5]);
  assert.deepEqual(ymd(easterSunday(2027)), [2027, 3, 28]);
  assert.equal(easterSunday(2026).getDay(), 0, "a Sunday");
  assert.equal(easterSunday(2027).getDay(), 0, "a Sunday");
  const def = HOLIDAYS.find((h) => h.id === "easter")!;
  assert.deepEqual(ymd(holidayDateInYear(def, 2027)), [2027, 3, 28]);
  assert.equal(holidayOn(local(2027, 3, 27))?.def.id, "easter", "eve, 2027");
  assert.equal(holidayOn(local(2027, 3, 28))?.mutation, "joyful");
  assert.equal(holidayOn(local(2027, 3, 29))?.phase, "after");
  assert.equal(holidayOn(local(2027, 3, 30)), null);
});

test("the New Year window Dec 31 – Jan 2 carries the INCOMING year's mutation name", () => {
  const eve = holidayOn(local(2026, 12, 31));
  assert.equal(eve?.def.id, "new-year");
  assert.equal(eve?.phase, "eve");
  assert.equal(eve?.year, 2027, "Dec 31, 2026 already belongs to New Year 2027");
  assert.equal(eve?.mutation, "2027");
  assert.deepEqual(ymd(eve!.date), [2027, 1, 1]);
  assert.equal(holidayOn(local(2027, 1, 1))?.mutation, "2027");
  assert.equal(holidayOn(local(2027, 1, 1))?.phase, "day");
  assert.equal(holidayOn(local(2027, 1, 2))?.mutation, "2027");
  assert.equal(holidayOn(local(2027, 1, 2))?.phase, "after");
  assert.equal(holidayOn(local(2026, 12, 30)), null, "not yet, two days out");
  assert.equal(holidayOn(local(2027, 1, 3)), null, "over, two days out");
  assert.equal(holidayOn(local(2025, 12, 31))?.mutation, "2026", "the year before works the same way");
  assert.equal(holidayOn(local(2027, 12, 31))?.mutation, "2028", "and the year after");
  assert.equal(holidayOn(local(2027, 1, 1))?.burst, true, "New Year carries the burst flag");
  assert.equal(holidayOn(local(2026, 12, 25))?.burst, false, "Christmas does not");
});

test("multipliers are 50 / 50 / 50 inside every window and 1 / 1 / 1 outside", () => {
  for (const [, , day] of WINDOWS) assert.deepEqual(holidayMultipliers(day), { luck: 50, worth: 50, xp: 50 });
  assert.deepEqual(holidayMultipliers(local(2026, 12, 31)), { luck: 50, worth: 50, xp: 50 }, "New Year eve counts");
  assert.deepEqual(holidayMultipliers(local(2027, 1, 2)), { luck: 50, worth: 50, xp: 50 }, "New Year day-after counts");
  for (const plain of [local(2026, 6, 15), local(2026, 12, 20), local(2027, 1, 3), local(2026, 11, 20), local(2026, 2, 20)]) {
    assert.deepEqual(holidayMultipliers(plain), { luck: 1, worth: 1, xp: 1 });
    assert.equal(holidayOn(plain), null);
  }
});

test("the midnight burst is due only in the first minutes of Jan 1, while New Year is active", () => {
  assert.equal(burstDue(local(2027, 1, 1, 0, 0)), true, "the stroke of midnight");
  assert.equal(burstDue(local(2027, 1, 1, 0, 5)), true);
  assert.equal(burstDue(local(2028, 1, 1, 0, NEW_YEAR_BURST_MINUTES - 1)), true, "any year, last burst minute");
  assert.equal(burstDue(local(2027, 1, 1, 0, NEW_YEAR_BURST_MINUTES)), false, "the burst window has closed");
  assert.equal(burstDue(local(2027, 1, 1, 0, 30)), false);
  assert.equal(burstDue(local(2026, 12, 31, 23, 59)), false, "not before midnight");
  assert.equal(burstDue(local(2027, 1, 2, 0, 2)), false, "not on the day after");
  assert.equal(burstDue(local(2026, 12, 25, 0, 2)), false, "not on other holidays");
});

test("nextHoliday: the live window if there is one, otherwise the soonest coming", () => {
  assert.equal(nextHoliday(local(2026, 12, 26)).def.id, "christmas", "still in the Christmas window");
  const ny = nextHoliday(local(2026, 12, 27));
  assert.equal(ny.def.id, "new-year");
  assert.equal(ny.mutation, "2027");
  assert.deepEqual(ymd(ny.date), [2027, 1, 1]);
  const val = nextHoliday(local(2027, 1, 3));
  assert.equal(val.def.id, "valentines");
  assert.deepEqual(ymd(val.date), [2027, 2, 14]);
});

/* ── the catch seam: worth, the mutation name, and the rule with random events ── */

const fish = (m = 0, boss = false) => ({ b: 0, i: 3, t: 0, m, name: "Perch", w: 2, v: 100, boss });
const CHRISTMAS = local(2026, 12, 25);
const PLAIN_DAY = local(2026, 6, 15);
const st = (draws = 0): EventsSave => ({ ...noEvents(), seed: 11, draws });

test("in a holiday window every fish is worth 50x — bosses and already-mutated fish too; outside, nothing changes", () => {
  for (const f of [fish(), fish(2), fish(0, true)]) {
    const r = applyEventsToFish(st(), f, null, CHRISTMAS, "Perch");
    assert.equal(r.fish.v, 5000);
    assert.equal(r.holiday?.def.id, "christmas");
  }
  const out = applyEventsToFish(st(), fish(), null, PLAIN_DAY, "Perch");
  assert.equal(out.fish.v, 100);
  assert.equal(out.holiday, null);
  assert.equal(out.holidayHit, false);
  assert.equal(out.state.draws, 0, "no holiday, no draw spent");
});

test("the holiday mutation mirrors mutateFish: a share of eligible fish, never bosses, never a fish that already has one", () => {
  const holiday = holidayOn(CHRISTMAS)!;
  let hits = 0;
  const N = 4000;
  for (let d = 0; d < N; d++) if (holidayMutateFish(st(d), fish(), holiday, "Perch").hit) hits++;
  const share = hits / N;
  assert.ok(Math.abs(share - HOLIDAY_FISH_SHARE) < 0.04, `share ${share}`);
  const one = (() => {
    for (let d = 0; d < 400; d++) {
      const r = holidayMutateFish(st(d), fish(), holiday, "Perch");
      if (r.hit) return r;
    }
    throw new Error("no hit in 400 draws");
  })();
  assert.equal(one.fish.holidayMutation, "jolly");
  assert.equal(one.fish.name, "jolly Perch");
  assert.equal(one.fish.m, 0, "the holiday name never takes the saved mutation slot");
  assert.equal(one.fish.v, 5000, "a mutated holiday fish is worth 50x once, not 50x twice");
  for (let d = 0; d < 300; d++) {
    assert.equal(holidayMutateFish(st(d), fish(0, true), holiday, "Perch").hit, false, "bosses carry no holiday name");
    const kept = holidayMutateFish(st(d), fish(2), holiday, "Perch");
    assert.equal(kept.hit, false, "a Golden fish stays Golden");
    assert.equal(kept.fish.name, "Perch");
    assert.equal(kept.fish.v, 5000, "but its worth still gets the holiday 50x");
  }
  /* Deterministic: same seed and draw counter, same answer. */
  const a = holidayMutateFish(st(7), fish(), holiday, "Perch");
  const b = holidayMutateFish(st(7), fish(), holiday, "Perch");
  assert.deepEqual(a, b);
});

test("holiday x random event: they multiply — the random mutation keeps the slot and applies first, the holiday 50x lands on top", () => {
  const trembling = EVENTS[1]; // Common, worth kind, 2x
  let hit = null as null | ReturnType<typeof applyEventsToFish>;
  for (let d = 0; d < 400 && !hit?.randomHit; d++) hit = applyEventsToFish(st(d), fish(), trembling, CHRISTMAS, "Perch");
  assert.ok(hit?.randomHit, "found a draw where the random event mutates the fish");
  assert.equal(hit!.fish.m, mutationOfEvent(trembling), "the random event's mutation keeps the m slot");
  assert.equal(hit!.fish.name, "Trembling Perch", "and its name");
  assert.equal(hit!.fish.holidayMutation, undefined, "no second mutation name on top");
  assert.equal(hit!.holidayHit, false);
  assert.equal(hit!.fish.v, 100 * 2 * 50, "worth: the event's 2x, then the holiday's 50x");
  /* Same fish on a plain day: only the event's 2x. */
  let plain = null as null | ReturnType<typeof applyEventsToFish>;
  for (let d = 0; d < 400 && !plain?.randomHit; d++) plain = applyEventsToFish(st(d), fish(), trembling, PLAIN_DAY, "Perch");
  assert.equal(plain!.fish.v, 200);
});

test("the XP and luck seams: catchXp and luckTotal take the date and apply the same 50x", () => {
  const starlight = mutationOfEvent(EVENTS[0]); // an XP-kind random event mutation, 2x XP
  assert.equal(catchXp(0, 0, 0, false, CHRISTMAS), 50 * catchXp(0, 0, 0, false));
  assert.equal(catchXp(0, 0, 0, false, PLAIN_DAY), catchXp(0, 0, 0, false), "outside a window the date changes nothing");
  assert.equal(catchXp(0, starlight, 0, false, CHRISTMAS), 300, "XP: base 3 x event 2 x holiday 50 — they multiply");
  assert.equal(catchXp(0, starlight, 0, false), 6, "no date, no holiday: exactly the old answer");
  /* Rod 1 alone gives exactly 2.5 luck, so the 50x is exact arithmetic, no float fuzz. */
  assert.equal(luckTotal({ rod: 1, boat: 0, weather: 0, lv: 0, rb: 0, dex: {} }, -1), 2.5);
  assert.equal(luckTotal({ rod: 1, boat: 0, weather: 0, lv: 0, rb: 0, dex: {} }, -1, PLAIN_DAY), 2.5);
  assert.equal(luckTotal({ rod: 1, boat: 0, weather: 0, lv: 0, rb: 0, dex: {} }, -1, CHRISTMAS), 125, "luck: the total x50 in a window");
});

test("holidays.ts and event-data.ts use no Math.random and no shared fishing stream", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  for (const f of ["holidays.ts", "event-data.ts"]) {
    const src = readFileSync(join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/Math\.random/.test(src), `${f} has no Math.random`);
    assert.ok(!/from "\.\/rng/.test(src), `${f} does not import the fishing rng at all`);
  }
});
