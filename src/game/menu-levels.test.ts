/* The two-level menu (WP-12): the main menu is outside any game and can reach nothing that changes one; the in-game menu's
   tabs come from each mode's rules. Table-driven, so a new mode is covered the day it is added to MODES. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { HUB_TABS, MAIN_MENU_FORBIDDEN, MAIN_TABS, resolveHubTarget, tabsFor, tabsForMode } from "./hubnav.ts";
import { EXPEDITION_EXTRA_IDS, hasShop, MENU_CARDS, MODE_LIST, MODES, MODE_SELECT_IDS } from "./modes.ts";
import { COLLECTION_MODES, collectionEntries, peekMode, peekText } from "./peek.ts";
import { slotKey } from "./slots.ts";
import { leaveLabel, leaveLines, needsLeaveConfirm, leaveTitle } from "./leave.ts";
import { allHubCopy, JARGON } from "./hubcopy.ts";

test("every mode's in-game tab list is its rules table, in order, and every tab has a name", () => {
  for (const id of MODE_LIST) {
    assert.deepEqual(tabsForMode(id), MODES[id].menuTabs, id);
    assert.deepEqual(tabsFor("game", id), MODES[id].menuTabs, id);
    assert.ok(MODES[id].menuTabs.length > 0 && MODES[id].menuTabs.at(-1) === "settings", `${id}: Settings is always there, last`);
    assert.equal(new Set(MODES[id].menuTabs).size, MODES[id].menuTabs.length, `${id}: no tab twice`);
    for (const t of MODES[id].menuTabs) assert.ok(HUB_TABS.some((h) => h.id === t), `${id}: ${t} has a label`);
  }
});

test("Shop & Sell is a tab exactly where the economy is on", () => {
  for (const id of MODE_LIST) {
    assert.equal(MODES[id].menuTabs.includes("shop"), MODES[id].economy, id);
    assert.equal(hasShop(MODES[id]), MODES[id].economy, id);
  }
  assert.deepEqual(MODE_LIST.filter((m) => hasShop(MODES[m])).sort(), ["coop", "expedition", "story"]);
});

test("the main menu has no game tab: nothing to sell, shop, tackle, camp, travel or cast", () => {
  assert.deepEqual([...MAIN_TABS], ["play", "collections", "friends", "account", "settings"]);
  assert.deepEqual(tabsFor("menu", "expedition"), [...MAIN_TABS]);
  for (const mode of MODE_LIST) assert.deepEqual(tabsFor("menu", mode), [...MAIN_TABS], "the same whatever mode is loaded behind it");
  for (const t of MAIN_MENU_FORBIDDEN) assert.ok(!MAIN_TABS.includes(t as never), t);
  /* Any request for a game tab on the main menu lands on a main tab. */
  for (const t of HUB_TABS) {
    const to = resolveHubTarget(MAIN_TABS, t.id);
    assert.ok(MAIN_TABS.includes(to.tab as never), `${t.id} -> ${to.tab}`);
  }
});

test("an old request lands on the tab each mode really has for it", () => {
  const r = (mode: Parameters<typeof tabsForMode>[0], want: Parameters<typeof resolveHubTarget>[1], item?: string) => resolveHubTarget(tabsForMode(mode), want, item);
  assert.deepEqual(r("survival", "tackle", "satchel"), { tab: "larder" });
  assert.deepEqual(r("recreational", "lodge", "logbook"), { tab: "logbook" });
  assert.equal(r("recreational", "lodge", "book").tab, "collection");
  assert.equal(r("survival", "lodge", "record").tab, "log");
  assert.equal(r("tournament", "tackle").tab, "event");
  assert.equal(r("expedition", "tackle", "rod").tab, "tackle");
  assert.equal(r("expedition", "lodge", "tank").tab, "lodge");
});

