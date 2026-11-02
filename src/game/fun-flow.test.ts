/* The fun layer working in the real store (05 §6): Fish of the Day, shiny, sticker pages, the pet, the Regulars' Derby,
   saving, keeping Expedition and Recreational apart, and staying OUT of Tournaments and Survival. A tiny fake browser is enough. */
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

const { useGame, hydrate, MODE_KEYS, applyCatch, frame, resetSim } = await import("./engine.ts");
const rngMod = await import("./rng.ts");
const { makeRng, setRng } = rngMod;
/* `rng` is a live binding; a destructured copy would be stale, so always read it through the module. */
const rng = () => rngMod.rng();
const { fotdFor, today } = await import("./fotd.ts");
const { catchXp } = await import("./keep.ts");
const { rarityOf, BIOMES } = await import("./content.ts");
const { frameId, pageId } = await import("./stickers.ts");
const { LURES } = await import("./content.ts");

const here = dirname(fileURLToPath(import.meta.url));
const v7 = JSON.parse(readFileSync(join(here, "__fixtures__", "save-v7.json"), "utf8"));
const st = () => useGame.getState();
const flush = () => new Promise((r) => setTimeout(r, 450));

function boot() {
  mem.clear();
  setRng(makeRng(5));
  mem.set(MODE_KEYS.expedition, JSON.stringify(v7));
  hydrate();
}

const fishOf = (b: number, i: number, m = 0) => ({ b, i, t: rarityOf(i), m, name: BIOMES[b].fish[i], w: 2, v: 10, boss: i === 24 });
const land = (b: number, i: number, m = 0) =>
  applyCatch({ ...st(), toasts: [] }, fishOf(b, i, m), { auto: false, perfect: false, frenzy: false });

test("a v7 session loads in the real store as v8 with the Regulars running the old Derby", () => {
  boot();
  const s = st();
  assert.equal(s.caught, v7.caught);
  assert.equal(s.pet.kind, null);
  assert.deepEqual(s.stickers, []);
  assert.ok(s.derby, "the Derby came through");
  assert.equal(s.derby!.rivals.length, 3);
});

test("Fish of the Day: the first catch today doubles XP and earns a gold frame; the second does not", () => {
  boot();
  useGame.setState({ lv: 60, xp: 0 }); // far from a level-up, so xp is a clean number
  const date = today();
  const f = fotdFor(date, st().ub)!;
  const plain = f.species === 0 ? 1 : 0;
  const one = land(f.biome, plain);
  assert.equal(one.lastCatch.fotd, false);
  assert.equal(one.xp, catchXp(rarityOf(plain), 0, f.biome, false), "an ordinary fish gives normal XP");
  const first = land(f.biome, f.species);
  assert.equal(first.lastCatch.fotd, true);
  assert.equal(first.xp, 2 * catchXp(rarityOf(f.species), 0, f.biome, false), "double XP");
  assert.ok(first.stickers.includes(frameId(f.key)), "gold frame");
  assert.deepEqual(first.fotdClaimed, [date]);
  useGame.setState({ ...first, xp: 0 });
  const second = land(f.biome, f.species);
  assert.equal(second.lastCatch.fotd, false, "only once a day");
  assert.equal(second.xp, catchXp(rarityOf(f.species), 0, f.biome, false));
  assert.equal(second.fotdClaimed.length, 1);
});

test("finishing a page drops the page sticker once, and says so", () => {
  boot();
  const dex: Record<string, { c: number; w: number; m: number }> = {};
  for (let i = 0; i < 24; i++) dex[`0-${i}`] = { c: 1, w: 1, m: 0 };
  useGame.setState({ dex });
  const done = land(0, 24);
  assert.ok(done.stickers.includes(pageId(0)));
  assert.equal(done.lastCatch.page, true);
  useGame.setState({ ...done });
  const again = land(0, 24);
  assert.equal(again.stickers.filter((x: string) => x === pageId(0)).length, 1);
  assert.equal(again.lastCatch.page, false);
});

test("shiny fish turn up about 2% of the time, are listed once, and never move the fishing stream", () => {
  boot();
  setRng(makeRng(9));
  const clean = [rng(), rng(), rng(), rng()];
  setRng(makeRng(9));
  let shinies = 0;
  const N = 3000;
  for (let n = 0; n < N; n++) {
    const r = land(0, 3);
    if (r.lastCatch.shiny) shinies++;
  }
  assert.ok(shinies > N * 0.008 && shinies < N * 0.04, `${shinies} shinies of ${N}`);
  assert.deepEqual([rng(), rng(), rng(), rng()], clean, "the catch bookkeeping drew nothing from rng()");
});

