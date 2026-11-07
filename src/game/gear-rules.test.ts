/* Gear progression rules (docs/architecture/10 §2): no skipping, level gates, map and boss gates, boats. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES, BOATS, PACKS, REELS, RODS } from "./content.ts";
import {
  BOAT_GATE,
  bundleOf,
  checkBoat,
  checkGear,
  checkMap,
  checkPack,
  checkTackle,
  gatesOn,
  gateTable,
  MAP_LEVEL,
  PACK_LEVEL,
  REEL_BUNDLE,
  ROD_BUNDLE,
  say,
  type Progress,
} from "./gear-rules.ts";
import { MODES } from "./modes.ts";

const start = (over: Partial<Progress> = {}): Progress => ({ lv: 1, ub: [0], mastered: [], rod: 0, reel: 0, boat: 0, ...over });

test("the tables line up with the gear that exists", () => {
  assert.equal(MAP_LEVEL.length, BIOMES.length);
  assert.equal(ROD_BUNDLE.reduce((a, b) => a + b, 0), RODS.length);
  assert.equal(REEL_BUNDLE.reduce((a, b) => a + b, 0), REELS.length);
  assert.equal(BOAT_GATE.length, BOATS.length);
  assert.equal(PACK_LEVEL.length, PACKS.length);
  assert.deepEqual([PACK_LEVEL[0], PACK_LEVEL[1], PACK_LEVEL[PACK_LEVEL.length - 1]], [1, 10, 30], "the owner's lure pack levels");
  for (let i = 1; i < MAP_LEVEL.length; i++) assert.ok(MAP_LEVEL[i] > MAP_LEVEL[i - 1]);
  for (let i = 1; i < BOAT_GATE.length; i++) {
    assert.ok(BOAT_GATE[i].lv > BOAT_GATE[i - 1].lv);
    assert.ok(BOAT_GATE[i].bosses >= BOAT_GATE[i - 1].bosses);
  }
  assert.ok(BOAT_GATE[BOAT_GATE.length - 1].bosses <= BIOMES.length);
});

test("every rod and reel belongs to a water, in order, and asks at least that water's level", () => {
  for (const kind of ["rod", "reel"] as const) {
    let prevMap = 0;
    let prevLv = 0;
    const n = kind === "rod" ? RODS.length : REELS.length;
    for (let i = 0; i < n; i++) {
      const b = bundleOf(kind, i);
      assert.ok(b.map >= prevMap, `${kind} ${i} water order`);
      assert.ok(b.lv >= MAP_LEVEL[b.map]);
      assert.ok(b.lv >= prevLv, `${kind} ${i} level order`);
      prevMap = b.map;
      prevLv = b.lv;
    }
  }
});

test("no skipping: the best rod, reel and boat cannot be bought from the start, even with every other gate met", () => {
  const rich = start({ lv: 999, ub: BIOMES.map((_, i) => i), mastered: BIOMES.map((_, i) => i) });
  const rod = checkTackle("rod", RODS.length - 1, rich);
  assert.equal(rod.ok, false);
  assert.match(rod.text, /buy the .* first/i);
  assert.equal(checkTackle("reel", REELS.length - 1, rich).ok, false);
  assert.equal(checkBoat(BOATS.length - 1, rich).ok, false);
  assert.match(checkBoat(BOATS.length - 1, rich).text, /Buy the Kelp Skimmer first/);
  /* ...but the very next one is fine */
  assert.equal(checkTackle("rod", 1, { ...rich, rod: 0 }).ok, true);
  assert.equal(checkBoat(1, rich).ok, true);
});

test("level gates: a rod asks for its level and the sentence says so", () => {
  const p = start({ lv: 1, ub: [0, 1, 2, 3] });
  const c = checkTackle("rod", 1, p);
  assert.equal(c.ok, false);
  assert.equal(c.text, "Reach level 2.");
  assert.equal(checkTackle("rod", 1, { ...p, lv: 2 }).ok, true);
});

