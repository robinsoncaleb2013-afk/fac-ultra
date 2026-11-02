/* The tournament API against a real (embedded) Postgres: join → casts → board, and every way to be refused.
   No Neon needed. docs/architecture/06 §5. */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Sql } from "@/lib/db";
import { decentPlayer, recordCast, type Choice, type Envelope, type ReplayEvent } from "@/game/replay";
import { FAMILIES } from "@/game/presentation";
import { dailyAt, DAY, HOUR, quickAt } from "@/game/schedule";
import { spotsOf } from "@/game/spots";
import { handleBoard, handleSurvivalBoard } from "./board.server.ts";
import type { ApiReq, ApiRes } from "./common.server.ts";
import { handleEntry, handleCatch } from "./entries.server.ts";
import { handleEvents } from "./events.server.ts";
import { handleRtc } from "./rtc.server.ts";
import { testSql } from "./testing.server.ts";

let sql: Sql;
let close: () => Promise<void>;
before(async () => {
  ({ sql, close } = await testSql());
});
after(async () => close());

let ipN = 0;
const NOW = Date.UTC(2026, 10, 2, 13, 5, 0); // 13:05 on Mon 2026-11-02, five minutes into the 13:00 Quick
const get = (path: string, now = NOW, ip = `10.0.0.${++ipN}`): ApiReq => ({ method: "GET", url: new URL(`http://x${path}`), ip, now });
const post = (body: unknown, now = NOW, ip = `10.0.1.${++ipN}`): ApiReq => ({ method: "POST", url: new URL("http://x/"), body, ip, now });

const idOf = (n: number) => `player-${String(n).padStart(4, "0")}-abcd`;

async function openEvents(now = NOW) {
  const r = await handleEvents(sql, get("/api/events?scope=open", now));
  assert.equal(r.status, 200);
  return r.body.events as { id: string; kind: string; state: string; category: string; water: number; entrants: number; joined: boolean }[];
}

async function join(eventId: string, playerId: string, now = NOW, name = "Casey") {
  return handleEntry(sql, post({ op: "join", eventId, playerId, name }, now));
}

function spotChoice(water: number, n: number, hookMs = 220): Choice {
  const spots = spotsOf(water);
  return { spot: spots[n % spots.length].id, p: { family: "worm", depth: 1, retrieve: "slow" }, drag: 1, hookMs };
}

/** What the client would send for its next cast, `elapsed` seconds into the entry. */
function nextEnvelope(ev: ReplayEvent, playerId: string, castIndex: number, at: number, hookMs = 220): Envelope {
  return recordCast(ev, playerId, castIndex, at, spotChoice(ev.water, castIndex, hookMs), decentPlayer());
}

const evOf = (e: { id: string; seed: number; water: number; startsAt: number }): ReplayEvent => ({ id: e.id, seed: e.seed, water: e.water, startsAt: e.startsAt });

test("events: the open list materialises the schedule, once, and tells Quick from Daily", async () => {
  const a = await openEvents();
  const b = await openEvents();
  assert.deepEqual(a, b, "asking twice changes nothing");
  const kinds = new Set(a.map((e) => e.kind));
  for (const k of ["quick", "daily", "weekly", "survival"]) assert.ok(kinds.has(k), k);
  const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from events");
  assert.equal(n, a.length);
  const live = a.filter((e) => e.state === "live");
  assert.ok(live.some((e) => e.id === quickAt(NOW).id));
  assert.ok(live.some((e) => e.id === dailyAt(NOW).id));
  assert.ok(a.some((e) => e.state === "upcoming"));
  assert.ok(a.every((e) => e.kind !== "private"));
});

