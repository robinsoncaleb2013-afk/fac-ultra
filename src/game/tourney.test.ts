import assert from "node:assert/strict";
import test from "node:test";
import { cantCast, clock, EnvelopeQueue, msToClose, verdictNote, type CatchReply, type TourneyRun } from "./tourney.ts";
import type { Envelope } from "./replay.ts";

const env = (n: number) => ({ castIndex: n }) as unknown as Envelope;
const reply = (verdict: string, reason?: string) => ({ verdict, reason }) as unknown as CatchReply;
const settle = () => new Promise((r) => setImmediate(r));

function rig(answers: Array<{ status: number; body: CatchReply } | "throw">) {
  const sent: number[] = [];
  const got: Array<[number, string]> = [];
  const dropped: number[] = [];
  const timers: Array<() => void> = [];
  const q = new EnvelopeQueue({
    send: async (e) => {
      sent.push(e.castIndex);
      const a = answers.shift() ?? { status: 200, body: reply("ok") };
      if (a === "throw") throw new Error("offline");
      return a;
    },
    onReply: (e, r) => got.push([e.castIndex, r.verdict]),
    onDrop: (e) => dropped.push(e.castIndex),
    later: (fn) => timers.push(fn),
    store: null,
  });
  return { q, sent, got, dropped, timers };
}

test("envelopes go out one at a time, in order", async () => {
  const r = rig([]);
  r.q.push(env(0));
  r.q.push(env(1));
  r.q.push(env(2));
  await settle();
  await settle();
  assert.deepEqual(r.sent, [0, 1, 2]);
  assert.deepEqual(r.got.map((g) => g[0]), [0, 1, 2]);
  assert.equal(r.q.size, 0);
});

test("a rate answer waits and resends the same envelope", async () => {
  const r = rig([{ status: 429, body: reply("rate", "too_fast") }]);
  r.q.push(env(0));
  await settle();
  assert.deepEqual(r.sent, [0]);
  assert.equal(r.got.length, 0);
  assert.equal(r.timers.length, 1);
  r.timers.shift()!();
  await settle();
  assert.deepEqual(r.sent, [0, 0]);
  assert.deepEqual(r.got, [[0, "ok"]]);
});

test("a network failure backs off and retries", async () => {
  const r = rig(["throw", "throw"]);
  r.q.push(env(0));
  await settle();
  r.timers.shift()!();
  await settle();
  r.timers.shift()!();
  await settle();
  assert.deepEqual(r.sent, [0, 0, 0]);
  assert.deepEqual(r.got, [[0, "ok"]]);
});

test("a cast_index answer drops what is queued behind it", async () => {
  const r = rig([{ status: 200, body: reply("stale", "cast_index") }]);
  r.q.push(env(0));
  r.q.push(env(1));
  r.q.push(env(2));
  await settle();
  await settle();
  assert.deepEqual(r.got, [[0, "stale"]]);
  assert.deepEqual(r.dropped, [1, 2]);
  assert.equal(r.q.size, 0);
});

test("an answer with no verdict can never be accepted, so it is dropped and the queue moves on", async () => {
  const r = rig([{ status: 400, body: {} as CatchReply }]);
  r.q.push(env(0));
  r.q.push(env(1));
  await settle();
  await settle();
  assert.deepEqual(r.dropped, [0]);
  assert.deepEqual(r.got, [[1, "ok"]]);
});

test("a stored queue resumes", async () => {
  let saved: Envelope[] = [env(7)];
  const sent: number[] = [];
  const q = new EnvelopeQueue({
    send: async (e) => (sent.push(e.castIndex), { status: 200, body: reply("ok") }),
    onReply: () => undefined,
    store: { get: () => saved, set: (l) => (saved = [...l]) },
  });
  q.resume();
  await settle();
  assert.deepEqual(sent, [7]);
  assert.deepEqual(saved, []);
});

const run = (over: Partial<TourneyRun> = {}) =>
  ({
    event: { endsAt: 100_000, castBudget: 3, fishingSeconds: 60 },
    offset: 0,
    castsUsed: 0,
    secondsUsed: 0,
    pending: 0,
    ...over,
  }) as unknown as TourneyRun;

test("the clock follows the server's time, not the phone's", () => {
  assert.equal(msToClose(run({ offset: 5000 }), 90_000), 5000);
  assert.equal(msToClose(run(), 200_000), 0);
});

test("cantCast names the reason and is quiet when casting is fine", () => {
  assert.equal(cantCast(run(), 1000), null);
  assert.match(String(cantCast(run({ castsUsed: 3 }), 1000)), /cast/i);
  assert.match(String(cantCast(run({ secondsUsed: 60 }), 1000)), /./);
  assert.match(String(cantCast(run(), 200_000)), /./);
});

test("clock() formats minutes and hours", () => {
  assert.equal(clock(65_000), "1:05");
  assert.equal(clock(3_725_000), "1:02:05");
  assert.equal(clock(-5), "0:00");
});

test("every verdict has words for the player", () => {
  for (const v of ["ok", "mismatch", "budget", "stale", "rate", "banned"] as const) {
    assert.ok(verdictNote({ verdict: v, reason: undefined }).length >= 0);
  }
});
