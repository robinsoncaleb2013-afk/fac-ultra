import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES } from "./content.ts";
import { makeRng, rng, setRng } from "./rng.ts";
import {
  advanceRival,
  castSeconds,
  DERBY_MS,
  derbyEndLine,
  derbyRank,
  missChance,
  newDerby,
  pickRivals,
  readDerby,
  readRivalRecord,
  recordDerby,
  RIVALS,
  rivalById,
  rivalCast,
  stepDerby,
  type DerbyCtx,
} from "./rivals.ts";

const CTX: DerbyCtx = { seed: 1234, biome: 0, luck: 20, stage: 3, weather: 0, window: "dawn" };

test("there are twelve distinct named Regulars with a face, three lines and a voice", () => {
  assert.equal(RIVALS.length, 12);
  assert.equal(new Set(RIVALS.map((r) => r.id)).size, 12);
  assert.equal(new Set(RIVALS.map((r) => r.name)).size, 12);
  for (const r of RIVALS) {
    assert.ok(r.emoji.length > 0);
    assert.equal(r.lines.length, 3);
    assert.ok(r.win && r.lose);
    assert.ok(r.skill >= 0.4 && r.skill <= 0.95, `${r.name} skill ${r.skill}`);
    assert.ok(BIOMES[r.water], `${r.name} has a real favourite water`);
  }
  const skills = RIVALS.map((r) => r.skill);
  assert.equal(Math.min(...skills), 0.4);
  assert.equal(Math.max(...skills), 0.95);
});

test("a rival cast is a pure function of its seed: same inputs, same fish", () => {
  const r = rivalById("cobb")!;
  const a = Array.from({ length: 40 }, (_, k) => rivalCast(r, CTX, k));
  const b = Array.from({ length: 40 }, (_, k) => rivalCast(r, CTX, k));
  assert.deepEqual(a, b);
  const other = Array.from({ length: 40 }, (_, k) => rivalCast(r, { ...CTX, seed: 99 }, k));
  assert.notDeepEqual(a, other, "a different Derby seed gives a different day");
});

test("rival casts never touch the live fishing stream (fun layer stays out of replay)", () => {
  setRng(makeRng(42));
  const clean = [rng(), rng(), rng()];
  setRng(makeRng(42));
  for (const r of RIVALS) for (let k = 0; k < 20; k++) rivalCast(r, CTX, k);
  assert.deepEqual([rng(), rng(), rng()], clean);
});

test("better anglers do better: average value rises with skill", () => {
  const avg = (id: string) => {
    const r = rivalById(id)!;
    let sum = 0;
    for (let k = 0; k < 600; k++) sum += rivalCast(r, { ...CTX, seed: 7 }, k);
    return sum / 600;
  };
  const tilly = avg("tilly");
  const dara = avg("dara");
  const queen = avg("queen");
  assert.ok(dara > tilly, `Dara ${dara} > Tilly ${tilly}`);
  assert.ok(queen > dara, `Queen ${queen} > Dara ${dara}`);
  assert.ok(queen > tilly * 2, "an expert is far ahead of a beginner");
});

test("a beginner misses more casts than an expert", () => {
  assert.ok(missChance(0.4) > missChance(0.95));
  assert.ok(castSeconds(0.4) > castSeconds(0.95));
  const r = rivalById("tilly")!;
  const empty = Array.from({ length: 400 }, (_, k) => rivalCast(r, CTX, k)).filter((v) => v === 0).length;
  assert.ok(empty > 60 && empty < 200, `${empty} empty casts of 400`);
});

test("advanceRival is catch-up safe: stepping often or once gives the same score", () => {
  const start = { id: "ness", s: 0, k: 0 };
  let stepped = start;
  for (let t = 1; t <= 600; t++) stepped = advanceRival(stepped, CTX, t);
  const once = advanceRival(start, CTX, 600);
  assert.deepEqual(stepped, once);
  assert.deepEqual(advanceRival(once, CTX, 600), once, "asking twice changes nothing");
  assert.deepEqual(advanceRival(once, CTX, 100), once, "time never runs backwards");
});