test("events: a private event gets a code, is found by it, is not listed, and each host gets three", async () => {
  const host = idOf(900);
  const made = await handleEvents(sql, post({ op: "create", playerId: host, name: "Host", water: 3, rules: { category: "big", castBudget: 12, fishingSeconds: 300 }, minutes: 20 }));
  assert.equal(made.status, 200);
  const code = made.body.code as string;
  assert.match(code, /^[A-HJ-NP-Z]{4}$/);
  const found = await handleEvents(sql, get(`/api/events?code=${code.toLowerCase()}`));
  assert.equal(found.status, 200);
  assert.equal((found.body.event as { category: string }).category, "big");
  assert.equal((await handleEvents(sql, get("/api/events?code=ZZZZ"))).status, 404);
  assert.equal((await handleEvents(sql, get("/api/events?code=abc"))).status, 400);
  assert.ok(!(await openEvents()).some((e) => e.id === `p-${code}`));
  await handleEvents(sql, post({ op: "create", playerId: host, water: 1, minutes: 10 }));
  await handleEvents(sql, post({ op: "create", playerId: host, water: 2, minutes: 10 }));
  const fourth = await handleEvents(sql, post({ op: "create", playerId: host, water: 2, minutes: 10 }));
  assert.equal(fourth.status, 429);
  assert.equal(fourth.body.error, "too_many_events");
  assert.equal((await handleEvents(sql, post({ op: "create", playerId: "x" }))).status, 400);
  assert.equal((await handleEvents(sql, post({ op: "nope", playerId: host }))).status, 400);
});

test("join: returns the seed, the rules and where you stand; joining twice is the same entry", async () => {
  const q = quickAt(NOW);
  const p = idOf(1);
  const r = await join(q.id, p);
  assert.equal(r.status, 200);
  assert.equal(r.body.seed, q.seed);
  assert.equal((r.body.rules as { castBudget: number }).castBudget, 40);
  assert.equal(r.body.nextCast, 0);
  assert.equal(r.body.castsLeft, 40);
  assert.equal(r.body.rank, 1);
  assert.equal(r.body.serverNow, NOW);
  const again = await join(q.id, p, NOW + 5000, "Casey");
  assert.equal(again.status, 200);
  assert.equal(again.body.entrants, 1);
  const bad = [
    await handleEntry(sql, post({ op: "join", eventId: "nope-nope", playerId: p }, NOW)),
    await handleEntry(sql, post({ op: "join", eventId: q.id, playerId: "short" }, NOW)),
    await handleEntry(sql, post({ op: "leave", eventId: q.id, playerId: p }, NOW)),
    await handleEntry(sql, get("/", NOW)),
  ];
  assert.deepEqual(bad.map((b) => b.status), [404, 400, 400, 405]);
  const over = await join(q.id, idOf(2), NOW + HOUR);
  assert.equal(over.status, 410);
  const early = await join(quickAt(NOW + HOUR).id, idOf(2), NOW);
  assert.equal(early.status, 425);
});

