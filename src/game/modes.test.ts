import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canKeep,
  canRelease,
  isMode,
  legacyMode,
  MENU_CARDS,
  MODE_KEYS,
  MODE_LIST,
  MODES,
  mergeDex,
  mergeRecords,
  orderCards,
  priceIn,
  rulesOf,
  sharesCareerDex,
  showsMoney,
} from "./modes.ts";
import { modeRules } from "./engine.ts";
import type { Records } from "./records.ts";

test("every mode has a rules row whose id matches its key and its own save slot", () => {
  assert.deepEqual([...MODE_LIST].sort(), Object.keys(MODES).sort());
  const keys = new Set<string>();
  for (const id of MODE_LIST) {
    const r = MODES[id];
    assert.equal(r.id, id);
    assert.ok(r.title.length > 0 && r.blurb.length > 0, `${id} has words for its menu card`);
    assert.equal(MODE_KEYS[id], r.saveKey);
    keys.add(r.saveKey);
    assert.ok(r.fightSpeed > 0 && r.biteSpeed > 0, `${id} multipliers are positive`);
  }
  assert.equal(keys.size, MODE_LIST.length, "no two modes share a save slot");
});

test("the save slots are the ones players already have", () => {
  assert.equal(MODE_KEYS.expedition, "fac-ultra");
  assert.equal(MODE_KEYS.recreational, "fac-ultra-sandbox", "old Sandbox saves carry over");
  assert.equal(MODE_KEYS.coop, "fac-ultra-coop");
});

test("Expedition is everything on, nothing changed", () => {
  const r = MODES.expedition;
  assert.equal(r.economy && r.contracts && r.bosses && r.rebirth && r.aquarium, true);
  assert.equal(r.allUnlocked, false);
  assert.equal(r.fightSpeed, 1);
  assert.equal(r.biteSpeed, 1);
  assert.equal(r.dexShared, "own");
  assert.equal(r.trips, false);
});

test("Recreational follows 05 §3", () => {
  const r = MODES.recreational;
  assert.equal(r.economy, false);
  assert.equal(r.contracts, false);
  assert.equal(r.bosses, true);
  assert.equal(r.rebirth, false);
  assert.equal(r.allUnlocked, true);
  assert.equal(r.fightSpeed, 0.75);
  assert.equal(r.biteSpeed, 0.8);
  assert.equal(r.keepRelease, "both");
  assert.equal(r.dexShared, "career");
  assert.equal(r.trips, true);
  assert.equal(r.photo, true);
  assert.equal(showsMoney(r), false);
  assert.equal(showsMoney(MODES.expedition), true);
});

test("Co-op plays like the career with a second angler", () => {
  assert.equal(MODES.coop.twoPlayer, true);
  assert.equal(MODES.expedition.twoPlayer, false);
  assert.equal(MODES.coop.economy, true);
});

test("a gentler mode makes fish pull less and bite sooner than the career", () => {
  assert.ok(MODES.recreational.fightSpeed < MODES.expedition.fightSpeed);
  assert.ok(MODES.recreational.biteSpeed < MODES.expedition.biteSpeed);
});

test("modeRules() is the engine's lookup into the table, and starts on Expedition", () => {
  assert.equal(modeRules(), MODES.expedition);
  for (const id of MODE_LIST) assert.equal(modeRules(id), rulesOf(id));
});

test("prices are zero where there is no economy", () => {
  assert.equal(priceIn(MODES.expedition, 500), 500);
  assert.equal(priceIn(MODES.recreational, 500), 0);
});

test("keep and release follow keepRelease", () => {
  const base = MODES.expedition;
  assert.equal(canKeep({ ...base, keepRelease: "both" }) && canRelease({ ...base, keepRelease: "both" }), true);
  assert.equal(canKeep({ ...base, keepRelease: "keepOnly" }), true);
  assert.equal(canRelease({ ...base, keepRelease: "keepOnly" }), false);
  assert.equal(canKeep({ ...base, keepRelease: "releaseOnly" }), false);
  assert.equal(canRelease({ ...base, keepRelease: "releaseOnly" }), true);
  assert.equal(canKeep({ ...base, keepRelease: "eat" }), true);
  assert.equal(canRelease({ ...base, keepRelease: "eat" }), false);
});