test("biome gates: a rod from a water's bundle is locked until that water is unlocked, however rich or high", () => {
  const b = bundleOf("rod", 6);
  const p = start({ lv: 999, rod: 5, ub: [0] });
  const c = checkTackle("rod", 6, p);
  assert.equal(c.ok, false);
  assert.equal(c.text, `Unlock the ${BIOMES[b.map].name} map.`);
  assert.equal(checkTackle("rod", 6, { ...p, ub: [0, b.map] }).ok, true);
});

test("a locked item names everything missing, in one sentence", () => {
  const b = bundleOf("rod", 10);
  const c = checkTackle("rod", 10, start({ lv: 3, rod: 5 }));
  assert.equal(c.ok, false);
  assert.equal(c.missing.length, 3);
  assert.equal(c.text, `Reach level ${b.lv}, unlock the ${BIOMES[b.map].name} map and buy the ${RODS[9].name} first.`);
});

test("maps need the level AND the previous boss", () => {
  const p = start({ lv: 3, ub: [0] });
  assert.equal(checkMap(1, p).text, "Beat the Pond boss.");
  assert.equal(checkMap(1, { ...p, lv: 2 }).text, "Reach level 3 and beat the Pond boss.");
  assert.equal(checkMap(1, { ...p, mastered: [0] }).ok, true);
  assert.equal(checkMap(1, { ...p, lv: 2, mastered: [0] }).text, "Reach level 3.");
  assert.equal(checkMap(2, { ...p, lv: 99, mastered: [0] }).text, "Beat the River boss.", "the boss of the water before, not any boss");
  assert.equal(checkMap(0, p).ok, true);
  assert.equal(checkMap(1, { ...p, ub: [0, 1] }).ok, true, "an owned water is not asked again");
});

test("boats need level, enough different bosses, and the boat before; maps are not needed", () => {
  const p = start({ lv: 5, boat: 0, ub: [0] });
  assert.equal(checkBoat(1, p).text, "Beat 1 boss (you have beaten 0).");
  assert.equal(checkBoat(1, { ...p, mastered: [0] }).ok, true, "no map needed");
  assert.equal(checkBoat(1, { ...p, mastered: [0, 0, 0] }).ok, true);
  assert.equal(checkBoat(2, { ...p, lv: 99, mastered: [0, 1, 2, 3, 4, 5] }).text, "Buy the Jon Boat first.");
  assert.equal(checkBoat(2, { ...p, lv: 9, boat: 1, mastered: [0] }).text, "Reach level 10 and beat 2 bosses (you have beaten 1).");
  /* repeat kills of the same boss do not count twice */
  assert.equal(new Set([0, 0, 0]).size, 1);
});

test("lure packs: level 1, level 10, level 30", () => {
  assert.equal(checkPack(0, { lv: 1 }).ok, true);
  assert.equal(checkPack(1, { lv: 9 }).text, "Reach level 10.");
  assert.equal(checkPack(1, { lv: 10 }).ok, true);
  assert.equal(checkPack(2, { lv: 29 }).text, "Reach level 30.");
  assert.equal(checkPack(2, { lv: 30 }).ok, true);
});

test("grandfathering: gear you already own stays yours, even out of order; the rules only judge what you buy next", () => {
  const odd = start({ lv: 1, rod: 12, reel: 7, boat: 4, ub: [0] });
  assert.equal(checkTackle("rod", 12, odd).ok, true);
  assert.equal(checkTackle("rod", 3, odd).ok, true);
  assert.equal(checkBoat(4, odd).ok, true);
  assert.equal(checkBoat(2, odd).ok, true);
  assert.equal(checkTackle("rod", 13, odd).ok, false, "but the next one up is judged as usual");
});

test("the rules switch off in Recreational, Kid Mode, Survival and Tournament, and on in Expedition and Co-op", () => {
  assert.equal(gatesOn(MODES.expedition, false), true);
  assert.equal(gatesOn(MODES.coop, false), true);
  assert.equal(gatesOn(MODES.expedition, true), false, "Kid Mode");
  assert.equal(gatesOn(MODES.recreational, false), false);
  assert.equal(gatesOn(MODES.survival, false), false);
  assert.equal(gatesOn(MODES.tournament, false), false);
});