test("join: names are cleaned", async () => {
  const q = quickAt(NOW);
  const r = await handleEntry(sql, post({ op: "join", eventId: q.id, playerId: idOf(3), name: "<script>alert(1)</script>  Bo\nb" }, NOW));
  assert.equal(r.status, 200);
  assert.match(String(r.body.name), /^[\p{L}\p{N} _.'-]{2,20}$/u);
  const blank = await handleEntry(sql, post({ op: "join", eventId: q.id, playerId: idOf(4), name: "  " }, NOW));
  assert.match(String(blank.body.name), /^Angler [0-9A-Z]{4}$/);
});

/** The live game has a cast take at least its wait + bite + fight; this plays them back to back on a clock that keeps up. */
async function playCasts(eventId: string, playerId: string, count: number, startNow: number, hook = 220) {
  const joined = await join(eventId, playerId, startNow);
  assert.equal(joined.status, 200);
  const ev = evOf({ id: eventId, seed: joined.body.seed as number, water: joined.body.water as number, startsAt: joined.body.startsAt as number });
  let now = startNow;
  const out: ApiRes[] = [];
  let index = Number(joined.body.nextCast);
  for (let n = 0; n < count; n++) {
    const env = nextEnvelope(ev, playerId, index, now, hook);
    now += 30_000; // a generous 30 s per cast, comfortably slower than any cast costs
    const r = await handleCatch(sql, post({ eventId, playerId, envelope: env }, now));
    out.push(r);
    index = Number(r.body.nextCast);
  }
  return { out, now, ev };
}

test("catch: an honest player's casts all verify, and the board shows the right score and rank", async () => {
  const daily = dailyAt(NOW);
  await openEvents();
  const start = NOW + 10 * 60_000;
  const { out } = await playCasts(daily.id, idOf(10), 3, start);
  assert.deepEqual(out.map((r) => r.body.verdict), ["ok", "ok", "ok"]);
  assert.deepEqual(out.map((r) => r.body.nextCast), [1, 2, 3]);
  /* The daily on this day is Big Fish (Monday): score = heaviest verified fish. */
  assert.equal(daily.rules.category, "big");
  const weights = out.map((r) => (r.body.result as { weight: number }).weight);
  const best = Math.max(...weights);
  assert.equal(out[2].body.score, best);
  assert.ok(best > 0, "at least one fish landed in three casts");

  /* A second angler with different casts; then read the board. */
  await playCasts(daily.id, idOf(11), 3, start);
  const board = await handleBoard(sql, get(`/api/board?eventId=${daily.id}&around=${idOf(10)}`, start + 200_000));
  assert.equal(board.status, 200);
  const rows = board.body.rows as { name: string; score: number; rank: number; you: boolean }[];
  assert.equal(rows.length, 2);
  assert.ok(rows[0].score >= rows[1].score, "sorted best first");
  assert.equal(rows.filter((r) => r.you).length, 1);
  const me = board.body.me as { score: number; rank: number };
  assert.equal(me.score, best);
  assert.equal(me.rank, rows.find((r) => r.you)!.rank);
  assert.equal(board.body.entrants, 2);
});

test("catch: a replayed envelope gets its old answer, not a strike", async () => {
  const q = quickAt(NOW);
  const p = idOf(20);
  const j = await join(q.id, p, NOW);
  const ev = evOf({ id: q.id, seed: j.body.seed as number, water: j.body.water as number, startsAt: j.body.startsAt as number });
  const env = nextEnvelope(ev, p, 0, NOW + 1000);
  const first = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: env }, NOW + 60_000));
  const second = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: env }, NOW + 61_000));
  assert.equal(first.body.verdict, "ok", JSON.stringify(first.body));
  assert.equal(second.body.verdict, "ok");
  assert.equal(second.body.again, true);
  assert.equal(second.body.castsUsed, 1);
  const reuse = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: { ...env, hook: 100 } }, NOW + 62_000));
  assert.equal(reuse.body.verdict, "stale");
  assert.equal(reuse.body.reason, "cast_index_reused");
});

test("catch: a tampered replay is a mismatch, scores nothing, and the cast is spent", async () => {
  const q = quickAt(NOW);
  const p = idOf(21);
  const j = await join(q.id, p, NOW);
  const ev = evOf({ id: q.id, seed: j.body.seed as number, water: j.body.water as number, startsAt: j.body.startsAt as number });
  let env: Envelope | null = null;
  for (let i = 0; i < 120 && !env; i++) {
    const e = recordCast(ev, p, 0, NOW + 1000, { ...spotChoice(ev.water, i), p: { family: FAMILIES[i % FAMILIES.length], depth: 1, retrieve: "slow" } }, (F) => F.steps % 6 < 4);
    if (e.claim.out === "landed" && e.inputs.length > 4) env = e;
  }
  assert.ok(env);
  const bad: Envelope = { ...env!, inputs: env!.inputs.map((n, k) => (k === 2 ? n + 9 : n)) };
  const r = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: bad }, NOW + 60_000));
  assert.equal(r.body.verdict, "mismatch");
  assert.equal(r.body.score, 0);
  assert.equal(r.body.castsUsed, 1);
  const stored = await sql.query<{ verdict: string }>("select verdict from catches where event_id = $1 and player_id = $2", [q.id, p]);
  assert.deepEqual(stored.map((s) => s.verdict), ["mismatch"]);

  /* Lying about the fish is a mismatch too. */
  const j2 = await join(q.id, idOf(22), NOW);
  assert.equal(j2.status, 200);
  const honest = recordCast(ev, idOf(22), 0, NOW + 1000, { ...spotChoice(ev.water, 1), hookMs: 200 }, decentPlayer());
  const lie: Envelope = { ...honest, claim: { out: "landed", i: 24, w: 999, v: 99999 } };
  const r2 = await handleCatch(sql, post({ eventId: q.id, playerId: idOf(22), envelope: lie }, NOW + 60_000));
  assert.equal(r2.body.verdict, "mismatch");
  assert.equal(r2.body.reason, "claim");
});