test("only Recreational fills the career collection", () => {
  assert.equal(sharesCareerDex(MODES.recreational), true);
  assert.equal(sharesCareerDex(MODES.expedition), false, "the career is the collection, it does not share into itself");
  assert.equal(sharesCareerDex(MODES.coop), false);
});

test("legacy names still mean something", () => {
  assert.equal(legacyMode("career"), "expedition");
  assert.equal(legacyMode("sandbox"), "recreational");
  assert.equal(legacyMode("coop"), "coop");
  assert.equal(legacyMode("recreational"), "recreational");
  assert.equal(legacyMode("tournament"), null);
  assert.equal(legacyMode(42), null);
  assert.equal(isMode("toString"), false, "prototype names are not modes");
});

test("menu cards: seven, each opening a real mode, mode cards worded from the table", () => {
  assert.equal(MENU_CARDS.length, 7);
  assert.equal(new Set(MENU_CARDS.map((c) => c.id)).size, 7);
  for (const c of MENU_CARDS) assert.ok(isMode(c.mode), c.id);
  assert.equal(MENU_CARDS[0].title, MODES.expedition.title);
  assert.equal(MENU_CARDS[1].title, MODES.recreational.title);
  assert.equal(MENU_CARDS[1].blurb, MODES.recreational.blurb);
  assert.equal(MENU_CARDS.find((c) => c.id === "local")?.mode, "coop");
  assert.equal(MENU_CARDS.find((c) => c.id === "rush")?.needsBosses, 3);
});

test("the card you played last goes first and the rest keep their order", () => {
  const ids = (l: string | null) => orderCards(MENU_CARDS, l).map((c) => c.id);
  const base = MENU_CARDS.map((c) => c.id);
  assert.deepEqual(ids(null), base);
  assert.deepEqual(ids("nonsense"), base);
  assert.deepEqual(ids("expedition"), base);
  const aq = ids("aquarium");
  assert.equal(aq[0], "aquarium");
  assert.deepEqual(aq.slice(1), base.filter((x) => x !== "aquarium"));
  assert.equal(ids("sandbox")[0], "recreational", "the old Sandbox card id still finds Recreational");
});

test("mergeDex keeps the bigger of everything and never loses a species", () => {
  const a = { "0-1": { c: 3, w: 2, m: 0 }, "0-2": { c: 1, w: 9, m: 2 } };
  const b = { "0-1": { c: 5, w: 1, m: 1 }, "1-1": { c: 1, w: 4, m: 0 } };
  const m = mergeDex(a, b);
  assert.deepEqual(m["0-1"], { c: 5, w: 2, m: 1 });
  assert.deepEqual(m["0-2"], a["0-2"]);
  assert.deepEqual(m["1-1"], b["1-1"]);
  assert.deepEqual(mergeDex(a, {}), a);
  assert.deepEqual(mergeDex(m, m), m, "merging twice changes nothing");
  assert.notEqual(m["0-2"], a["0-2"], "copies, not shared objects");
});

test("mergeRecords keeps the heavier fish with its story", () => {
  const mk = (w: number, spot: string) => ({
    w,
    at: 1,
    spot,
    p: { family: "worm" as const, depth: 1 as const, retrieve: "slow" as const },
    weather: 0,
    window: "day" as const,
  });
  const a: Records = { "0-1": mk(3, "pond-pads"), "0-2": mk(5, "x") };
  const b: Records = { "0-1": mk(4, "pond-dock"), "1-1": mk(2, "y") };
  const m = mergeRecords(a, b);
  assert.equal(m["0-1"].spot, "pond-dock");
  assert.equal(m["0-2"].w, 5);
  assert.equal(m["1-1"].w, 2);
  assert.deepEqual(mergeRecords(m, a), m);
});
