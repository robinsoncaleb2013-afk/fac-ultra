import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  orderCards,
  priceIn,
  rulesOf,
  stageIn,
  showsMoney,
} from "./modes.ts";
import { modeRules } from "./engine.ts";

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

test("Survival follows 05 §5: its own slot, its own dex, no money, tougher fish, eat what you catch", () => {
  const r = MODES.survival;
  assert.equal(MODE_KEYS.survival, "fac-ultra-survival");
  assert.equal(r.saveKey, "fac-ultra-survival");
  assert.equal(r.survival, true);
  assert.equal(r.economy || r.contracts || r.bosses || r.rebirth || r.aquarium || r.allUnlocked, false);
  assert.equal(r.fightSpeed, 1.15);
  assert.equal(r.keepRelease, "eat");
  assert.equal(r.dexShared, "own");
  assert.equal(r.dexShared, "own", "Survival never writes to the career");
  assert.deepEqual(r.hud, ["hunger", "warmth", "day", "weather"]);
  assert.equal(canKeep(r), true);
  assert.equal(canRelease(r), false, "you eat what you catch");
  assert.equal(showsMoney(r), false);
  assert.equal(MODES.expedition.survival, undefined);
  assert.equal(legacyMode("survival"), "survival");
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
  assert.equal(r.dexShared, "own", "its own book, apart from the career");
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

test("every mode keeps its own collection: nothing is shared with the career (WP-11)", () => {
  for (const id of MODE_LIST) assert.equal(MODES[id].dexShared, "own", `${id} keeps its own book`);
  assert.equal(MODES.recreational.dexShared, "own");
  /* no leftover code that could merge one mode into another */
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "modes.ts"), "utf8");
  assert.ok(!/mergeDex|mergeRecords|sharesCareerDex/.test(src));
});

test("Recreational opens every stage and Lair from the first cast; the others earn them from their own book", () => {
  assert.equal(MODES.recreational.stagesOpen, true);
  for (const id of MODE_LIST) if (id !== "recreational" && id !== "story") assert.equal(MODES[id].stagesOpen, false, id);
  assert.equal(MODES.story.stagesOpen, true, "Story: the chapter gives the Boss Chum, so every Lair is open");
  assert.equal(stageIn(MODES.recreational, {}, 4), 3, "an empty book still has the whole water");
  assert.equal(stageIn(MODES.expedition, {}, 4), 0, "the career earns its stages");
});

test("legacy names still mean something", () => {
  assert.equal(legacyMode("career"), "expedition");
  assert.equal(legacyMode("sandbox"), "recreational");
  assert.equal(legacyMode("coop"), "coop");
  assert.equal(legacyMode("recreational"), "recreational");
  assert.equal(legacyMode("tournament"), "tournament");
  assert.equal(legacyMode("nonsense"), null);
  assert.equal(legacyMode(42), null);
  assert.equal(isMode("toString"), false, "prototype names are not modes");
});

test("menu cards: each opening a real mode, mode cards worded from the table", () => {
  assert.ok(MENU_CARDS.length >= 8, "Survival and Tournaments joined the seven");
  assert.equal(new Set(MENU_CARDS.map((c) => c.id)).size, MENU_CARDS.length, "no card twice");
  for (const c of MENU_CARDS) assert.ok(isMode(c.mode), c.id);
  assert.equal(MENU_CARDS[0].title, MODES.expedition.title);
  assert.equal(MENU_CARDS[1].title, MODES.recreational.title);
  assert.equal(MENU_CARDS[1].blurb, MODES.recreational.blurb);
  assert.equal(MENU_CARDS.find((c) => c.id === "survival")?.mode, "survival");
  assert.equal(MENU_CARDS.find((c) => c.id === "survival")?.blurb, MODES.survival.blurb);
  assert.ok(MENU_CARDS.findIndex((c) => c.id === "survival") === 2, "05 §7: Expedition, Recreational, Survival");
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