test("catch: impossible input (a 100 ms tap) is a mismatch", async () => {
  const q = quickAt(NOW);
  const p = idOf(23);
  const j = await join(q.id, p, NOW);
  const ev = evOf({ id: q.id, seed: j.body.seed as number, water: j.body.water as number, startsAt: j.body.startsAt as number });
  const honest = recordCast(ev, p, 0, NOW + 1000, spotChoice(ev.water, 2), decentPlayer());
  const bad: Envelope = { ...honest, inputs: [0, 2, 3, 2, 3, 6], hook: 200 };
  const r = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: bad }, NOW + 60_000));
  assert.equal(r.body.verdict, "mismatch");
  assert.equal(r.body.reason, "impossible_input");
});

test("catch: malformed envelopes, unknown events and strangers are refused outright", async () => {
  const q = quickAt(NOW);
  const p = idOf(24);
  const j = await join(q.id, p, NOW);
  const ev = evOf({ id: q.id, seed: j.body.seed as number, water: j.body.water as number, startsAt: j.body.startsAt as number });
  const env = nextEnvelope(ev, p, 0, NOW + 1000);
  const cases: [string, unknown, number][] = [
    ["junk envelope", { eventId: q.id, playerId: p, envelope: { castIndex: "0" } }, 400],
    ["no envelope", { eventId: q.id, playerId: p }, 400],
    ["bad event id", { eventId: "!!", playerId: p, envelope: env }, 400],
    ["unknown event", { eventId: "q-1999010100", playerId: p, envelope: env }, 404],
    ["never joined", { eventId: q.id, playerId: idOf(99), envelope: env }, 403],
    ["not an object", [1, 2], 400],
  ];
  for (const [label, body, status] of cases) {
    const r = await handleCatch(sql, post(body, NOW + 60_000));
    assert.equal(r.status, status, label);
  }
  assert.equal((await handleCatch(sql, get("/", NOW))).status, 405);
});

test("catch: skipping or repeating a cast index is stale", async () => {
  const q = quickAt(NOW);
  const p = idOf(25);
  const j = await join(q.id, p, NOW);
  const ev = evOf({ id: q.id, seed: j.body.seed as number, water: j.body.water as number, startsAt: j.body.startsAt as number });
  const skip = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: nextEnvelope(ev, p, 1, NOW + 1000) }, NOW + 60_000));
  assert.equal(skip.body.verdict, "stale");
  assert.equal(skip.body.reason, "cast_index");
  assert.equal(skip.body.expected, 0);
});

test("catch: the clock decides what is stale", async () => {
  const q = quickAt(NOW);
  const p = idOf(26);
  const j = await join(q.id, p, NOW);
  const ev = evOf({ id: q.id, seed: j.body.seed as number, water: j.body.water as number, startsAt: j.body.startsAt as number });
  const tooOld = nextEnvelope(ev, p, 0, NOW - 400_000);
  const r1 = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: tooOld }, NOW + 60_000));
  assert.equal(r1.body.verdict, "stale");
  const future = nextEnvelope(ev, p, 0, NOW + 500_000);
  const r2 = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: future }, NOW + 60_000));
  assert.equal(r2.body.verdict, "stale");
  const before = nextEnvelope(ev, p, 0, q.startsAt - 120_000);
  const r3 = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: before }, q.startsAt - 100_000));
  assert.equal(r3.body.verdict, "stale");
  assert.equal(r3.body.reason, "outside_window");
  const after_ = nextEnvelope(ev, p, 0, NOW + 1000);
  const r4 = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: after_ }, q.endsAt + 120_000));
  assert.equal(r4.body.verdict, "stale");
  assert.equal(r4.body.reason, "event_over");
});

