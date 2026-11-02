import assert from "node:assert/strict";
import test from "node:test";
import { runEpochGate, type KeyStore } from "./epoch-gate.ts";
import { decideEpoch, keysToWipe, KEEP_KEYS, KEEP_TABLES, WIPE_TABLES, parseSwitch } from "../lib/test-phase.ts";

function memStore(init: Record<string, string> = {}): KeyStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const OLD_DEVICE = {
  "fac-ultra-epoch": "old",
  "fac-ultra": '{"c":5}',
  "fac-ultra-bak": "{}",
  "fac-ultra-sandbox": "{}",
  "fac-ultra-survival": "{}",
  "fac-ultra-coop": "{}",
  "fac-ultra-tourney": "{}",
  "facultra": "{}",
  "fac-ultra-who": "1",
  "fac-ultra-last-mode": "expedition",
  "fac-cloud": '{"v":1}',
  "fac-cloud-backups": "[]",
  "fac-tourney-queue:q-1": "[]",
  "fac-ultra-device": '{"gfx":"low","kid":true,"cb":true,"volume":30}',
  "fac-ultra-fs-landscape": "0",
  "fac-ultra-blocked-names": '["x"]',
  "fac-player-id": "abcdefgh-1234",
  "fac-player-name": "Casey",
  "other-site-thing": "keep me",
};

test("decision table", () => {
  assert.equal(decideEpoch(null, "b", true), "first");
  assert.equal(decideEpoch("a", "a", true), "same");
  assert.equal(decideEpoch("a", "b", true), "reset");
  assert.equal(decideEpoch("a", "b", false), "off");
  assert.equal(decideEpoch(null, "b", false), "off");
});

test("switch words", () => {
  assert.equal(parseSwitch("0"), false);
  assert.equal(parseSwitch("1"), true);
  assert.equal(parseSwitch(undefined), null);
});

test("old epoch: saves and sync state go, device settings and identity stay, notice is flagged", () => {
  const s = memStore(OLD_DEVICE);
  const r = runEpochGate(s, "new", true);
  assert.equal(r.verdict, "reset");
  assert.equal(r.notice, true);
  for (const k of ["fac-ultra", "fac-ultra-bak", "fac-ultra-sandbox", "fac-ultra-survival", "fac-ultra-coop", "fac-ultra-tourney", "facultra", "fac-ultra-who", "fac-ultra-last-mode", "fac-cloud", "fac-cloud-backups", "fac-tourney-queue:q-1"]) {
    assert.equal(s.data.has(k), false, `${k} should be gone`);
  }
  for (const k of ["fac-ultra-device", "fac-ultra-fs-landscape", "fac-ultra-blocked-names", "fac-player-id", "fac-player-name", "other-site-thing"]) {
    assert.equal(s.data.has(k), true, `${k} should stay`);
  }
  assert.equal(s.getItem("fac-ultra-epoch"), "new");
  assert.equal(s.getItem("fac-ultra-epoch-notice"), "1");
  assert.equal(s.getItem("fac-ultra-device"), OLD_DEVICE["fac-ultra-device"]);
});

test("same epoch: nothing changes", () => {
  const s = memStore({ ...OLD_DEVICE, "fac-ultra-epoch": "new" });
  const before = JSON.stringify([...s.data]);
  const r = runEpochGate(s, "new", true);
  assert.equal(r.verdict, "same");
  assert.equal(r.notice, false);
  assert.equal(JSON.stringify([...s.data]), before);
});

test("first visit (no stored epoch): remember it, wipe nothing, no notice", () => {
  const { "fac-ultra-epoch": _e, ...rest } = OLD_DEVICE;
  void _e;
  const s = memStore(rest);
  const r = runEpochGate(s, "new", true);
  assert.equal(r.verdict, "first");
  assert.equal(r.notice, false);
  assert.equal(s.getItem("fac-ultra-epoch"), "new");
  assert.equal(s.getItem("fac-ultra"), '{"c":5}');
  assert.equal(s.getItem("fac-ultra-epoch-notice"), null);
});

test("switch OFF: nothing happens, the stored epoch is left alone", () => {
  const s = memStore(OLD_DEVICE);
  const before = JSON.stringify([...s.data]);
  const r = runEpochGate(s, "new", false);
  assert.equal(r.verdict, "off");
  assert.equal(JSON.stringify([...s.data]), before);
});

test("running the gate twice is the same as once (no second notice, nothing more removed)", () => {
  const s = memStore(OLD_DEVICE);
  runEpochGate(s, "new", true);
  const r2 = runEpochGate(s, "new", true);
  assert.equal(r2.verdict, "same");
  assert.equal(r2.removed.length, 0);
});

test("a blocked storage never throws", () => {
  const broken: KeyStore = {
    length: 0,
    key: () => null,
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {},
  };
  assert.equal(runEpochGate(broken, "new", true).verdict, "off");
});

test("keysToWipe never lists a kept key, and every kept key looks like ours", () => {
  const wipe = keysToWipe([...KEEP_KEYS, "fac-ultra", "fac-cloud"]);
  assert.deepEqual(wipe, ["fac-ultra", "fac-cloud"]);
});

test("server lists do not overlap", () => {
  for (const t of WIPE_TABLES) assert.equal(KEEP_TABLES.includes(t), false, t);
});

test("every game mode's save slot is wiped (not on the keep list)", async () => {
  const { MODE_KEYS } = await import("./modes.ts");
  for (const k of Object.values(MODE_KEYS)) {
    assert.equal(KEEP_KEYS.includes(k), false, k);
    assert.deepEqual(keysToWipe([k, k + "-bak"]), [k, k + "-bak"]);
  }
});
