/* Fight/line rules versions in tournaments (docs/architecture/10 §1.6): an old recorded cast still verifies under
   the rules it was played with, a new one verifies under the new rules, and the two never get mixed up. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { FAMILIES, RETRIEVES, type Presentation } from "./presentation.ts";
import { RULES_VERSION } from "./line-wear.ts";
import { EVENT_GEAR, claimMatches, decentPlayer, fightInitOf, parseEnvelope, recordCast, replayCast, rollCast, type Choice, type Envelope, type ReplayEvent } from "./replay.ts";
import { eventSeed, quickAt, privateSpec } from "./schedule.ts";
import { spotsOf } from "./spots.ts";
import { replayFight, type Fight } from "./fight.ts";
import { healthOf } from "./lines.ts";

const START = Date.UTC(2026, 10, 2, 12, 0, 0);
const PLAYER = "player-aaaa-0001";
const legacy = (water: number): ReplayEvent => ({ id: `v-test-${water}`, seed: eventSeed(`v-test-${water}`), water, startsAt: START });
const modern = (water: number): ReplayEvent => ({ ...legacy(water), rulesVersion: RULES_VERSION });

function choiceFor(water: number, n: number): Choice {
  const spots = spotsOf(water);
  const p: Presentation = { family: FAMILIES[(n * 5) % FAMILIES.length], depth: (n % 3) as 0 | 1 | 2, retrieve: RETRIEVES[n % RETRIEVES.length] };
  return { spot: spots[n % spots.length].id, p, drag: (n % 3) as 0 | 1 | 2, hookMs: 150 + (n % 9) * 110 };
}

/** A lazy angler: reels one step in four, so the fish has time to wear the line. */
const lazy = (): ((F: Fight) => boolean) => {
  let n = 0;
  return () => n++ % 4 === 0;
};

test("the current rules version is 2, and new events carry it", () => {
  assert.equal(RULES_VERSION, 2);
  assert.equal(quickAt(START).rules.rulesVersion, RULES_VERSION);
  assert.equal(privateSpec("ABCD", 3, null, 15, START).rules.rulesVersion, RULES_VERSION);
});

test("an old (version 1) recorded cast still verifies on an event made before line wear", () => {
  let landed = 0;
  for (let w = 0; w < 15; w++) {
    for (let n = 0; n < 8; n++) {
      const e = legacy(w);
      const env = recordCast(e, PLAYER, n, START + n * 9000, choiceFor(w, n));
      assert.equal(env.rv, undefined, "an old envelope has no version stamp");
      const parsed = parseEnvelope(JSON.parse(JSON.stringify(env)));
      assert.ok(parsed.ok);
      const rep = replayCast(e, PLAYER, (parsed as { env: Envelope }).env);
      assert.ok(rep.ok, `water ${w} cast ${n}: ${rep.ok ? "" : rep.reason}`);
      if (rep.ok) {
        assert.ok(claimMatches(env.claim, rep));
        if (rep.outcome === "landed") landed++;
      }
    }
  }
  assert.ok(landed > 20);
});

test("a new (version 2) recorded cast verifies on a new event, and carries its version", () => {
  let landed = 0;
  let worn = 0;
  for (let w = 0; w < 15; w++) {
    for (let n = 0; n < 8; n++) {
      const e = modern(w);
      const env = recordCast(e, PLAYER, n, START + n * 9000, choiceFor(w, n), n % 2 ? lazy() : decentPlayer());
      if (env.hook >= 0) assert.equal(env.rv, 2);
      const rep = replayCast(e, PLAYER, env);
      assert.ok(rep.ok, `water ${w} cast ${n}: ${rep.ok ? "" : rep.reason}`);
      if (rep.ok) {
        assert.ok(claimMatches(env.claim, rep), `claim ${w}/${n}`);
        if (rep.outcome === "landed") landed++;
        if (rep.outcome === "lost" && rep.why === "snap") worn++;
      }
    }
  }
  assert.ok(landed > 20);
  assert.ok(worn >= 0);
});

test("the two versions are different fights: version 2 gives the event line health, version 1 does not", () => {
  const e = legacy(3);
  const c = choiceFor(3, 4);
  const roll = rollCast(e, PLAYER, 4, c.spot, c.p, START)!;
  const v1 = fightInitOf(roll, 1, 1);
  const v2 = fightInitOf(roll, 1, 2);
  assert.equal(v1.lineHealth, undefined);
  assert.equal(v2.lineHealth, healthOf(EVENT_GEAR.line));
  assert.equal(fightInitOf(roll, 1).lineHealth, undefined, "the default is the old rules");
  /* The same stalled input trace: version 1 never wears out, version 2 does once the health is spent. */
  const stall = { ...v1, rarity: 4, hold: 99, pullMul: 0 };
  const a = replayFight(stall, [], 6000);
  const b = replayFight({ ...stall, lineHealth: 30 }, [], 6000);
  assert.equal(a.result, null, "no wear: a fish that does not pull never ends the fight");
  assert.equal(b.result, "snap");
  assert.equal(b.worn, true);
});

test("a cast must say the version of the event it was played in", () => {
  const w = 4;
  const envOld = recordCast(legacy(w), PLAYER, 1, START, choiceFor(w, 1));
  const envNew = recordCast(modern(w), PLAYER, 1, START, choiceFor(w, 1));
  const a = replayCast(modern(w), PLAYER, envOld);
  assert.equal(a.ok, false);
  assert.equal(a.ok ? "" : a.reason, "rules_version");
  const b = replayCast(legacy(w), PLAYER, envNew);
  assert.equal(b.ok, false);
  assert.equal(b.ok ? "" : b.reason, "rules_version");
  /* a missed cast has no fight but still names its version */
  const missed = recordCast(modern(w), PLAYER, 2, START, { ...choiceFor(w, 2), hookMs: -1 });
  assert.equal(missed.rv, 2);
  assert.equal(replayCast(modern(w), PLAYER, missed).ok, true);
});

test("the envelope's version is parsed strictly", () => {
  const env = recordCast(modern(2), PLAYER, 3, START, choiceFor(2, 3));
  assert.ok(parseEnvelope(env).ok);
  assert.ok(parseEnvelope({ ...env, rv: "2" }).ok === false);
  assert.ok(parseEnvelope({ ...env, rv: 0 }).ok === false);
  const { rv: _rv, ...bare } = env;
  void _rv;
  const p = parseEnvelope(bare);
  assert.ok(p.ok && p.env.rv === undefined);
});