test("rate: the 2nd envelope inside 2 seconds trips, three strikes ban the player for an hour", async () => {
  const q = quickAt(NOW);
  const p = idOf(30);
  const j = await join(q.id, p, NOW);
  const ev = evOf({ id: q.id, seed: j.body.seed as number, water: j.body.water as number, startsAt: j.body.startsAt as number });
  const t = NOW + 120_000;
  const first = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: nextEnvelope(ev, p, 0, t - 30_000) }, t));
  assert.equal(first.body.verdict, "ok");
  const second = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: nextEnvelope(ev, p, 1, t - 20_000) }, t + 1000));
  assert.equal(second.status, 429);
  assert.equal(second.body.verdict, "rate");
  assert.equal(second.body.nextCast, 1, "the cast was not spent: try again");
  const ok2 = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: nextEnvelope(ev, p, 1, t - 20_000) }, t + 2500));
  assert.equal(ok2.body.verdict, "ok");
  /* Hammer it: strikes pile up. */
  await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: nextEnvelope(ev, p, 2, t) }, t + 3000));
  const strike2 = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: nextEnvelope(ev, p, 2, t) }, t + 3200));
  assert.equal(strike2.body.verdict, "rate");
  const banned = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: nextEnvelope(ev, p, 2, t) }, t + 3400));
  assert.ok(banned.body.verdict === "rate" || banned.status === 403);
  const after3 = await handleCatch(sql, post({ eventId: q.id, playerId: p, envelope: nextEnvelope(ev, p, 2, t) }, t + 9000));
  assert.equal(after3.status, 403);
  assert.equal(after3.body.error, "banned");
  assert.equal((await join(q.id, p, t + 10_000)).status, 403, "can't join while banned");
  assert.equal((await join(dailyAt(NOW).id, p, t + 10_000)).status, 403);
});

test("rate: casts piled up faster than the clock allows are refused", async () => {
  const d = dailyAt(NOW);
  const p = idOf(31);
  const start = NOW + 20 * 60_000;
  const j = await join(d.id, p, start);
  const ev = evOf({ id: d.id, seed: j.body.seed as number, water: j.body.water as number, startsAt: j.body.startsAt as number });
  /* A cheat that pre-plays a stack of casts and posts one every 2.5 s: each cast costs several seconds of fishing. */
  const verdicts: string[] = [];
  let last: ApiRes | null = null;
  for (let i = 0; i < 6; i++) {
    const env = recordCast(ev, p, i, start, spotChoice(ev.water, i, 1200), decentPlayer());
    last = await handleCatch(sql, post({ eventId: d.id, playerId: p, envelope: env }, start + 2500 * (i + 1)));
    verdicts.push(String(last.body.verdict));
    if (last.body.verdict === "rate") break;
  }
  assert.equal(last!.body.verdict, "rate", verdicts.join());
  assert.equal(last!.body.reason, "faster_than_the_clock");
  assert.ok(verdicts.length <= 5, "caught within a few casts");
});

test("budget: the cast after castBudget is refused and scores nothing", async () => {
  const made = await handleEvents(sql, post({ op: "create", playerId: idOf(901), water: 0, rules: { category: "total", castBudget: 5, fishingSeconds: 3000 }, minutes: 180 }, NOW));
  const id = `p-${made.body.code}`;
  const p = idOf(32);
  const { out, now, ev } = await playCasts(id, p, 5, NOW);
  assert.ok(out.every((r) => r.body.verdict === "ok"));
  assert.equal(out[4].body.castsLeft, 0);
  const sixth = await handleCatch(sql, post({ eventId: id, playerId: p, envelope: nextEnvelope(ev, p, 5, now - 20_000) }, now + 30_000));
  assert.equal(sixth.body.verdict, "budget");
  assert.equal(sixth.body.reason, "casts");
  assert.equal(sixth.body.score, out[4].body.score);
});

test("budget: fishing seconds run out too", async () => {
  const made = await handleEvents(sql, post({ op: "create", playerId: idOf(902), water: 0, rules: { category: "total", castBudget: 100, fishingSeconds: 60 }, minutes: 180 }, NOW));
  const id = `p-${made.body.code}`;
  const p = idOf(33);
  const { out } = await playCasts(id, p, 12, NOW);
  const verdicts = out.map((r) => r.body.verdict);
  assert.equal(verdicts[0], "ok");
  assert.ok(verdicts.includes("budget"), verdicts.join());
  const first = verdicts.indexOf("budget");
  assert.ok(verdicts.slice(first).every((v) => v === "budget"), "once out of time, it stays out");
  assert.equal(out[first].body.reason, "seconds");
  assert.ok(Number(out[first - 1].body.secondsUsed) <= 60);
});