test("mode select shows the six modes; the extras are Expedition shortcuts", () => {
  assert.deepEqual([...MODE_SELECT_IDS], ["expedition", "story", "recreational", "survival", "tournaments", "local"]);
  const modes = MODE_SELECT_IDS.map((id) => MENU_CARDS.find((c) => c.id === id)!.mode);
  assert.deepEqual(new Set(modes), new Set(MODE_LIST), "every mode has a card");
  for (const id of EXPEDITION_EXTRA_IDS) assert.equal(MENU_CARDS.find((c) => c.id === id)?.mode, "expedition", id);
  /* Nothing from the old Play tab was dropped. */
  const all = new Set([...MODE_SELECT_IDS, ...EXPEDITION_EXTRA_IDS]);
  for (const c of MENU_CARDS) assert.ok(all.has(c.id), `${c.id} is still reachable`);
});

test("leaving: asks only when something is in progress, and says so in plain words", () => {
  const idle = { line: "none", trip: false, event: false, run: false } as const;
  assert.equal(needsLeaveConfirm(idle), false);
  assert.equal(needsLeaveConfirm({ ...idle, line: "fight" }), true);
  assert.equal(needsLeaveConfirm({ ...idle, line: "waiting" }), true);
  assert.equal(needsLeaveConfirm({ ...idle, trip: true }), true);
  assert.equal(needsLeaveConfirm({ ...idle, event: true }), true);
  assert.equal(needsLeaveConfirm({ ...idle, run: true }), true);
  assert.match(leaveLines({ ...idle, line: "fight" })[0], /gets away/);
  assert.equal(leaveTitle({ ...idle, event: true }), "Leave the event?");
  assert.equal(leaveLabel(MODES.recreational), "Leave trip");
  assert.equal(leaveLabel(MODES.tournament), "Leave event");
  assert.equal(leaveLabel(MODES.survival), "Leave run");
  assert.equal(leaveLabel(MODES.expedition), "Main menu");
  for (const l of [...leaveLines({ line: "fight", trip: true, event: true, run: true })]) assert.ok(!JARGON.test(l), l);
});

test("collections peek: reads saved text, never invents, survives junk", () => {
  assert.equal(peekText("expedition", null).saved, false);
  assert.equal(peekText("expedition", "{not json").saved, false);
  assert.equal(peekText("expedition", "[]").saved, false);
  const p = peekText(
    "recreational",
    JSON.stringify({ lv: 7, dex: { "0-1": { c: 2, w: 3, m: 0 }, "0-2": { c: 0, w: 0, m: 0 }, "1-0": { c: 1, w: 1, m: 0 }, nope: { c: 5 } }, records: { "0-1": { w: 3.5 }, "1-0": { w: 9 } }, trophies: [{}, {}] }),
  );
  assert.equal(p.saved, true);
  assert.equal(p.found, 2);
  assert.deepEqual(p.perWater.slice(0, 2), [1, 1]);
  assert.equal(p.best[0].w, 9);
  assert.equal(p.trophies, 2);
  assert.equal(p.level, 7);
  for (const m of COLLECTION_MODES) assert.equal(peekMode(m, () => null).saved, false);
  /* WP-16: slots and the Kids book show up as their own read-only rows. */
  const slot = JSON.stringify({ slotName: "Mia", created: 1, dex: { "0-1": { c: 1, w: 1, m: 0 } }, sideDex: { "0-2": { c: 1, w: 1, m: 0 }, "1-0": { c: 2, w: 1, m: 0 } } });
  const rows = collectionEntries((k) => (k === slotKey("expedition", 1) ? slot : null));
  assert.ok(rows.some((r) => r.id === "expedition-s1" && r.peek.found === 1 && /Mia/.test(r.title)));
  const kidsRow = rows.find((r) => r.id === "expedition-s1-kids");
  assert.ok(kidsRow && kidsRow.kids && kidsRow.peek.found === 2);
  assert.ok(rows.some((r) => r.id === "story" && !r.peek.saved), "an unused mode still gets one row");
  assert.equal(peekMode("expedition", () => { throw new Error("blocked"); }).saved, false);
});

test("the main menu's words are plain English", () => {
  for (const line of [...allHubCopy(), ...HUB_TABS.flatMap((t) => [t.label, t.blurb])]) assert.ok(!JARGON.test(line), line);
});
