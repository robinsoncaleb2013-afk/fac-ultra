/* Every saved-game fixture under __fixtures__ must load through sanitize()
   without losing progress. Add a fixture whenever SAVE_VERSION changes
   (docs/architecture/07-data-saves-cloud.md §1). */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { fresh, list, sanitize, snapshot, str } from "./engine.ts";
import { dexCount } from "./content.ts";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "__fixtures__");
const fixtures = readdirSync(dir).filter((f) => /^save-v\d+\.json$/.test(f));

test("there is at least one save fixture", () => {
  assert.ok(fixtures.length >= 1);
});

for (const file of fixtures) {
  const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>;
  test(`${file} loads through sanitize() without losing progress`, () => {
    const s = sanitize(raw);
    assert.equal(s.version, fresh().version, "loaded save is stamped with the current version");
    assert.equal(s.c, raw.c, "money preserved");
    assert.equal(s.caught, raw.caught, "catch count preserved");
    assert.equal(dexCount(s.dex), Object.keys(raw.dex as object).length, "dex entries preserved");
    assert.equal(s.inv.length, (raw.inv as unknown[]).length, "inventory preserved");
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === "number") assert.ok(Number.isFinite(v), `${k} is a finite number`);
    }
  });

  test(`${file} survives a snapshot → sanitize round trip`, () => {
    const once = sanitize(raw);
    const twice = sanitize(JSON.parse(JSON.stringify(snapshot(once))));
    assert.deepEqual(twice, once);
  });
}

test("sanitize() rejects garbage and hands back a fresh save", () => {
  for (const junk of [null, 42, "x", [], { version: "9", c: "lots", dex: 7 }]) {
    const s = sanitize(junk);
    assert.equal(s.version, fresh().version);
    assert.ok(Number.isFinite(s.c));
  }
});

test("sanitize() clamps hostile numbers", () => {
  const s = sanitize({ ...fresh(), c: Number.POSITIVE_INFINITY, lv: -5, rod: 9999, biome: 99 });
  assert.ok(Number.isFinite(s.c));
  assert.ok(s.lv >= 1);
  assert.ok(s.rod < 100);
  assert.ok(s.biome >= 0 && s.biome <= 14);
});

test("str() and list() helpers", () => {
  assert.equal(str("hello", "d"), "hello");
  assert.equal(str(5, "d"), "d");
  assert.equal(str("x".repeat(100), "d", 10).length, 10);
  assert.deepEqual(
    list([1, "a", 2], (x) => (typeof x === "number" ? x : undefined)),
    [1, 2],
  );
  assert.deepEqual(
    list("nope", () => 1),
    [],
  );
  assert.equal(list(new Array(1000).fill(0), () => 0, 20).length, 20);
});

/* ── v3 → v4 (WP-1): gfx, assist, followClock ─────────────────────────────── */

test("a v3 save gains the WP-1 settings with safe defaults and keeps its progress", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v3.json"), "utf8")) as Record<
    string,
    unknown
  >;
  assert.equal(raw.version, 3);
  assert.equal("gfx" in raw, false);
  const s = sanitize(raw);
  assert.equal(
    s.version,
    fresh().version,
    "stamped with the current version (4 when WP-1 shipped)",
  );
  assert.equal(s.gfx, "auto");
  assert.equal(s.assist, true);
  assert.equal(s.followClock, true);
  assert.equal(s.c, raw.c, "money preserved");
  assert.equal(dexCount(s.dex), 3, "dex preserved");
  assert.equal(s.caught, raw.caught);
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${k} is not NaN`);
  }
});

test("v4 settings round-trip through snapshot and export/import shape", () => {
  const s = sanitize({ ...fresh(), gfx: "lite", assist: false, followClock: false });
  assert.equal(s.gfx, "lite");
  assert.equal(s.assist, false);
  assert.equal(s.followClock, false);
  const back = sanitize(JSON.parse(JSON.stringify(snapshot(s))));
  assert.deepEqual(back, s);
});

test("hostile gfx / assist / followClock values fall back to defaults", () => {
  const s = sanitize({ ...fresh(), gfx: "ultra-hd", assist: "maybe", followClock: { x: 1 } });
  assert.equal(s.gfx, "auto");
  assert.equal(s.assist, true);
  assert.equal(s.followClock, true);
  assert.equal(sanitize({ ...fresh(), gfx: 7 }).gfx, "auto");
});

/* ── v4 → v5 (WP-2): lastSpot, rig ───────────────────────────────────────── */

test("a v4 save gains empty lastSpot and rig, keeps its progress and its v4 settings", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v4.json"), "utf8")) as Record<
    string,
    unknown
  >;
  assert.equal(raw.version, 4);
  assert.equal("lastSpot" in raw, false);
  assert.equal("rig" in raw, false);
  const s = sanitize(raw);
  assert.equal(s.version, 5);
  assert.deepEqual(s.lastSpot, {});
  assert.deepEqual(s.rig, {});
  assert.equal(s.gfx, raw.gfx, "WP-1 setting preserved");
  assert.equal(s.assist, raw.assist);
  assert.equal(s.c, raw.c, "money preserved");
  assert.equal(s.caught, raw.caught);
  assert.equal(dexCount(s.dex), Object.keys(raw.dex as object).length, "dex preserved");
  assert.equal(s.inv.length, (raw.inv as unknown[]).length, "inventory preserved");
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${k} is not NaN`);
  }
});