test("the pet opens at level 5, brings a gift once an hour, and keeps across a reload", async () => {
  boot();
  st().choosePet("otter");
  assert.equal(st().pet.kind, null, "too low a level");
  useGame.setState({ lv: 5 });
  st().choosePet("otter");
  assert.equal(st().pet.kind, "otter");
  const before = Object.values(st().box).reduce((a, b) => a + b, 0);
  st().claimGift();
  const after = Object.values(st().box).reduce((a, b) => a + b, 0);
  assert.equal(after - before, 5);
  assert.equal(st().pet.gifts, 1);
  st().claimGift();
  assert.equal(Object.values(st().box).reduce((a, b) => a + b, 0), after, "nothing more for an hour");
  assert.ok(LURES.length > 0);
  await flush();
  const saved = JSON.parse(mem.get(MODE_KEYS.expedition)!);
  assert.equal(saved.version, 9);
  assert.equal(saved.pet.kind, "otter");
  hydrate();
  assert.equal(st().pet.kind, "otter");
  assert.equal(st().pet.gifts, 1);
});

test("the Derby is fished against the Regulars, filed in the head-to-head record, and paid on time", () => {
  boot();
  useGame.setState({ derby: null });
  st().startDerby();
  const d = st().derby!;
  assert.equal(d.rivals.length, 3);
  assert.ok(d.ctx.seed >= 0);
  useGame.setState({ derby: { ...d, endsAt: Date.now() - 1, score: 1e9 } });
  resetSim();
  frame(0.05);
  assert.equal(st().derby, null);
  const rec = st().rivalRecord;
  assert.equal(Object.keys(rec).length, 3);
  for (const e of Object.values(rec)) assert.deepEqual(e, { w: 1, l: 0 });
  assert.equal(st().derbiesWon, v7.derbiesWon + 1);
});

test("Expedition and Recreational each keep their own stickers, shinies, pet and daily claim", async () => {
  boot();
  const f = fotdFor(today(), st().ub)!;
  useGame.setState({ ...land(f.biome, f.species), lv: 5 });
  st().choosePet("dog");
  await flush();
  const careerBefore = mem.get(MODE_KEYS.expedition);
  st().switchMode("recreational");
  const rec = st();
  assert.equal(rec.mode, "recreational");
  assert.deepEqual(rec.fotdClaimed, [], "the career's claim is not Relaxed Fishing's");
  assert.equal(rec.pet.kind, null, "no pet carried over");
  assert.ok(!rec.stickers.includes(frameId(f.key)));
  /* Relaxed Fishing can claim today's fish for itself, once, without touching the career */
  const fr = fotdFor(today(), st().ub)!;
  useGame.setState({ ...land(fr.biome, fr.species), lv: 5 });
  assert.deepEqual(st().fotdClaimed, [today()]);
  st().choosePet("otter");
  await flush();
  assert.equal(mem.get(MODE_KEYS.expedition), careerBefore, "the career slot did not change by a byte");
  st().switchMode("expedition");
  assert.equal(st().pet.kind, "dog");
  assert.deepEqual(st().fotdClaimed, [today()]);
  st().switchMode("recreational");
  assert.equal(st().pet.kind, "otter");
});

test("Tournaments and Survival leave the fun layer out", () => {
  boot();
  st().switchMode("survival");
  assert.equal(st().mode, "survival");
  const f = fotdFor(today(), [0, 1, 2, 3])!;
  const sv = land(f.biome, f.species);
  assert.equal(sv.lastCatch.fotd, false);
  assert.equal(sv.lastCatch.shiny, false);
  assert.deepEqual(sv.stickers, []);
  useGame.setState({ lv: 9 });
  st().choosePet("otter");
  assert.equal(st().pet.kind, null);
  const surv = JSON.parse(mem.get(MODE_KEYS.survival) ?? "{}");
  assert.equal("pet" in surv, false, "the Survival slot keeps its own shape");
  st().switchMode("tournament");
  assert.equal(st().mode, "tournament");
  const t = land(0, 3);
  assert.equal(t.lastCatch.shiny, false);
  assert.equal(t.lastCatch.fotd, false);
  assert.deepEqual(t.fotdClaimed, []);
  useGame.setState({ lv: 9 });
  st().choosePet("heron");
  st().claimGift();
  assert.equal(st().pet.kind, null);
});