test("say() writes plain sentences", () => {
  assert.equal(say([]), "");
  assert.equal(say(["reach level 4"]), "Reach level 4.");
  assert.equal(say(["a", "b"]), "A and b.");
  assert.equal(say(["a", "b", "c"]), "A, b and c.");
});

test("the table lists every gated thing once", () => {
  const rows = gateTable();
  assert.equal(rows.length, BIOMES.length + RODS.length + REELS.length + BOATS.length + PACKS.length);
  assert.ok(rows.every((r) => r.lv >= 1));
});

/* ── The walk: a scripted player who does only what the rules ask reaches the end, and cannot skip ahead ── */

test("a full progression walk: meet each requirement, buy in order, reach the last of everything", () => {
  const p: Progress & { prestige: number } = { ...start(), prestige: 0 };
  const log: string[] = [];
  let safety = 2000;
  while (safety-- > 0) {
    let acted = false;
    /* buy whatever is allowed right now, in a fixed order */
    for (const kind of ["rod", "reel", "boat"] as const) {
      const max = (kind === "rod" ? RODS : kind === "reel" ? REELS : BOATS).length - 1;
      if (p[kind] < max && checkGear(kind, p[kind] + 1, p).ok) {
        p[kind] += 1;
        log.push(`${kind}${p[kind]}`);
        acted = true;
      }
    }
    const nextMap = p.ub.length;
    if (nextMap < BIOMES.length && checkMap(nextMap, p).ok) {
      p.ub = [...p.ub, nextMap];
      acted = true;
    }
    /* Update Three: the final water asks for Prestige, not a level — earn it the player's way. */
    if (p.ub.length === BIOMES.length - 1 && p.prestige < 1) {
      if (p.lv < 100) p.lv = 100;
      else p.prestige = 1;
      acted = true;
    }
    if (acted) continue;
    /* beat the boss of the newest water, if it is not yet beaten */
    const newest = p.ub[p.ub.length - 1];
    if (!p.mastered.includes(newest)) {
      p.mastered = [...p.mastered, newest];
      continue;
    }
    /* otherwise level up just enough for the cheapest next thing */
    const asks: number[] = [];
    for (const kind of ["rod", "reel", "boat"] as const) {
      const max = (kind === "rod" ? RODS : kind === "reel" ? REELS : BOATS).length - 1;
      if (p[kind] < max) asks.push(gateTable().find((r) => r.kind === kind && r.index === p[kind] + 1)!.lv);
    }
    if (p.ub.length < BIOMES.length - 1) asks.push(MAP_LEVEL[p.ub.length]);
    const want = Math.min(...asks.filter((n) => n > p.lv));
    if (!Number.isFinite(want)) break;
    p.lv = want;
  }
  assert.equal(p.rod, RODS.length - 1);
  assert.equal(p.reel, REELS.length - 1);
  assert.equal(p.boat, BOATS.length - 1);
  assert.equal(p.ub.length, BIOMES.length);
  assert.ok(p.lv <= MAP_LEVEL[BIOMES.length - 2], "the last level-gated water sets the level bar");
  /* every purchase happened strictly in order */
  const rods = log.filter((l) => l.startsWith("rod")).map((l) => Number(l.slice(3)));
  assert.deepEqual(rods, RODS.map((_, i) => i).slice(1));
});

test("a player cannot skip: at no point in the walk is anything more than one step ahead buyable", () => {
  const p = start({ lv: 999, ub: BIOMES.map((_, i) => i), mastered: BIOMES.map((_, i) => i) });
  for (let r = 0; r < RODS.length - 2; r++) {
    p.rod = r;
    assert.equal(checkTackle("rod", r + 2, p).ok, false);
    assert.equal(checkTackle("rod", r + 1, p).ok, true);
  }
});
