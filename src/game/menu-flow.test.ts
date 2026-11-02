/* The two-level menu in the real store (WP-12): enter a mode, open its menu, leave to the main menu, come back. Nothing is lost on the way. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const mem = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};
/* Sound is not under test: a stand-in that accepts every call. */
const quiet = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "state" ? "running" : k === "currentTime" || k === "sampleRate" ? 0 : quiet()),
    apply: () => quiet(),
    set: () => true,
  });
g.AudioContext = class {
  constructor() {
    return quiet() as object;
  }
};
g.document = { addEventListener() {}, visibilityState: "visible" };
g.window = Object.assign(globalThis, {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  innerWidth: 1440,
  innerHeight: 900,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => true,
});

const { useGame, hydrate, MODE_KEYS, currentLeaveFacts, sim, act } = await import("./engine.ts");
const { useHubUi } = await import("./hubstate.ts");
const { tabsFor } = await import("./hubnav.ts");
const { MODE_LIST, MODES } = await import("./modes.ts");

const here = dirname(fileURLToPath(import.meta.url));
const v6 = JSON.parse(readFileSync(join(here, "__fixtures__", "save-v6.json"), "utf8"));
const slotText = (mode: keyof typeof MODE_KEYS) => mem.get(MODE_KEYS[mode]) ?? null;

test("title screen: nothing is a game yet, and the menu behind it is the main menu", () => {
  mem.clear();
  mem.set(MODE_KEYS.expedition, JSON.stringify(v6));
  hydrate();
  const g = useGame.getState();
  assert.equal(g.screen, "menu");
  assert.deepEqual(tabsFor(g.screen, g.mode), ["play", "collections", "friends", "account", "settings"]);
});

test("each mode: enter -> its own in-game tabs -> Leave -> main menu, and the slot is exactly as it was", () => {
  for (const id of MODE_LIST) {
    if (id === "tournament") continue; /* an event needs the server; its tabs are covered by the rules table test */
    mem.clear();
    mem.set(MODE_KEYS.expedition, JSON.stringify(v6));
    hydrate();
    useGame.getState().switchMode(id);
    let g = useGame.getState();
    assert.equal(g.screen, "game", id);
    assert.equal(g.mode, id);
    assert.deepEqual(tabsFor(g.screen, g.mode), MODES[id].menuTabs, id);
    useHubUi.getState().openHub();
    assert.equal(useHubUi.getState().open, true);
    const before = slotText(id);
    g.leaveToMenu();
    g = useGame.getState();
    assert.equal(g.screen, "menu", `${id}: back on the main menu`);
    assert.equal(useHubUi.getState().open, false, `${id}: the menu closed`);
    assert.equal(g.mode, "expedition", `${id}: the career sits behind the main menu`);
    assert.deepEqual(JSON.parse(slotText(id) ?? "null"), JSON.parse(before ?? "null"), `${id}: leaving changed nothing in the save`);
    /* Continue: the same mode comes back with the same save. */
    useGame.getState().switchMode(id);
    assert.equal(useGame.getState().screen, "game");
    assert.equal(useGame.getState().mode, id);
  }
});

test("leaving keeps the career: coins, level and gear are untouched by a trip into another mode", () => {
  mem.clear();
  mem.set(MODE_KEYS.expedition, JSON.stringify(v6));
  hydrate();
  const coins = useGame.getState().c;
  const lv = useGame.getState().lv;
  useGame.getState().switchMode("recreational");
  useGame.getState().leaveToMenu();
  useGame.getState().switchMode("survival");
  useGame.getState().leaveToMenu();
  const g = useGame.getState();
  assert.equal(g.mode, "expedition");
  assert.equal(g.c, coins);
  assert.equal(g.lv, lv);
  assert.equal(JSON.parse(slotText("expedition")!).c, coins);
});

test("a cast line is noticed, asked about, and dropped on leaving; the fish is not lost from the bag", () => {
  mem.clear();
  mem.set(MODE_KEYS.expedition, JSON.stringify(v6));
  hydrate();
  useGame.getState().switchMode("expedition");
  const bag = useGame.getState().inv.length;
  assert.equal(currentLeaveFacts().line, "none");
  act();
  assert.notEqual(sim.phase, "idle");
  assert.notEqual(currentLeaveFacts().line, "none");
  useGame.getState().leaveToMenu();
  assert.equal(sim.phase, "idle");
  assert.equal(useGame.getState().screen, "menu");
  assert.equal(useGame.getState().inv.length, bag);
});

test("leaving from the main menu does nothing", () => {
  mem.clear();
  hydrate();
  const before = JSON.stringify(useGame.getState().inv);
  useGame.getState().leaveToMenu();
  assert.equal(useGame.getState().screen, "menu");
  assert.equal(JSON.stringify(useGame.getState().inv), before);
});

test("selling and buying are in the store only through Shop & Sell: Recreational and Survival have no shop tab and no money", () => {
  for (const id of ["recreational", "survival", "tournament"] as const) {
    assert.ok(!MODES[id].menuTabs.includes("shop"), id);
    assert.equal(MODES[id].economy, false, id);
  }
});