test("private events hold sixteen anglers", async () => {
  const made = await handleEvents(sql, post({ op: "create", playerId: idOf(903), water: 0, minutes: 30 }, NOW));
  const id = `p-${made.body.code}`;
  for (let n = 0; n < 16; n++) assert.equal((await join(id, idOf(100 + n))).status, 200);
  const seventeenth = await join(id, idOf(200));
  assert.equal(seventeenth.status, 409);
  assert.equal(seventeenth.body.error, "event_full");
  assert.equal((await join(id, idOf(100))).status, 200, "someone already in can come back");
});

test("board: the top N plus the rows around you, ties share a rank, and 'final' waits for the end", async () => {
  const made = await handleEvents(sql, post({ op: "create", playerId: idOf(904), water: 2, rules: { category: "total", castBudget: 30, fishingSeconds: 3000 }, minutes: 60 }, NOW));
  const id = `p-${made.body.code}`;
  for (let n = 0; n < 9; n++) {
    await playCasts(id, idOf(300 + n), (n % 4) + 1, NOW);
  }
  const top3 = await handleBoard(sql, get(`/api/board?eventId=${id}&top=3`, NOW + 600_000));
  const rows3 = top3.body.rows as { score: number; rank: number }[];
  assert.equal(rows3.length, 3);
  assert.ok(rows3[0].score >= rows3[1].score && rows3[1].score >= rows3[2].score);
  assert.equal(rows3[0].rank, 1);
  /* Around a low-ranked player: the top 3 + five rows around them, no duplicates, in order. */
  const all = (await handleBoard(sql, get(`/api/board?eventId=${id}&top=100`, NOW + 600_000))).body.rows as { name: string; rank: number }[];
  assert.equal(all.length, 9);
  const mine = idOf(300);
  const around = await handleBoard(sql, get(`/api/board?eventId=${id}&top=3&around=${mine}`, NOW + 600_000));
  const rows = around.body.rows as { rank: number; you: boolean }[];
  assert.ok(rows.length >= 4 && rows.length <= 8);
  assert.equal(rows.filter((r) => r.you).length, 1);
  assert.deepEqual(rows.map((r) => r.rank), [...rows.map((r) => r.rank)].sort((a, b) => a - b));
  assert.equal(await handleBoard(sql, get(`/api/board?eventId=${id}&final=1`, NOW + 600_000)).then((r) => r.status), 409);
  const end = (await handleEvents(sql, get(`/api/events?code=${made.body.code}`, NOW))).body.event as { endsAt: number };
  const fin = await handleBoard(sql, get(`/api/board?eventId=${id}&final=1&around=${mine}`, end.endsAt + 1000));
  assert.equal(fin.status, 200);
  assert.equal((fin.body.rows as unknown[]).length >= 3, true);
  assert.equal(fin.body.state, "ended");
  assert.equal((await handleBoard(sql, get("/api/board?eventId=nope-nope"))).status, 404);
  assert.equal((await handleBoard(sql, get("/api/board"))).status, 400);
});

test("board: caching headers are 5 s and never shared when a player is named", async () => {
  const d = dailyAt(NOW);
  const shared = await handleBoard(sql, get(`/api/board?eventId=${d.id}`));
  assert.match(String(shared.cache), /max-age=5/);
  assert.match(String(shared.cache), /^public/);
  const mine = await handleBoard(sql, get(`/api/board?eventId=${d.id}&around=${idOf(1)}`));
  assert.match(String(mine.cache), /^private/);
});

