import assert from "node:assert/strict";
import { test } from "node:test";
import { BAITS, LURES, SIG_LURES } from "./content.ts";
import {
  BAIT_FAMILY,
  DEFAULT_RIG,
  FAMILIES,
  familyOf,
  familyOfLure,
  presentationOf,
  readRig,
  rigLabel,
} from "./presentation.ts";

test("every one of the 50 lures, 4 baits and 24 signature lures has a family", () => {
  assert.equal(LURES.length, 50);
  for (const l of LURES) assert.ok(FAMILIES.includes(l.family), l.name);
  for (const b of BAITS) assert.ok(FAMILIES.includes(b.family), b.name);
  assert.equal(SIG_LURES.length, 24);
  for (const s of SIG_LURES) assert.ok(FAMILIES.includes(s.family), s.name);
});

test("lures take the family of their type", () => {
  const byName = (type: string) => LURES.findIndex((l) => l.name.endsWith(type));
  assert.equal(LURES[byName("Crankbait")].family, "crank");
  assert.equal(LURES[byName("Worm")].family, "worm");
  assert.equal(LURES[byName("Spoon")].family, "spoon");
  assert.equal(LURES[byName("Fly")].family, "fly");
  assert.equal(LURES[byName("Squid Rig")].family, "squid");
  assert.equal(familyOfLure(byName("Frog")), "topwater");
  assert.equal(familyOfLure(999), null);
});

test("all twelve families can actually be put on the line", () => {
  const reachable = new Set<string>([
    ...LURES.map((l) => l.family),
    ...BAITS.map((b) => b.family),
    ...SIG_LURES.map((s) => s.family),
  ]);
  for (const f of FAMILIES) assert.ok(reachable.has(f), `${f} is not reachable`);
});

test("baits carry the families the spec names", () => {
  assert.equal(BAITS[0].family, "dough");
  assert.equal(BAITS[1].family, "glow");
  assert.equal(BAITS[2].family, "cut");
  assert.equal(BAITS[3].family, "cut");
  assert.deepEqual([...BAIT_FAMILY], ["dough", "glow", "cut", "cut"]);
});

test("the family comes from bait first, then the signature lure, then the lure, then a plain worm", () => {
  const spoon = LURES.findIndex((l) => l.family === "spoon");
  assert.equal(familyOf({ lure: spoon, sig: 0, bait: 0 }), "dough");
  assert.equal(familyOf({ lure: spoon, sig: 6, bait: -1 }), SIG_LURES[6].family);
  assert.equal(familyOf({ lure: spoon, sig: -1, bait: -1 }), "spoon");
  assert.equal(familyOf({ lure: -1, sig: -1, bait: -1 }), "worm");
});

test("presentationOf joins the family with the rig", () => {
  assert.deepEqual(presentationOf({ lure: -1, sig: -1, bait: 1 }, { depth: 2, retrieve: "slow" }), {
    family: "glow",
    depth: 2,
    retrieve: "slow",
  });
});

test("readRig keeps good values and repairs bad ones field by field", () => {
  assert.deepEqual(readRig({ depth: 2, retrieve: "fast" }), { depth: 2, retrieve: "fast" });
  assert.deepEqual(readRig({ depth: 7, retrieve: "fast" }), {
    depth: DEFAULT_RIG.depth,
    retrieve: "fast",
  });
  assert.deepEqual(readRig({ depth: 0, retrieve: "warp" }), {
    depth: 0,
    retrieve: DEFAULT_RIG.retrieve,
  });
  assert.deepEqual(readRig(null), DEFAULT_RIG);
  assert.deepEqual(readRig("x"), DEFAULT_RIG);
  assert.equal(rigLabel({ depth: 1, retrieve: "slow" }), "Middle · Slow");
});
