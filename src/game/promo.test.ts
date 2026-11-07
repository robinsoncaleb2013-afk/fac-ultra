/* Promo codes (Update Three): the two codes and their exact rewards, the common event the
   first code starts, one claim per save, and forgiving typing (case and spaces). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { BAITS, LURES } from "./content.ts";
import { EVENT_RARITIES } from "./event-data.ts";
import { fresh, type Save } from "./engine.ts";
import { activeEvent, eventById } from "./events.ts";
import { glowWormIndex, normalizeCode, PROMO_CODES, promoEvent, redeemCode } from "./promo.ts";

const NOW = 1_800_000_000_000;

/** A played-a-little save with known numbers, so every reward is an exact delta. */
function played(): Save {
  const s = fresh();
  return { ...s, c: 120, baitBox: { [String(glowWormIndex())]: 2 } };
}

const worms = (s: Save) => s.baitBox[String(glowWormIndex())] ?? 0;

test("the Glow Worm index really points at the bait named Glow Worm", () => {
  const i = glowWormIndex();
  assert.ok(i >= 0, "there is a Glow Worm");
  assert.equal(BAITS[i].name, "Glow Worm");
  assert.equal(BAITS[1].name, "Glow Worm", "it is the second bait today");
  /* It is bait, never a lure: no generated lure carries the name, so `box` can never hold one. */
  assert.equal(LURES.findIndex((l) => l.name === "Glow Worm"), -1);
});

test("there are exactly two promo codes, with the rewards Update Three promises", () => {
  assert.deepEqual(
    PROMO_CODES.map((d) => [d.code, d.gold, d.glowWorms, d.startsEvent]),
    [
      ["FACFIRSTCODE", 500, 5, true],
      ["UPD3", 500, 10, false],
    ],
  );
});

test("FACFIRSTCODE pays 500 gold and 5 Glow Worms, and records the claim", () => {
  const before = played();
  const r = redeemCode(before, "FACFIRSTCODE", NOW);
  assert.equal(r.ok, true);
  assert.equal(r.s.c, before.c + 500);
  assert.equal(worms(r.s), worms(before) + 5);
  assert.deepEqual(r.s.promo, ["FACFIRSTCODE"]);
  assert.equal(r.message, "You got 500 gold and 5 Glow Worms. A common event has started!");
  /* Pure: the save handed in is untouched. */
  assert.equal(before.c, 120);
  assert.equal(worms(before), 2);
  assert.deepEqual(before.promo, []);
  assert.equal(before.events.active, null);
});

test("UPD3 pays 500 gold and 10 Glow Worms, and starts no event", () => {
  const before = played();
  const r = redeemCode(before, "UPD3", NOW);
  assert.equal(r.ok, true);
  assert.equal(r.s.c, before.c + 500);
  assert.equal(worms(r.s), worms(before) + 10);
  assert.deepEqual(r.s.promo, ["UPD3"]);
  assert.equal(r.s.events.active, null);
  assert.equal(r.message, "You got 500 gold and 10 Glow Worms.");
});

test("the worms land in the bait box slot, and nowhere else", () => {
  const r = redeemCode(played(), "UPD3", NOW);
  assert.equal(r.s.baitBox[String(glowWormIndex())], 12);
  assert.deepEqual(r.s.box, {}, "the lure box is not where bait goes");
});

test("FACFIRSTCODE leaves a common event running, started the way events start", () => {
  const r = redeemCode(played(), "FACFIRSTCODE", NOW);
  const active = r.s.events.active;
  assert.ok(active, "an event is active");
  const def = eventById(active.id)!;
  assert.equal(def.rarity, 0, "a common event (EVENT_RARITIES index 0)");
  assert.equal(def, promoEvent());
  assert.equal(active.startedAt, NOW);
  assert.equal(active.endsAt, NOW + EVENT_RARITIES[0].minutes * 60_000, "it lasts as long as a common event lasts");
  assert.equal(r.s.events.seen[def.id], 1, "the event counts as seen, like one the clock started");
  assert.equal(activeEvent(r.s.events, NOW)?.def, def, "events.ts agrees it is running");
  assert.equal(activeEvent(r.s.events, active.endsAt), null, "and it ends on time");
});