test("weekly: the board for a series adds the three waters together", async () => {
  const list = await openEvents();
  const weekly = list.filter((e) => e.kind === "weekly");
  assert.equal(weekly.length, 3);
  const p = idOf(40);
  let total = 0;
  for (const w of weekly) {
    const { out } = await playCasts(w.id, p, 2, NOW + 3600_000);
    total += Number(out[1].body.score);
  }
  const series = (await sql.query<{ series: string }>("select series from events where id = $1", [weekly[0].id]))[0].series;
  const board = await handleBoard(sql, get(`/api/board?series=${series}&around=${p}`, NOW + 7200_000));
  assert.equal(board.status, 200);
  const me = (board.body.rows as { you: boolean; score: number }[]).find((r) => r.you)!;
  assert.ok(Math.abs(me.score - total) < 0.001, `${me.score} vs ${total}`);
});

test("survival board: a log that replays is accepted, one that lies is not", async () => {
  const date = "2026-11-02";
  const { survivalAt } = await import("@/game/schedule");
  const s = survivalAt(NOW);
  const ev: ReplayEvent = { id: s.id, seed: s.seed, water: s.water, startsAt: Date.parse(`${date}T00:00:00Z`) };
  const p = idOf(50);
  const log: Envelope[] = [];
  let landed = 0;
  let heaviest = 0;
  for (let i = 0; i < 12; i++) {
    const env = recordCast(ev, p, i, i * 60_000, spotChoice(ev.water, i), decentPlayer());
    log.push(env);
    if (env.claim.out === "landed") {
      landed++;
      heaviest = Math.max(heaviest, env.claim.w);
    }
  }
  assert.ok(landed > 0);
  const body = { playerId: p, name: "Wren", date, water: s.water, run: { days: 3, fishEaten: landed, biggest: heaviest }, log };
  const good = await handleSurvivalBoard(sql, post(body));
  assert.equal(good.status, 200, JSON.stringify(good.body));
  assert.equal(good.body.rank, 1);
  const board = await handleSurvivalBoard(sql, get(`/api/survival-board?date=${date}&water=${s.water}&around=${p}`));
  const rows = board.body.rows as { name: string; days: number; you: boolean }[];
  assert.equal(rows[0].name, "Wren");
  assert.equal(rows[0].days, 3);
  assert.equal(rows[0].you, true);
  const tampered = log.map((e, i) => (i === 0 ? { ...e, castIndex: 0, spot: spotsOf(ev.water).find((x) => x.id !== e.spot)!.id } : e));
  const bad1 = await handleSurvivalBoard(sql, post({ ...body, playerId: idOf(51), log: tampered }));
  assert.equal(bad1.status, 422);
  const bad2 = await handleSurvivalBoard(sql, post({ ...body, playerId: idOf(52), run: { days: 3, fishEaten: landed + 5, biggest: heaviest } }));
  assert.equal(bad2.status, 422);
  const bad3 = await handleSurvivalBoard(sql, post({ ...body, playerId: idOf(53), run: { days: 40, fishEaten: landed, biggest: heaviest } }));
  assert.equal(bad3.status, 422);
  const bad4 = await handleSurvivalBoard(sql, post({ ...body, playerId: idOf(54), run: { days: 3, fishEaten: landed, biggest: heaviest + 3 } }));
  assert.equal(bad4.status, 422);
  const old = await handleSurvivalBoard(sql, post({ ...body, playerId: idOf(55), date: "2026-10-20" }));
  assert.equal(old.status, 410 === old.status ? 410 : 400);
  const wrongWater = await handleSurvivalBoard(sql, post({ ...body, playerId: idOf(56), water: 6 }));
  assert.equal(wrongWater.status, 400);
  /* A better run replaces a worse one; a worse one does not replace a better one. */
  const better = await handleSurvivalBoard(sql, post({ ...body, run: { days: 5, fishEaten: landed, biggest: heaviest } }));
  assert.equal(better.body.improved, true);
  const worse = await handleSurvivalBoard(sql, post({ ...body, run: { days: 2, fishEaten: landed, biggest: heaviest } }));
  assert.equal(worse.body.improved, false);
  assert.equal(((await handleSurvivalBoard(sql, get(`/api/survival-board?date=${date}&water=${s.water}`))).body.rows as { days: number }[])[0].days, 5);
  assert.equal((await handleSurvivalBoard(sql, get("/api/survival-board?date=nope"))).status, 400);
});

