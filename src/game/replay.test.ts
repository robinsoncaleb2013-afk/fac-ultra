/* Replay verification (docs/architecture/06 §5): honest runs replay exactly, tampered runs do not. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES } from "./content.ts";
import { FIGHT_STEP, TAP_STEPS } from "./fight.ts";
import {
  castSeed,
  claimMatches,
  decentPlayer,
  eventLuck,
  fightInitOf,
  masher,
  parseEnvelope,
  recordCast,
  replayCast,
  rollCast,
  traceReason,
  type Choice,
  type Envelope,
  type ReplayEvent,
} from "./replay.ts";
import { rng } from "./rng.ts";
import { eventSeed } from "./schedule.ts";
import { spotsOf } from "./spots.ts";
import { FAMILIES, RETRIEVES, type Presentation } from "./presentation.ts";

const START = Date.UTC(2026, 10, 2, 12, 0, 0);
const ev = (water: number): ReplayEvent => ({ id: `d-test-${water}`, seed: eventSeed(`d-test-${water}`), water, startsAt: START });
const PLAYER = "player-aaaa-0001";

function choiceFor(water: number, n: number): Choice {
  const spots = spotsOf(water);
  const p: Presentation = {
    family: FAMILIES[(n * 5) % FAMILIES.length],
    depth: (n % 3) as 0 | 1 | 2,
    retrieve: RETRIEVES[n % RETRIEVES.length],
  };
  return { spot: spots[n % spots.length].id, p, drag: (n % 3) as 0 | 1 | 2, hookMs: 150 + (n % 9) * 110 };
}

test("a cast rolls the same fish for the same seed, every time", () => {
  const e = ev(3);
  const c = choiceFor(3, 4);
  const a = rollCast(e, PLAYER, 4, c.spot, c.p, START + 5000)!;
  const b = rollCast(e, PLAYER, 4, c.spot, c.p, START + 5000)!;
  assert.deepEqual(a, b);
  assert.ok(a.waitSec >= 0.7 && a.waitSec < 8);
  assert.equal(a.luck, eventLuck(a.weather));
  const other = rollCast(e, PLAYER, 5, c.spot, c.p, START + 5000)!;
  assert.notDeepEqual(a.fish, other.fish);
  const other2 = rollCast(e, "someone-else-0002", 4, c.spot, c.p, START + 5000)!;
  assert.notEqual(castSeed(e.id, PLAYER, 4), castSeed(e.id, "someone-else-0002", 4));
  assert.ok(other2);
});

test("rolling a cast leaves the shared random stream alone", () => {
  const before = rng;
  const e = ev(0);
  const c = choiceFor(0, 1);
  rollCast(e, PLAYER, 0, c.spot, c.p, START);
  assert.equal(rng, before);
});

test("an unknown spot cannot be cast to", () => {
  const e = ev(0);
  assert.equal(rollCast(e, PLAYER, 0, "nope", choiceFor(0, 0).p, START), null);
});

test("200 honest casts across all fifteen waters replay with a 100% match", () => {
  let landed = 0;
  let lost = 0;
  let missed = 0;
  for (let n = 0; n < 200; n++) {
    const water = n % BIOMES.length;
    const e = ev(water);
    const at = START + n * 7000;
    const choice = choiceFor(water, n);
    if (n % 11 === 0) choice.hookMs = -1; // some bites are missed
    const env = recordCast(e, PLAYER, n, at, choice, n % 7 === 3 ? () => false : n % 4 === 0 ? masher() : decentPlayer());
    const r = replayCast(e, PLAYER, env);
    assert.ok(r.ok, `cast ${n}: ${r.ok ? "" : r.reason}`);
    if (!r.ok) continue;
    assert.ok(claimMatches(env.claim, r), `cast ${n} claim`);
    assert.equal(r.outcome, env.claim.out);
    if (r.outcome === "landed") landed++;
    else if (r.outcome === "lost") lost++;
    else missed++;
    assert.ok(r.seconds > 0.7);
  }
  assert.ok(landed > 60, `landed ${landed}`);
  assert.ok(lost > 0 && missed > 0, `lost ${lost} missed ${missed}`);
});

test("the envelope survives JSON and parses back to the same thing", () => {
  const e = ev(2);
  const env = recordCast(e, PLAYER, 0, START + 1000, choiceFor(2, 3));
  const parsed = parseEnvelope(JSON.parse(JSON.stringify(env)));
  assert.ok(parsed.ok);
  if (parsed.ok) assert.deepEqual(parsed.env, env);
});

/** An honest landed cast to tamper with. */
function honest(): { e: ReplayEvent; env: Envelope } {
  const e = ev(1);
  for (let n = 0; n < 60; n++) {
    const env = recordCast(e, PLAYER, n, START + 2000 + n, choiceFor(1, n), decentPlayer());
    if (env.claim.out === "landed" && env.inputs.length >= 5) return { e, env };
  }
  throw new Error("no landed cast in 60 tries");
}