test("a Derby ten minutes long gives every rival a believable total", () => {
  const d = stepDerby(newDerby(0, CTX), DERBY_MS);
  assert.equal(d.rivals.length, 3);
  for (const r of d.rivals) assert.ok(r.s > 0, `${r.id} caught something`);
  assert.deepEqual(stepDerby(newDerby(0, CTX), DERBY_MS), d, "same seed, same Derby");
});

test("pickRivals is seeded, distinct, and leans toward the water a Regular loves", () => {
  assert.deepEqual(pickRivals(5, 0).map((r) => r.id), pickRivals(5, 0).map((r) => r.id));
  const ids = pickRivals(5, 2, 3).map((r) => r.id);
  assert.equal(new Set(ids).size, 3);
  let withFavourite = 0;
  let without = 0;
  for (let seed = 0; seed < 600; seed++) {
    const lake = pickRivals(seed, 2, 3).filter((r) => r.water === 2).length;
    const sky = pickRivals(seed, 13, 3).filter((r) => r.water === 2).length;
    withFavourite += lake;
    without += sky;
  }
  assert.ok(withFavourite > without * 1.5, `Lake lovers show up on the Lake (${withFavourite} vs ${without})`);
});

test("ties go to the rival; ranks and the closing line follow", () => {
  assert.equal(derbyRank(100, [{ s: 100 }, { s: 5 }]), 2);
  assert.equal(derbyRank(101, [{ s: 100 }, { s: 5 }]), 1);
  assert.match(derbyEndLine(500, [{ id: "queen", s: 10 }]), /Pike Queen/);
  assert.match(derbyEndLine(1, [{ id: "tilly", s: 10 }]), /Tilly/);
  assert.equal(derbyEndLine(1, []), "");
});

test("head-to-head records add up and survive hostile data", () => {
  let rec = recordDerby({}, 100, [{ id: "tilly", s: 40 }, { id: "queen", s: 400 }, { id: "ghost", s: 1 }]);
  assert.deepEqual(rec, { tilly: { w: 1, l: 0 }, queen: { w: 0, l: 1 } });
  rec = recordDerby(rec, 50, [{ id: "tilly", s: 50 }]);
  assert.deepEqual(rec.tilly, { w: 1, l: 1 });
  assert.deepEqual(readRivalRecord({ tilly: { w: 3, l: -4 }, nobody: { w: 1 }, queen: "x", cobb: { w: 1e99, l: 2 } }), {
    tilly: { w: 3, l: 0 },
    cobb: { w: 9999, l: 2 },
  });
  assert.deepEqual(readRivalRecord([1, 2]), {});
});

test("an old random-walk Derby (names and scores only) becomes a Regulars Derby that keeps its scores", () => {
  const old = { endsAt: 1000, score: 321, rivals: [{ n: "Old Cobb", s: 50 }, { n: "Maren", s: 70 }, { n: "Somebody New", s: 9 }] };
  const d = readDerby(old, 3, 2000)!;
  assert.equal(d.score, 321);
  assert.deepEqual(d.rivals.map((r) => r.s), [50, 70, 9]);
  assert.equal(d.rivals[0].id, "cobb");
  assert.equal(d.rivals[1].id, "maren");
  assert.ok(rivalById(d.rivals[2].id), "an unknown name becomes a real Regular");
  assert.equal(new Set(d.rivals.map((r) => r.id)).size, 3);
  assert.deepEqual(readDerby(JSON.parse(JSON.stringify(d)), 3, 2000), d, "the converted Derby round-trips");
  assert.equal(readDerby(null, 0), null);
  assert.equal(readDerby({ endsAt: 1, rivals: [] }, 0), null);
});
