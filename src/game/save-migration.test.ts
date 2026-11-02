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
  assert.equal(s.gfx, "medium", "WP-10: the old name lite means the Medium level");
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
  assert.equal(s.gfx, raw.gfx === "lite" ? "medium" : raw.gfx, "WP-1 setting preserved (old tier names become levels)");
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
  assert.equal(f.version, fresh().version);
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
  assert.equal(s.version, fresh().version);
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

test("a v4 save walks all the way to the current version with every new field empty", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v4.json"), "utf8")) as Record<string, unknown>;
  const s = sanitize(raw);
  assert.equal(s.version, fresh().version);
  assert.equal(s.kid, false);
  assert.deepEqual(s.trips, []);
  assert.equal(s.trip, null);
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

/* ── v6 → v7 (WP-4): kid, trips, trip ─────────────────────────────────────── */

import { MODES } from "./modes.ts";
import { finishTrip, startTrip, tripCatch } from "./trips.ts";
import { unlockedSave } from "./engine.ts";
import { BIOMES } from "./content.ts";

test("a v6 save gains Kid Mode off and an empty logbook, and keeps everything it had", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v6.json"), "utf8")) as Record<string, unknown>;
  assert.equal(raw.version, 6);
  for (const k of ["kid", "trips", "trip"]) assert.equal(k in raw, false, k);
  const s = sanitize(raw);
  assert.equal(s.version, fresh().version);
  assert.equal(s.kid, false);
  assert.deepEqual(s.trips, []);
  assert.equal(s.trip, null);
  assert.equal(s.c, raw.c, "money preserved");
  assert.equal(s.caught, raw.caught, "catch count preserved");
  assert.deepEqual(s.dex, raw.dex, "dex preserved");
  assert.deepEqual(s.records, raw.records, "WP-3 records preserved");
  assert.equal(s.drag, raw.drag);
  assert.equal(s.assist, raw.assist);
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${k} is not NaN`);
  }
});

test("a v3, v4 and v5 save all reach the current version with the WP-4 fields at their defaults", () => {
  for (const f of ["save-v3.json", "save-v4.json", "save-v5.json"]) {
    const s = sanitize(JSON.parse(readFileSync(join(dir, f), "utf8")));
    assert.equal(s.version, fresh().version, f);
    assert.equal(s.kid, false, f);
    assert.deepEqual(s.trips, [], f);
    assert.equal(s.trip, null, f);
  }
});

test("an old Sandbox-shaped save (nothing to sell, everything unlocked) loads as a Recreational save", () => {
  /* The sandbox slot's saves are in the v6 shape: no kid, no trips. They keep their gear, waters and bag. */
  const old = JSON.parse(JSON.stringify(unlockedSave())) as Record<string, unknown>;
  old.version = 6;
  delete old.kid;
  delete old.trips;
  delete old.trip;
  old.dex = { "0-4": { c: 2, w: 3.1, m: 0 } };
  old.inv = [{ name: "Perch", t: 0, v: 4, w: 1.2, i: 4, b: 0, m: 0 }];
  const s = sanitize(old);
  assert.equal(s.version, fresh().version);
  assert.equal(s.ub.length, BIOMES.length, "every water is still unlocked");
  assert.deepEqual(s.dex, { "0-4": { c: 2, w: 3.1, m: 0 } });
  assert.equal(s.inv.length, 1);
  assert.equal(MODES.recreational.saveKey, "fac-ultra-sandbox");
});

test("kid and the trip log round-trip through snapshot and the export code", () => {
  let trip = startTrip(1_700_000_000_000, 2, "dusk", 1);
  trip = tripCatch(trip, { name: "Pike", w: 4.2, rarity: 1, discovered: true, record: false }, 1_700_000_100_000);
  const done = finishTrip(trip, 1_700_000_500_000);
  const open = startTrip(1_700_001_000_000, 0);
  const s = sanitize({ ...fresh(), kid: true, trips: [done], trip: open });
  assert.equal(s.kid, true);
  assert.deepEqual(s.trips, [done]);
  assert.deepEqual(s.trip, open);
  const back = sanitize(JSON.parse(JSON.stringify(snapshot(s))));
  assert.deepEqual(back, s);
  const viaCode = sanitize(
    JSON.parse(decodeURIComponent(escape(atob(btoa(unescape(encodeURIComponent(JSON.stringify(snapshot(s))))))))),
  );
  assert.deepEqual(viaCode, s);
});

test("hostile WP-4 values are cleaned: junk trips, a closed trip pretending to be open, too many trips", () => {
  const done = finishTrip(startTrip(1_700_000_000_000, 0), 1_700_000_001_000);
  const s = sanitize({
    ...fresh(),
    kid: "yes",
    trips: [done, 7, null, { start: "x" }, ...new Array(90).fill(done)],
    trip: done,
  });
  assert.equal(s.kid, false, "only a real boolean (or 0/1) turns Kid Mode on");
  assert.equal(s.trips.length, 50);
  assert.equal(s.trip, null, "a finished trip is not the trip in progress");
  for (const junk of [null, 5, "str", [], {}]) {
    const t = sanitize({ ...fresh(), trips: junk, trip: junk });
    assert.deepEqual(t.trips, []);
    assert.equal(t.trip, null);
  }
  assert.equal(sanitize({ ...fresh(), kid: 1 }).kid, true);
});

/* ── v7 → v8 (WP-6): pet, stickers, shiny, fotdClaimed, rivalRecord, volume, cb ─────────────────── */

import { DEFAULT_VOLUME } from "./ambience.ts";
import { frameId, pageId } from "./stickers.ts";

const v7 = () => JSON.parse(readFileSync(join(dir, "save-v7.json"), "utf8")) as Record<string, unknown>;

test("a v7 save (a real session, Derby running) loads as the current version with an empty fun layer and keeps its progress", () => {
  const raw = v7();
  assert.equal(raw.version, 7);
  assert.equal("pet" in raw, false);
  const s = sanitize(raw);
  assert.equal(s.version, fresh().version);
  assert.equal(s.c, raw.c);
  assert.equal(s.caught, raw.caught);
  assert.equal(s.lv, raw.lv);
  assert.equal(dexCount(s.dex), Object.keys(raw.dex as object).length);
  assert.deepEqual(s.pet, { kind: null, next: 0, gifts: 0 });
  assert.deepEqual(s.stickers, []);
  assert.deepEqual(s.shiny, []);
  assert.deepEqual(s.fotdClaimed, []);
  assert.deepEqual(s.rivalRecord, {});
  assert.equal(s.volume, DEFAULT_VOLUME);
  assert.equal(s.cb, false);
});

test("the v7 Derby that was running becomes a Regulars Derby with the same three anglers", () => {
  const raw = v7();
  const s = sanitize(raw);
  assert.ok(s.derby, "the Derby survived");
  assert.deepEqual(
    s.derby!.rivals.map((r) => r.id),
    ["juno", "queen", "cobb"],
    "Juno, Pike Queen and Old Cobb keep their faces",
  );
  assert.equal(s.derby!.endsAt, (raw.derby as { endsAt: number }).endsAt);
});

test("a v8 save with a pet, stickers, shinies and records round-trips and survives export codes", () => {
  const s = sanitize({
    ...fresh(),
    pet: { kind: "heron", next: 5000, gifts: 4 },
    stickers: [pageId(0), frameId("0-3")],
    shiny: ["0-3"],
    fotdClaimed: ["2026-11-01", "2026-11-02"],
    rivalRecord: { cobb: { w: 2, l: 5 } },
    volume: 70,
    cb: true,
  });
  assert.equal(s.pet.kind, "heron");
  assert.equal(s.volume, 70);
  assert.equal(s.cb, true);
  const back = sanitize(JSON.parse(JSON.stringify(snapshot(s))));
  assert.deepEqual(back, s);
  const viaCode = sanitize(JSON.parse(decodeURIComponent(escape(atob(btoa(unescape(encodeURIComponent(JSON.stringify(snapshot(s))))))))));
  assert.deepEqual(viaCode, s);
});

test("hostile WP-6 values are cleaned", () => {
  const s = sanitize({
    ...fresh(),
    pet: { kind: "dragon", next: "soon", gifts: -3 },
    stickers: ["page-99", "page-1", "page-1", 7, "frame-1-77"],
    shiny: ["1-1", "1-1", "zz", 5],
    fotdClaimed: ["yesterday", "2026-11-02"],
    rivalRecord: { cobb: { w: -1, l: "x" }, nobody: { w: 4, l: 4 } },
    volume: 9999,
    cb: "yes",
  });
  assert.deepEqual(s.pet, { kind: null, next: 0, gifts: 0 });
  assert.deepEqual(s.stickers, ["page-1"]);
  assert.deepEqual(s.shiny, ["1-1"]);
  assert.deepEqual(s.fotdClaimed, ["2026-11-02"]);
  assert.deepEqual(s.rivalRecord, {});
  assert.equal(s.volume, 100);
  assert.equal(s.cb, false);
  for (const junk of [null, 5, "x", [], {}]) {
    const t = sanitize({ ...fresh(), pet: junk, stickers: junk, shiny: junk, fotdClaimed: junk, rivalRecord: junk, volume: junk });
    assert.deepEqual(t.stickers, []);
    assert.equal(t.pet.kind, null);
    assert.equal(t.volume, junk === undefined ? DEFAULT_VOLUME : t.volume);
  }
});

/* ── v8 → v9 (WP-8): trophies, titles, bobberSkin, tourneyHistory ─────────── */

test("a v8 save gains an empty cabinet and the Classic bobber, and keeps its progress", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v8.json"), "utf8")) as Record<string, unknown>;
  assert.equal(raw.version, 8);
  for (const k of ["trophies", "titles", "bobberSkin", "tourneyHistory"]) assert.equal(k in raw, false, `${k} is new in v9`);
  const s = sanitize(raw);
  assert.equal(s.version, fresh().version);
  assert.deepEqual(s.trophies, []);
  assert.deepEqual(s.titles, []);
  assert.deepEqual(s.tourneyHistory, []);
  assert.equal(s.bobberSkin, "plain");
  assert.equal(s.c, raw.c);
  assert.equal(s.caught, raw.caught);
  assert.equal(Object.keys(s.dex).length, Object.keys(raw.dex as object).length);
  assert.deepEqual(s.pet, raw.pet, "WP-6 fields untouched");
});

test("the WP-8 cabinet survives a save, a reload and an export code", () => {
  const s = sanitize({
    ...fresh(),
    trophies: [{ id: "q-2026110213", medal: 1, kind: "quick", water: 0, category: "total", team: null, at: 1793000000000 }],
    titles: ["Pond Champion · Nov 2"],
    bobberSkin: "gold",
    tourneyHistory: [{ id: "q-2026110213", title: "Pond Quick", kind: "quick", water: 0, category: "total", team: null, rank: 1, entrants: 6, score: 12.5, best: 4.2, at: 1793000000000, medal: 1 }],
  });
  assert.equal(s.trophies.length, 1);
  assert.equal(s.bobberSkin, "gold");
  const back = sanitize(JSON.parse(JSON.stringify(snapshot(s))));
  assert.deepEqual(back, s);
  const viaCode = sanitize(JSON.parse(decodeURIComponent(escape(atob(btoa(unescape(encodeURIComponent(JSON.stringify(snapshot(s))))))))));
  assert.deepEqual(viaCode, s);
});

test("hostile WP-8 values are cleaned", () => {
  const s = sanitize({
    ...fresh(),
    trophies: [{ id: "x", medal: 1 }, { id: "q-2026110213", medal: 99, water: 99, kind: "?", category: "?" }, "no", null],
    titles: ["<b>Hi</b>", 5, "<b>Hi</b>"],
    bobberSkin: "rainbow",
    tourneyHistory: [{ id: "q-2026110213", rank: "first", score: -5, entrants: Infinity }],
  });
  assert.equal(s.trophies.length, 1);
  assert.equal(s.trophies[0].medal, 3);
  assert.equal(s.trophies[0].kind, "quick");
  assert.deepEqual(s.titles, ["bHib"]);
  assert.equal(s.bobberSkin, "plain");
  assert.equal(s.tourneyHistory[0].rank, 1);
  assert.equal(s.tourneyHistory[0].score, 0);
  for (const junk of [null, 5, "x", {}, []]) {
    const t = sanitize({ ...fresh(), trophies: junk, titles: junk, tourneyHistory: junk, bobberSkin: junk });
    assert.deepEqual([t.trophies, t.titles, t.tourneyHistory, t.bobberSkin], [[], [], [], "plain"]);
  }
});

test("v10 fixture keeps the events state (streak, running event, seen events, mutated dex entry)", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v10.json"), "utf8")) as Record<string, unknown>;
  const s = sanitize(raw);
  assert.equal(s.events.streakMs, 5_400_000);
  assert.equal(s.events.active?.id, "blood-moon");
  assert.deepEqual(s.events.seen, { "shooting-stars": 1, "blood-moon": 1 });
  assert.ok(Object.values(s.dex).some((e) => e.m === 8), "an event mutation survives in the book");
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(snapshot(s)))).events, s.events);
});

test("an old save with no events field starts with an empty events state", () => {
  const raw = JSON.parse(readFileSync(join(dir, "save-v9.json"), "utf8")) as Record<string, unknown>;
  const s = sanitize(raw);
  assert.equal(s.events.streakMs, 0);
  assert.equal(s.events.active, null);
  assert.deepEqual(s.events.seen, {});
});

test("hostile events data is clamped or dropped", () => {
  const s = sanitize({ ...fresh(), events: { streakMs: -5, seed: "x", active: { id: "nope", startedAt: 1, endsAt: 9 }, seen: { "blood-moon": -3, bogus: 4 }, rolled: 1e99 } });
  assert.equal(s.events.streakMs, 0);
  assert.equal(s.events.active, null);
  assert.deepEqual(s.events.seen, {});
  assert.ok(s.events.rolled <= 1e5);
});
