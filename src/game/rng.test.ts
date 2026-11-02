import assert from "node:assert/strict";
import { test } from "node:test";
import { loose, makeRng, pick, range, rng, seedFrom, setRng, weighted } from "./rng.ts";

test("makeRng is deterministic and stays in [0, 1)", () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test("different seeds give different streams", () => {
  const a = makeRng(1);
  const b = makeRng(2);
  const same = Array.from({ length: 20 }, () => a() === b()).filter(Boolean).length;
  assert.ok(same < 2);
});

test("a known seed keeps producing the same numbers (the replay contract)", () => {
  const r = makeRng(42);
  const first = [r(), r(), r()].map((x) => +x.toFixed(6));
  const again = makeRng(42);
  assert.deepEqual(
    [again(), again(), again()].map((x) => +x.toFixed(6)),
    first,
  );
});

test("seedFrom is stable, sensitive to every part and to the part boundaries", () => {
  assert.equal(seedFrom("event-7", "alice", 3), seedFrom("event-7", "alice", 3));
  assert.notEqual(seedFrom("event-7", "alice", 3), seedFrom("event-7", "alice", 4));
  assert.notEqual(seedFrom("event-7", "alice", 3), seedFrom("event-7", "bob", 3));
  assert.notEqual(seedFrom("a", "bc"), seedFrom("ab", "c"));
  const v = seedFrom("x");
  assert.ok(Number.isInteger(v) && v >= 0 && v < 2 ** 32);
});

test("setRng swaps the active stream that rng() reads", () => {
  const saved = rng;
  try {
    setRng(makeRng(7));
    const a = [rng(), rng(), rng()];
    setRng(makeRng(7));
    const b = [rng(), rng(), rng()];
    assert.deepEqual(a, b);
  } finally {
    setRng(saved);
  }
});

test("weighted picks in proportion to the weights and never picks a zero weight", () => {
  const r = makeRng(99);
  const counts = [0, 0, 0, 0];
  const n = 20000;
  for (let i = 0; i < n; i++) counts[weighted([1, 3, 0, 6], r)]++;
  assert.equal(counts[2], 0);
  assert.ok(Math.abs(counts[0] / n - 0.1) < 0.02, `got ${counts[0] / n}`);
  assert.ok(Math.abs(counts[1] / n - 0.3) < 0.02);
  assert.ok(Math.abs(counts[3] / n - 0.6) < 0.02);
});

test("weighted copes with all-zero and single weights", () => {
  assert.equal(weighted([5], makeRng(1)), 0);
  assert.equal(weighted([0, 0, 0], makeRng(1)), 2);
  assert.equal(
    weighted([0, 7, 0], () => 0.999999),
    1,
  );
});

test("pick and range stay in bounds", () => {
  const r = makeRng(5);
  const items = ["a", "b", "c"];
  for (let i = 0; i < 500; i++) assert.ok(items.includes(pick(items, r)));
  assert.equal(
    pick(["only"], () => 0.9999),
    "only",
  );
  for (let i = 0; i < 500; i++) {
    const x = range(2, 5, r);
    assert.ok(x >= 2 && x < 5);
  }
});

test("loose is its own stream: using it does not move the model stream", () => {
  const saved = rng;
  try {
    setRng(makeRng(11));
    const first = rng();
    setRng(makeRng(11));
    for (let i = 0; i < 50; i++) loose();
    assert.equal(rng(), first);
  } finally {
    setRng(saved);
  }
});
