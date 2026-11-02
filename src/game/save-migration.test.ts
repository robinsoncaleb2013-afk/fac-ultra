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
  assert.equal(s.version, fresh().version, "stamped with the current version");
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

test("a v3 save walks all the way to the current version", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v3.json"), "utf8")) as Record<
    string,
    unknown
  >;
  const s = sanitize(raw);
  assert.equal(s.version, fresh().version, "stamped with the current version");
  assert.deepEqual(s.lastSpot, {});
  assert.deepEqual(s.rig, {});
});

test("fresh saves start with nothing remembered", () => {
  const f = fresh();
  assert.equal(f.version, 6);
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

/* ── v5 → v6 (WP-3): records, released, stewards, coached, drag ───────────── */

test("a v5 save gains empty WP-3 fields, keeps its progress and its spots and rigs", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v5.json"), "utf8")) as Record<string, unknown>;
  assert.equal(raw.version, 5);
  for (const k of ["records", "released", "stewards", "coached", "drag"]) assert.equal(k in raw, false, k);
  const s = sanitize(raw);
  assert.equal(s.version, 6);
  assert.deepEqual(s.records, {});
  assert.deepEqual(s.released, {});
  assert.deepEqual(s.stewards, { species: [], waters: [] });
  assert.deepEqual(s.coached, {});
  assert.equal(s.drag, 1);
  assert.deepEqual(s.lastSpot, { 0: "pond-pads", 1: "river-run" }, "WP-2 spots preserved");
  assert.deepEqual(s.rig[0], { depth: 0, retrieve: "slow" }, "WP-2 rig preserved");
  assert.equal(s.c, raw.c, "money preserved");
  assert.equal(s.lv, raw.lv);
  assert.equal(s.caught, raw.caught);
  assert.equal(dexCount(s.dex), Object.keys(raw.dex as object).length, "dex preserved");
  assert.equal(s.inv.length, (raw.inv as unknown[]).length, "inventory preserved");
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${k} is not NaN`);
  }
});

test("a v4 save walks all the way to v6 with every new field empty", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v4.json"), "utf8")) as Record<string, unknown>;
  const s = sanitize(raw);
  assert.equal(s.version, 6);
  assert.deepEqual(s.records, {});
  assert.deepEqual(s.stewards, { species: [], waters: [] });
});

test("records, released, stewards, coached and drag round-trip through snapshot and the export code", () => {
  const s = sanitize({
    ...fresh(),
    dex: { "0-13": { c: 2, w: 6.4, m: 0 } },
    records: {
      "0-13": {
        w: 6.4,
        at: 1_700_000_000_000,
        spot: "pond-pads",
        p: { family: "worm", depth: 0, retrieve: "slow" },
        weather: 1,
        window: "dusk",
      },
    },
    released: { "0-13": 5, "1-3": 2 },
    stewards: { species: ["0-13"], waters: [1] },
    coached: { runner: 2, jumper: 3 },
    drag: 2,
  });
  assert.equal(s.records["0-13"].w, 6.4);
  assert.equal(s.records["0-13"].window, "dusk");
  assert.deepEqual(s.released, { "0-13": 5, "1-3": 2 });
  assert.deepEqual(s.stewards, { species: ["0-13"], waters: [1] });
  assert.deepEqual(s.coached, { runner: 2, jumper: 3 });
  assert.equal(s.drag, 2);
  const back = sanitize(JSON.parse(JSON.stringify(snapshot(s))));
  assert.deepEqual(back, s);
  const viaCode = sanitize(JSON.parse(decodeURIComponent(escape(atob(btoa(unescape(encodeURIComponent(JSON.stringify(snapshot(s))))))))));
  assert.deepEqual(viaCode, s);
});

test("hostile WP-3 values are cleaned: unknown species, bad numbers, wrong shapes", () => {
  const s = sanitize({
    ...fresh(),
    records: {
      "0-1": { w: -4, p: {}, window: "midnight" },
      "0-2": { w: 3.5, at: "yesterday", spot: 99, p: { family: "laser", depth: 9, retrieve: "warp" }, weather: 77, window: "noon" },
      "99-1": { w: 5 },
      "x": { w: 5 },
      "3-3": 12,
      "3-4": null,
    },
    released: { "0-1": 3.6, "0-2": -2, "99-9": 5, nope: 1, "2-2": "many" },
    stewards: { species: ["0-1", "99-1", 7, "x"], waters: [0, 15, -1, 2.4, "1", 3, 3] },
    coached: { runner: 500, kraken: 3, diver: "lots", bulldog: -4 },
    drag: 9,
  });
  assert.deepEqual(Object.keys(s.records), ["0-2"], "only the record with a real weight survives");
  assert.deepEqual(s.records["0-2"].p, { family: "worm", depth: 1, retrieve: "medium" });
  assert.equal(s.records["0-2"].weather, 0);
  assert.equal(s.records["0-2"].window, "day");
  assert.equal(s.records["0-2"].at, 0);
  assert.equal(s.records["0-2"].spot, "");
  assert.deepEqual(s.released, { "0-1": 4 });
  assert.deepEqual(s.stewards, { species: ["0-1"], waters: [0, 2, 3] });
  assert.deepEqual(s.coached, { runner: 99 });
  assert.equal(s.drag, 2, "drag is clamped to the nearest setting");
  for (const junk of [null, 5, "str", [], [1, 2]]) {
    const t = sanitize({ ...fresh(), records: junk, released: junk, stewards: junk, coached: junk });
    assert.deepEqual(t.records, {});
    assert.deepEqual(t.released, {});
    assert.deepEqual(t.stewards, { species: [], waters: [] });
    assert.deepEqual(t.coached, {});
  }
});