test("a v3 save walks all the way to v5", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v3.json"), "utf8")) as Record<
    string,
    unknown
  >;
  const s = sanitize(raw);
  assert.equal(s.version, 5);
  assert.deepEqual(s.lastSpot, {});
  assert.deepEqual(s.rig, {});
});

test("fresh saves start with nothing remembered", () => {
  const f = fresh();
  assert.equal(f.version, 5);
  assert.deepEqual(f.lastSpot, {});
  assert.deepEqual(f.rig, {});
});

test("lastSpot and rig round-trip through snapshot and export/import shape", () => {
  const s = sanitize({
    ...fresh(),
    lastSpot: { 0: "pond-pads", 3: "swamp-hole" },
    rig: { 0: { depth: 0, retrieve: "slow" }, 3: { depth: 2, retrieve: "still" } },
  });
  assert.deepEqual(s.lastSpot, { 0: "pond-pads", 3: "swamp-hole" });
  assert.deepEqual(s.rig[3], { depth: 2, retrieve: "still" });
  const back = sanitize(JSON.parse(JSON.stringify(snapshot(s))));
  assert.deepEqual(back, s);
  const viaCode = sanitize(
    JSON.parse(
      decodeURIComponent(
        escape(atob(btoa(unescape(encodeURIComponent(JSON.stringify(snapshot(s))))))),
      ),
    ),
  );
  assert.deepEqual(viaCode, s);
});

test("hostile lastSpot values are dropped: unknown water, unknown id, an id from another water, wrong types", () => {
  const s = sanitize({
    ...fresh(),
    lastSpot: {
      0: "pond-pads",
      1: "pond-pads",
      2: "nope",
      99: "pond-open",
      x: "pond-open",
      4: 12,
      "-1": "pond-open",
      5: null,
    },
  });
  assert.deepEqual(s.lastSpot, { 0: "pond-pads" });
  for (const junk of [null, 5, "str", [], [1, 2]])
    assert.deepEqual(sanitize({ ...fresh(), lastSpot: junk }).lastSpot, {});
});

test("hostile rig values fall back to the default field by field, and unknown waters are dropped", () => {
  const s = sanitize({
    ...fresh(),
    rig: {
      0: { depth: 9, retrieve: "fast" },
      1: { depth: 2, retrieve: "teleport" },
      2: "x",
      3: null,
      77: { depth: 1, retrieve: "slow" },
      bad: {},
    },
  });
  assert.deepEqual(s.rig[0], { depth: 1, retrieve: "fast" });
  assert.deepEqual(s.rig[1], { depth: 2, retrieve: "medium" });
  assert.deepEqual(s.rig[2], { depth: 1, retrieve: "medium" });
  assert.deepEqual(s.rig[3], { depth: 1, retrieve: "medium" });
  assert.equal(77 in s.rig, false);
  assert.equal(Object.keys(s.rig).length, 4);
  for (const junk of [null, 5, "str", []])
    assert.deepEqual(sanitize({ ...fresh(), rig: junk }).rig, {});
});
