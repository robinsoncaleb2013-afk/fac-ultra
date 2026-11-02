import assert from "node:assert/strict";
import { test } from "node:test";
import { MODES } from "./modes.ts";
import { allSyncIds, cardFromRaw, clampSlot, defaultSlotName, firstFree, hasSlots, MAX_SLOTS, modeOfSyncId, parseSyncId, readActiveSlots, slotCards, slotCount, slotKey, slotName, syncId } from "./slots.ts";
import { isSyncMode, keyOfSyncId, SYNC_MODES } from "./cloud.ts";
import { keysToWipe } from "../lib/test-phase.ts";

test("three slots for Expedition and Story, one for everything else, from a single constant", () => {
  assert.equal(MAX_SLOTS, 3);
  assert.equal(slotCount("expedition"), 3);
  assert.equal(slotCount("story"), 3);
  for (const m of ["recreational", "survival", "coop", "tournament"] as const) assert.equal(slotCount(m), 1, m);
  assert.ok(hasSlots("expedition") && !hasSlots("survival"));
});

test("slot one keeps the key every player already has; the others are new keys that never collide", () => {
  assert.equal(slotKey("expedition", 0), "fac-ultra");
  assert.equal(slotKey("expedition", 1), "fac-ultra-s1");
  assert.equal(slotKey("expedition", 2), "fac-ultra-s2");
  assert.equal(slotKey("story", 0), "fac-ultra-story");
  assert.equal(slotKey("story", 2), "fac-ultra-story-s2");
  assert.equal(slotKey("recreational", 2), MODES.recreational.saveKey, "a mode without slots ignores the number");
  const all = ["expedition", "story", "recreational", "survival", "coop", "tournament"].flatMap((m) =>
    Array.from({ length: slotCount(m as "expedition") }, (_, s) => slotKey(m as "expedition", s)),
  );
  assert.equal(new Set(all).size, all.length);
  assert.equal(clampSlot("expedition", 9), 2);
  assert.equal(clampSlot("expedition", -1), 0);
});

test("cloud ids: every slot has its own, they parse back, and the server only accepts real ones", () => {
  assert.equal(syncId("expedition", 0), "expedition");
  assert.equal(syncId("expedition", 1), "expedition-s1");
  assert.deepEqual(parseSyncId("story-s2"), { mode: "story", slot: 2 });
  assert.equal(parseSyncId("story-s3"), null);
  assert.equal(parseSyncId("recreational-s1"), null);
  assert.equal(parseSyncId("expedition-s0"), null);
  assert.equal(parseSyncId("tournament"), null, "tournaments stay on the tournament server");
  assert.equal(parseSyncId("'; drop table saves;--"), null);
  assert.equal(modeOfSyncId("expedition-s1"), "expedition");
  const ids = allSyncIds();
  assert.equal(ids.length, 3 + 3 + 3, "3 + 3 slots and recreational, survival, coop");
  assert.deepEqual([...SYNC_MODES], ids);
  for (const id of ids) {
    assert.ok(isSyncMode(id));
    const p = parseSyncId(id)!;
    assert.equal(keyOfSyncId(id), slotKey(p.mode, p.slot));
    assert.equal(syncId(p.mode, p.slot), id);
  }
  assert.equal(isSyncMode("tournament"), false);
});

test("a slot card reads a raw save lightly; a blank or never-played save counts as empty", () => {
  assert.equal(cardFromRaw("expedition", 1, null).empty, true);
  assert.equal(cardFromRaw("expedition", 1, "junk").empty, true);
  assert.equal(cardFromRaw("expedition", 1, { lv: 1, c: 50, caught: 0, tot: 0, dex: {} }).empty, true, "a blank save the game wrote itself");
  const card = cardFromRaw("expedition", 0, { slotName: "Grandpa", difficulty: "hardest", lv: 7, caught: 40, c: 900, dex: { "0-0": { c: 3 }, "0-1": { c: 0 } } });
  assert.deepEqual([card.empty, card.name, card.difficulty, card.lv, card.species, card.caught], [false, "Grandpa", "hardest", 7, 1, 40]);
  assert.equal(cardFromRaw("expedition", 0, { created: 5 }).empty, false, "made on purpose, so it is taken");
  assert.equal(cardFromRaw("expedition", 0, { caught: 3, difficulty: "weird" }).difficulty, "normal");
  assert.equal(cardFromRaw("story", 2, { caught: 1, story: { chapter: 4 } }).chapter, 4);
  const mem = new Map([[slotKey("story", 1), JSON.stringify({ created: 1, slotName: "Tale" })]]);
  const cards = slotCards("story", (k) => mem.get(k) ?? null);
  assert.deepEqual(cards.map((c) => c.empty), [true, false, true]);
  assert.equal(firstFree(cards), 0);
  assert.equal(firstFree(cards.map((c) => ({ ...c, empty: false }))), -1);
});

test("slot names are kind, short, and fall back to a default", () => {
  assert.equal(slotName("  River   Run ", "expedition", 0), "River Run");
  assert.equal(slotName("", "expedition", 1), defaultSlotName("expedition", 1));
  assert.equal(slotName("x".repeat(60), "story", 0).length, 20);
  assert.equal(slotName("me@mail.com", "story", 2), "Story 3", "contact details are never kept in a name");
  assert.equal(defaultSlotName("story", 0), "Story 1");
});

test("the open slot per mode is read safely", () => {
  assert.deepEqual(readActiveSlots('{"expedition":2,"story":9}'), { expedition: 2, story: 2 });
  assert.deepEqual(readActiveSlots("not json"), {});
  assert.deepEqual(readActiveSlots(null), { expedition: 0, story: 0 });
});

test("test-phase reset wipes every slot, the slot pointer and the Kids/Story keys, but keeps device settings", () => {
  const keys = [
    ...["expedition", "story"].flatMap((m) => [0, 1, 2].flatMap((s) => [slotKey(m as "expedition", s), slotKey(m as "expedition", s) + "-bak"])),
    "fac-ultra-slots",
    "fac-ultra-last-mode",
    "fac-cloud",
    "fac-ultra-device",
    "fac-ultra-fs-landscape",
  ];
  const wipe = keysToWipe(keys);
  for (const k of keys) {
    if (k === "fac-ultra-device" || k === "fac-ultra-fs-landscape") assert.ok(!wipe.includes(k), `${k} is kept`);
    else assert.ok(wipe.includes(k), `${k} is wiped`);
  }
});
