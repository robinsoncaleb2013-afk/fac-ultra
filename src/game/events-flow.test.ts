/* The fun layer working in the real store (05 §6): Fish of the Day, shiny, sticker pages, the pet, the Regulars' Derby,
   saving, keeping Expedition and Recreational apart, and staying OUT of Tournaments and Survival. A tiny fake browser is enough. */
import assert from "node:assert/strict";
import { test } from "node:test";

const mem = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};
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

const { useGame, hydrate, MODE_KEYS, applyCatch, stepEventsLive, noteActivity, snapshot } = await import("./engine.ts");
const rngMod = await import("./rng.ts");
const { makeRng, setRng } = rngMod;
const rng = () => rngMod.rng();
const { catchXp } = await import("./keep.ts");
const { rarityOf, BIOMES } = await import("./content.ts");
const { EVENTS, mutationOfEvent, noEvents } = await import("./events.ts");
const { onEventStarted, onEventEnded, onMutatedCatch } = await import("./event-hooks.ts");
const { HOUR_MS } = await import("./event-data.ts");

const st = () => useGame.getState();
const flush = () => new Promise((r) => setTimeout(r, 450));
const fishOf = (b: number, i: number, m = 0, v = 10) => ({ b, i, t: rarityOf(i), m, name: BIOMES[b].fish[i], w: 2, v, boss: i === 24 });
const land = (m: number, v = 10) => applyCatch({ ...st(), toasts: [] }, fishOf(0, 3, m, v), { auto: false, perfect: false, frenzy: false });

function boot(mode: "expedition" | "recreational" | "tournament" | "survival" = "expedition") {
  mem.clear();
  setRng(makeRng(5));
  hydrate();
  if (mode !== "expedition") st().switchMode(mode);
  useGame.setState({ screen: "game" });
}

/** Play `hours` of fishing on a fake clock, tapping every 30 s. Returns every event started. */
function session(hours: number, from: number) {
  const started: string[] = [];
  const off = onEventStarted((e) => started.push(e.id));
  let now = from;
  noteActivity(now);
  stepEventsLive(now);
  for (let t = 0; t < hours * 120; t++) {
    now += 30_000;
    noteActivity(now);
    stepEventsLive(now);
  }
  off();
  return { started, now };
}

test("a mutated catch: XP and value follow the event, the book keeps the mutation, a toast and the hook fire", () => {
  boot();
  useGame.setState({ lv: 60, xp: 0 });
  const heard: number[] = [];
  const off = onMutatedCatch((c) => heard.push(c.mutation));
  const tremb = mutationOfEvent(EVENTS[1]);
  const star = mutationOfEvent(EVENTS[0]);
  const a = land(tremb, 1000);
  assert.equal(a.lastCatch.value, land(0, 1000).lastCatch.value, "the roll already carried the worth boost, the catch does not apply it twice");
  assert.equal(a.xp, catchXp(rarityOf(3), tremb, 0, false), "a worth mutation leaves XP alone");
  assert.equal(a.dex["0-3"].m, tremb);
  assert.deepEqual(a.events.fish, { "meteor-collision": 1 });
  assert.ok(a.toasts.some((t: { text: string }) => t.text === "Trembling! 2x worth"));
  const b = land(star);
  assert.equal(b.xp, catchXp(rarityOf(3), star, 0, false));
  assert.equal(b.xp, 2 * catchXp(rarityOf(3), 0, 0, false), "Starlight doubles XP once");
  off();
  assert.deepEqual(heard, [tremb, star]);
});

test("a simulated 1-hour night session in Expedition starts an eligible event for some seeds; the streak saves and reloads", async () => {
  let any = 0;
  for (let seed = 1; seed <= 80 && !any; seed++) {
    boot();
    useGame.setState({ events: { ...noEvents(), seed } });
    const r = session(1, Date.now());
    if (r.started.length) {
      any++;
      assert.ok(EVENTS.some((e) => e.id === r.started[0] && e.hours <= 1));
      assert.ok(st().events.active, "the event is running");
      assert.equal(st().eventBanner?.id, r.started[0]);
      assert.ok(st().toasts.some((t: { text: string }) => EVENTS.some((e) => e.announce === t.text)));
    }
  }
  assert.ok(any, "some seed starts a 1-hour event");
  await flush();
  const saved = JSON.parse(mem.get(MODE_KEYS.expedition)!);
  assert.equal(saved.version, snapshot(st()).version);
  assert.equal(saved.events.active.id, st().events.active!.id);
  assert.ok(saved.events.streakMs >= HOUR_MS);
  const before = st().events;
  hydrate();
  assert.deepEqual(st().events.seen, before.seen, "seen events survive a reload");
  assert.equal(st().events.streakMs, before.streakMs, "the streak survives a reload");
});

test("Recreational runs events with its own state; Expedition's streak is untouched", () => {
  boot();
  const exp = st().events;
  st().switchMode("recreational");
  useGame.setState({ screen: "game" });
  session(0.5, Date.now());
  assert.ok(st().events.streakMs >= 29 * 60_000);
  st().switchMode("expedition");
  assert.equal(st().events.streakMs, exp.streakMs);
});

test("Tournament and Survival: the events clock never runs, nothing starts, and the live rng stream is untouched", () => {
  for (const mode of ["tournament", "survival"] as const) {
    boot(mode);
    assert.equal(st().mode, mode);
    useGame.setState({ events: { ...noEvents(), seed: 3 } });
    setRng(makeRng(77));
    const clean = [rng(), rng(), rng(), rng(), rng()];
    setRng(makeRng(77));
    const r = session(12, Date.now());
    assert.deepEqual(r.started, [], `${mode}: no event`);
    assert.equal(st().events.streakMs, 0);
    assert.equal(st().events.active, null);
    assert.deepEqual([rng(), rng(), rng(), rng(), rng()], clean, `${mode}: the shared rng was not drawn from`);
  }
});

test("an event that was running when the game closed is over when it opens again", async () => {
  boot();
  const now = Date.now();
  useGame.setState({ events: { ...noEvents(), seed: 4, lastAt: now - 60 * 60_000, active: { id: "blood-moon", startedAt: now - 2 * HOUR_MS, endsAt: now - 3600_000 } } });
  const ended: string[] = [];
  const off = onEventEnded((e) => ended.push(e.id));
  stepEventsLive(now);
  off();
  assert.deepEqual(ended, ["blood-moon"]);
  assert.equal(st().events.active, null);
  await flush();
});