test("the promo event can always start: common, and no night or Astral Sea condition", () => {
  const def = promoEvent();
  assert.equal(EVENT_RARITIES[def.rarity].id, "common");
  assert.ok(!def.night && !def.astral);
});

test("claiming the same code twice is refused, with no second reward", () => {
  const first = redeemCode(played(), "FACFIRSTCODE", NOW);
  assert.equal(first.ok, true);
  const second = redeemCode(first.s, "FACFIRSTCODE", NOW + 60_000);
  assert.equal(second.ok, false);
  assert.equal(second.message, "You already claimed that code.");
  assert.equal(second.s, first.s, "the save comes back as it was");
  assert.equal(second.s.c, first.s.c);
  assert.equal(worms(second.s), worms(first.s));
  assert.deepEqual(second.s.promo, ["FACFIRSTCODE"]);
});

test("an unknown code is refused and changes nothing", () => {
  const before = played();
  for (const bad of ["FAC", "UPD4", "FACFIRSTCOD", "", "   ", "glow worm"]) {
    const r = redeemCode(before, bad, NOW);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.message, "That code does not work. Check the letters and try again.");
    assert.equal(r.s, before);
  }
  assert.equal(before.c, 120);
  assert.deepEqual(before.promo, []);
});

test("typing is forgiving: lower case and stray spaces still claim", () => {
  assert.equal(normalizeCode("  facfirstcode "), "FACFIRSTCODE");
  const a = redeemCode(played(), "  facfirstcode ", NOW);
  assert.equal(a.ok, true);
  assert.deepEqual(a.s.promo, ["FACFIRSTCODE"], "the claim is recorded in canonical upper-case");
  const b = redeemCode(played(), "upd3", NOW);
  assert.equal(b.ok, true);
  assert.deepEqual(b.s.promo, ["UPD3"]);
  /* ...and the tidy typing does not sneak a second claim past the record. */
  assert.equal(redeemCode(a.s, "FACFIRSTCODE", NOW).ok, false);
});

test("the two codes stack: claim both, in any order, for 1000 gold and 15 Glow Worms", () => {
  const start = played();
  const both = redeemCode(redeemCode(start, "UPD3", NOW).s, "FACFIRSTCODE", NOW).s;
  assert.equal(both.c, start.c + 1000);
  assert.equal(worms(both), worms(start) + 15);
  assert.deepEqual([...both.promo].sort(), ["FACFIRSTCODE", "UPD3"]);
  assert.ok(both.events.active, "the event code still started its event");
});

test("a code never replaces an event that is already running", () => {
  const def = promoEvent();
  const other = { id: "snowfall", startedAt: NOW - 60_000, endsAt: NOW + 60_000 };
  const before: Save = { ...played(), events: { ...played().events, active: other, seen: { snowfall: 1 } } };
  const r = redeemCode(before, "FACFIRSTCODE", NOW);
  assert.equal(r.ok, true);
  assert.equal(r.s.c, before.c + 500, "the gold and worms still pay out");
  assert.equal(worms(r.s), worms(before) + 5);
  assert.deepEqual(r.s.events.active, other, "the running event is left alone");
  assert.equal(r.s.events.seen[def.id] ?? 0, 0, "no second event was started");
  assert.match(r.message, /already running/);
  /* Once that event has ended, the next event code can start one again — shown with a fresh save whose event expired. */
  const expired: Save = { ...played(), events: { ...played().events, active: { id: "snowfall", startedAt: NOW - 9_000_000, endsAt: NOW - 1 } } };
  const r2 = redeemCode(expired, "FACFIRSTCODE", NOW);
  assert.equal(r2.s.events.active?.id, def.id);
});