test("rtc: rooms and signals live in the database and keep the old wire contract", async () => {
  const t = NOW;
  const poll = (room: string, peer: string, since = 0, now = t, name = peer) =>
    handleRtc(sql, get(`/api/rtc?room=${room}&peer=${peer}&name=${name}&since=${since}`, now));
  const a = await poll("t-room", "alice");
  assert.deepEqual(a.body.peers, [{ id: "alice", name: "alice" }]);
  const b = await poll("t-room", "bob");
  assert.deepEqual((b.body.peers as { id: string }[]).map((p) => p.id), ["alice", "bob"]);
  assert.equal((await handleRtc(sql, post({ op: "signal", room: "t-room", from: "alice", to: "bob", kind: "offer", payload: { sdp: "x" } }, t))).status, 200);
  assert.equal((await handleRtc(sql, post({ op: "signal", room: "t-room", from: "bob", to: "alice", kind: "ice", payload: [1, 2] }, t))).status, 200);
  const inbox = await poll("t-room", "bob");
  const sigs = inbox.body.signals as { id: number; from: string; kind: string; payload: unknown }[];
  assert.equal(sigs.length, 1);
  assert.deepEqual([sigs[0].from, sigs[0].kind, sigs[0].payload], ["alice", "offer", { sdp: "x" }]);
  assert.equal(((await poll("t-room", "bob", sigs[0].id)).body.signals as unknown[]).length, 0, "since skips what you have seen");
  assert.equal(((await poll("t-room", "alice")).body.signals as unknown[]).length, 1);
  /* Another room is separate; stale peers are pruned. */
  assert.equal((await poll("other", "carol")).body.peers!.constructor, Array);
  const later = await poll("t-room", "bob", 0, t + 30_000);
  assert.deepEqual((later.body.peers as { id: string }[]).map((p) => p.id), ["bob"], "alice stopped polling and is gone");
  /* leave drops the peer and what was addressed to it. */
  await handleRtc(sql, post({ op: "leave", room: "t-room", peer: "bob" }, t + 31_000));
  const after_ = await poll("t-room", "dave", 0, t + 31_500);
  assert.deepEqual((after_.body.peers as { id: string }[]).map((p) => p.id), ["dave"]);
  /* Old signals expire; errors keep their old words. */
  await handleRtc(sql, post({ op: "signal", room: "t-room", from: "x", to: "dave", kind: "offer", payload: 1 }, t + 31_500));
  assert.equal(((await poll("t-room", "dave", 0, t + 31_600)).body.signals as unknown[]).length, 1);
  assert.equal(((await poll("t-room", "dave", 0, t + 31_600 + 125_000)).body.signals as unknown[]).length, 0);
  assert.equal((await handleRtc(sql, get("/api/rtc?room=r", t))).status, 400);
  assert.equal((await handleRtc(sql, post({ op: "signal", room: "r", from: "a" }, t))).status, 400);
  assert.equal((await handleRtc(sql, post({ op: "zap", room: "r" }, t))).status, 400);
  assert.equal((await handleRtc(sql, post({ op: "leave" }, t))).status, 400);
});

test("rtc: a room keeps at most its newest 400 signals", async () => {
  const t = NOW + 5_000_000;
  for (let i = 0; i < 405; i++) await handleRtc(sql, post({ op: "signal", room: "flood", from: "a", to: "b", kind: "ice", payload: i }, t));
  const rows = await sql.query<{ n: number }>("select count(*)::int as n from signals where room = 'flood'");
  assert.equal(rows[0].n, 400);
  const first = await sql.query<{ payload: number }>("select payload from signals where room = 'flood' order by id limit 1");
  assert.equal(first[0].payload, 5);
});

test("limits: too many writes from one address in a minute get a 429", async () => {
  const q = quickAt(NOW);
  let last: ApiRes | null = null;
  for (let i = 0; i < 42; i++) last = await handleEntry(sql, post({ op: "join", eventId: q.id, playerId: idOf(500) }, NOW + 90 * DAY / 90, "9.9.9.9"));
  assert.equal(last!.status, 429);
  assert.equal(last!.body.verdict, "rate");
});