test("changing one input duration changes the replay, so the claim no longer matches", () => {
  const { e, env } = honest();
  let caught = 0;
  let tried = 0;
  for (let i = 1; i < env.inputs.length; i += 1) {
    const bad: Envelope = { ...env, inputs: env.inputs.map((n, k) => (k === i ? n + 7 : n)) };
    tried++;
    const r = replayCast(e, PLAYER, bad);
    if (!r.ok || !claimMatches(bad.claim, r)) caught++;
  }
  assert.ok(tried > 3);
  assert.equal(caught, tried, "every tampered trace is rejected");
});

test("trailing and missing steps are refused", () => {
  const { e, env } = honest();
  const longer = replayCast(e, PLAYER, { ...env, inputs: [...env.inputs, 3] });
  assert.ok(!longer.ok || !claimMatches(env.claim, longer));
  const shorter = replayCast(e, PLAYER, { ...env, inputs: env.inputs.slice(0, -1) });
  assert.ok(!shorter.ok || !claimMatches(env.claim, shorter));
});

test("a different spot, rig, drag or cast index makes the claim wrong", () => {
  const { e, env } = honest();
  const other = spotsOf(1).find((s) => s.id !== env.spot)!;
  const variants: Envelope[] = [
    { ...env, spot: other.id },
    { ...env, castIndex: env.castIndex + 1 },
    { ...env, drag: ((env.drag + 1) % 3) as 0 | 1 | 2 },
    { ...env, p: { ...env.p, family: FAMILIES[(FAMILIES.indexOf(env.p.family) + 1) % FAMILIES.length] } },
  ];
  for (const v of variants) {
    const r = replayCast(e, PLAYER, v);
    assert.ok(!r.ok || !claimMatches(env.claim, r), JSON.stringify(v.spot));
  }
});

test("another angler cannot replay your envelope as theirs", () => {
  const { e, env } = honest();
  const r = replayCast(e, "thief-0000-0003", env);
  assert.ok(!r.ok || !claimMatches(env.claim, r));
});

test("a fight that is too short or too short-pressed is impossible input", () => {
  assert.equal(traceReason([0, 3, 4, 3]), null);
  assert.equal(traceReason([0, TAP_STEPS - 1, 4, 3]), "impossible_input", "a 100 ms press is not a tap");
  assert.equal(traceReason([0, 3, 4, 1]), null, "the last run may be cut off by the end of the fight");
  assert.equal(traceReason([0, 4000, 4000]), "too_long");
});

test("input with no hook, and a hook after the fish left, are refused", () => {
  const e = ev(0);
  const c = choiceFor(0, 2);
  const roll = rollCast(e, PLAYER, 0, c.spot, c.p, START)!;
  const base = recordCast(e, PLAYER, 0, START, { ...c, hookMs: 200 });
  const late = replayCast(e, PLAYER, { ...base, hook: Math.ceil(roll.biteMax * 1000) + 50 });
  assert.ok(!late.ok);
  const miss = replayCast(e, PLAYER, { ...base, hook: -1 });
  assert.ok(!miss.ok && miss.reason === "input_without_hook");
});

test("cast cost is the wait, the hook and the fight", () => {
  const { e, env } = honest();
  const r = replayCast(e, PLAYER, env);
  assert.ok(r.ok);
  if (!r.ok) return;
  const want = r.roll.waitSec + env.hook / 1000 + r.steps * FIGHT_STEP;
  assert.ok(Math.abs(r.seconds - want) < 1e-9);
  assert.equal(r.steps, env.inputs.reduce((a, b) => a + b, 0));
});

test("the fight a roll makes has no Helping Hand and the event tackle", () => {
  const e = ev(5);
  const c = choiceFor(5, 2);
  const roll = rollCast(e, PLAYER, 0, c.spot, c.p, START)!;
  const init = fightInitOf(roll, 1);
  assert.equal(init.boss, false);
  assert.equal(init.pullMul, 1);
  assert.equal(init.drag, 1);
});

test("parseEnvelope refuses junk", () => {
  const good = recordCast(ev(0), PLAYER, 0, START, choiceFor(0, 1));
  const cases: unknown[] = [
    null,
    [],
    "x",
    { ...good, castIndex: -1 },
    { ...good, castIndex: 1.5 },
    { ...good, at: "now" },
    { ...good, spot: "" },
    { ...good, p: { ...good.p, family: "dynamite" } },
    { ...good, p: { ...good.p, depth: 7 } },
    { ...good, hook: 99999 },
    { ...good, inputs: new Array(2401).fill(1) },
    { ...good, inputs: [0, 0, 1] },
    { ...good, inputs: [0, -1] },
    { ...good, drag: 3 },
    { ...good, released: "no" },
    { ...good, claim: { out: "won", i: 0, w: 0, v: 0 } },
    { ...good, claim: { out: "landed", i: 0, w: Number.NaN, v: 0 } },
  ];
  for (const c of cases) assert.equal(parseEnvelope(c).ok, false, JSON.stringify(c)?.slice(0, 60));
  assert.equal(parseEnvelope(good).ok, true);
});
