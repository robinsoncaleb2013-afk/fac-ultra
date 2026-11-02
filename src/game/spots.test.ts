import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES } from "./content.ts";
import {
  biomeStructures,
  defaultSpot,
  nearestSpot,
  resolveSpot,
  SPOT_COUNT,
  SPOTS,
  spotById,
  spotRadiusPx,
  spotRingPx,
} from "./spots.ts";
import { waterLineOf } from "./water.ts";

test("there are 75 spots: five on each of the 15 waters", () => {
  assert.equal(SPOTS.length, 15);
  assert.equal(SPOT_COUNT, 75);
  for (const list of SPOTS) assert.equal(list.length, 5);
});

test("ids are unique and begin with the water they belong to", () => {
  const seen = new Set<string>();
  SPOTS.forEach((list, b) => {
    for (const s of list) {
      assert.ok(!seen.has(s.id), `duplicate id ${s.id}`);
      seen.add(s.id);
      assert.ok(s.id.startsWith(BIOMES[b].id + "-"), `${s.id} should start with ${BIOMES[b].id}-`);
    }
  });
});

test("names and tips are present, short and unique within a water", () => {
  for (const list of SPOTS) {
    const names = new Set<string>();
    for (const s of list) {
      assert.ok(s.name.length >= 3 && s.name.length <= 28, s.name);
      assert.ok(!names.has(s.name), `duplicate name ${s.name}`);
      names.add(s.name);
      assert.ok(s.tip.length >= 10 && s.tip.length <= 90, `${s.id} tip length ${s.tip.length}`);
      assert.ok(/[.!?]$/.test(s.tip), `${s.id} tip should end like a sentence`);
    }
  }
});

test("every spot lies on the painting, below the waterline, with a tap radius of 6–10% of the width", () => {
  SPOTS.forEach((list, b) => {
    for (const s of list) {
      assert.ok(s.x > 0.04 && s.x < 0.96, `${s.id} x ${s.x}`);
      assert.ok(
        s.y > waterLineOf(b) + 0.02 && s.y <= 0.88,
        `${s.id} y ${s.y} vs waterline ${waterLineOf(b)}`,
      );
      assert.ok(s.r >= 0.06 && s.r <= 0.1, `${s.id} r ${s.r}`);
    }
  });
});

test("each water has all three depths and at least three structures", () => {
  SPOTS.forEach((list, b) => {
    assert.deepEqual(
      [...new Set(list.map((s) => s.depth))].sort(),
      [0, 1, 2],
      `${BIOMES[b].name} depths`,
    );
    assert.ok(biomeStructures(b).length >= 3, `${BIOMES[b].name} structures`);
  });
});

test("each water has exactly one open-water spot and it is the default", () => {
  SPOTS.forEach((list, b) => {
    const open = list.filter((s) => s.structure === "open");
    assert.equal(open.length, 1, BIOMES[b].name);
    assert.equal(defaultSpot(b).id, open[0].id);
  });
});

test("the fantasy waters use the fantasy structures", () => {
  const all = (b: number) => biomeStructures(b);
  assert.ok(all(13).includes("cloud"));
  assert.ok(all(14).includes("void"));
  assert.ok(all(14).includes("vent") || all(10).includes("vent"));
});

test("spots in one water never sit on top of each other", () => {
  SPOTS.forEach((list) => {
    for (let a = 0; a < list.length; a++)
      for (let c = a + 1; c < list.length; c++) {
        const d = Math.hypot(list[a].x - list[c].x, (list[a].y - list[c].y) * (9 / 16));
        assert.ok(d >= 0.09, `${list[a].id} and ${list[c].id} are ${d.toFixed(3)} apart`);
      }
  });
});

test("the Pond matches the spec's reference positions", () => {
  assert.deepEqual([spotById(0, "pond-pads")!.x, spotById(0, "pond-pads")!.y], [0.52, 0.76]);
  assert.deepEqual([spotById(0, "pond-dock")!.x, spotById(0, "pond-dock")!.y], [0.8, 0.7]);
  assert.deepEqual([defaultSpot(0).x, defaultSpot(0).y], [0.3, 0.66]);
});

test("resolveSpot falls back to the default for an unknown id", () => {
  assert.equal(resolveSpot(0, "nope").id, "pond-open");
  assert.equal(resolveSpot(0, undefined).id, "pond-open");
  assert.equal(resolveSpot(0, "pond-pads").id, "pond-pads");
  assert.equal(
    resolveSpot(0, "river-run").id,
    "pond-open",
    "an id from another water is not valid here",
  );
});

test("touch rings are at least 44 px across; the tap area is never smaller than the ring", () => {
  for (const list of SPOTS)
    for (const s of list)
      for (const w of [320, 390, 844, 1440]) {
        assert.ok(spotRingPx(s, w, true) * 2 >= 44, `${s.id} ring at ${w}`);
        assert.ok(spotRadiusPx(s, w, true) * 2 >= 44);
        assert.ok(spotRadiusPx(s, w, true) >= spotRingPx(s, w, true));
      }
});

test("nearestSpot finds the spot under the pointer, the closest when areas overlap, or null", () => {
  const pads = spotById(0, "pond-pads")!;
  assert.equal(nearestSpot(0, pads.x, pads.y, 1440, 900, false)?.id, "pond-pads");
  assert.equal(nearestSpot(0, pads.x + 0.01, pads.y, 1440, 900, false)?.id, "pond-pads");
  assert.equal(nearestSpot(0, 0.02, 0.02, 1440, 900, false), null, "sky is not a spot");
  /* On a phone, 5 px off a spot still counts; 80 px away does not. */
  const w = 390;
  const h = 330;
  assert.equal(nearestSpot(0, pads.x + 5 / w, pads.y, w, h, true)?.id, "pond-pads");
  assert.equal(
    nearestSpot(0, pads.x + 0.4, pads.y, w, h, true) === null ||
      nearestSpot(0, pads.x + 0.4, pads.y, w, h, true)?.id !== "pond-pads",
    true,
  );
});

test("on every water, tapping exactly on a spot always picks that spot", () => {
  SPOTS.forEach((list, b) => {
    for (const s of list) {
      for (const [w, h, touch] of [
        [1440, 900, false],
        [390, 330, true],
      ] as const)
        assert.equal(nearestSpot(b, s.x, s.y, w, h, touch)?.id, s.id, `${s.id} at ${w}`);
    }
  });
});
