/* WP-8 on a real (embedded) Postgres: Regulars on a short board, friends and invites, team events, results and trophies,
   and the anti-abuse limits. Two simulated players and more. No Neon needed. */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Sql } from "@/lib/db";
import { decentPlayer, recordCast, type Choice, type Envelope, type ReplayEvent } from "@/game/replay";
import { quickAt } from "@/game/schedule";
import { spotsOf } from "@/game/spots";
import { applyResults, readResults, TEAM_MAX } from "@/game/social";
import { handleBoard } from "./board.server.ts";
import { handleTrophies } from "./awards.server.ts";
import type { ApiReq, ApiRes } from "./common.server.ts";
import { handleCatch, handleEntry } from "./entries.server.ts";
import { handleEvents } from "./events.server.ts";
import { CODE_TRIES_PER_MINUTE, handleFriends } from "./friends.server.ts";
import { testSql } from "./testing.server.ts";

let sql: Sql;
let close: () => Promise<void>;
before(async () => {
  ({ sql, close } = await testSql());
});
after(async () => close());

let ipN = 0;
const NOW = Date.UTC(2026, 10, 2, 13, 5, 0); // five minutes into the 13:00 Quick
const get = (path: string, now = NOW, ip = `10.1.0.${++ipN}`): ApiReq => ({ method: "GET", url: new URL(`http://x${path}`), ip, now });
const post = (body: unknown, now = NOW, ip = `10.1.1.${++ipN}`): ApiReq => ({ method: "POST", url: new URL("http://x/"), body, ip, now });
const pid = (n: number) => `social-${String(n).padStart(4, "0")}-wxyz`;

const join = (eventId: string, playerId: string, now = NOW, name = "Casey", extra: Record<string, unknown> = {}) =>
  handleEntry(sql, post({ op: "join", eventId, playerId, name, ...extra }, now));

function choice(water: number, n: number): Choice {
  const spots = spotsOf(water);
  return { spot: spots[n % spots.length].id, p: { family: "worm", depth: 1, retrieve: "slow" }, drag: 1, hookMs: 220 };
}
const evOf = (e: { id: string; seed: number; water: number; startsAt: number }): ReplayEvent => ({ id: e.id, seed: e.seed, water: e.water, startsAt: e.startsAt });

/** Join and play `count` honest casts, one every 30 s of server time. */
async function fish(eventId: string, playerId: string, count: number, start: number, extra: Record<string, unknown> = {}) {
  const j = await join(eventId, playerId, start, "Casey", extra);
  assert.equal(j.status, 200, JSON.stringify(j.body));
  const ev = evOf({ id: eventId, seed: j.body.seed as number, water: j.body.water as number, startsAt: j.body.startsAt as number });
  let now = start;
  let idx = Number(j.body.nextCast);
  const out: ApiRes[] = [];
  for (let n = 0; n < count; n++) {
    const env: Envelope = recordCast(ev, playerId, idx, now, choice(ev.water, idx), decentPlayer());
    now += 30_000;
    const r = await handleCatch(sql, post({ eventId, playerId, envelope: env }, now));
    out.push(r);
    idx = Number(r.body.nextCast);
  }
  return { out, now };
}

const friends = (playerId: string, now = NOW) => handleFriends(sql, get(`/api/friends?playerId=${playerId}`, now));
const act = (body: Record<string, unknown>, now = NOW, ip?: string) => handleFriends(sql, post(body, now, ip));

type FriendView = { me: { code: string; name: string }; friends: { code: string; name: string; online: boolean; fishing: { id: string } | null }[]; invites: { id: number; from: { code: string; name: string }; event: { id: string } }[] };

/* ── Regulars ────────────────────────────────────────────────────────────── */

test("a lone angler on a Quick board has five Regulars beside them, ranked together and marked as Regulars", async () => {
  const q = quickAt(NOW);
  await handleEvents(sql, get("/api/events?scope=open"));
  const me = pid(1);
  const { out } = await fish(q.id, me, 3, NOW);
  assert.ok(out.every((r) => r.body.verdict === "ok"));
  assert.equal(out[2].body.entrants, 6);
  const b = await handleBoard(sql, get(`/api/board?eventId=${q.id}&around=${me}`, NOW + 240_000));
  assert.equal(b.status, 200);
  const rows = b.body.rows as { rank: number; name: string; you: boolean; rival?: boolean; portrait?: string; score: number }[];
  assert.equal(rows.length, 6);
  assert.equal(rows.filter((r) => r.rival).length, 5);
  assert.ok(rows.filter((r) => r.rival).every((r) => r.portrait && r.name));
  assert.equal(rows.filter((r) => r.you).length, 1);
  assert.equal(b.body.humans, 1);
  assert.equal(b.body.entrants, 6);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].score >= rows[i].score, "sorted best first");
  const mine = b.body.me as { rank: number };
  assert.equal(mine.rank, out[2].body.rank, "the rank on the board and in the catch reply agree");
});

test("Regulars step aside as people join and never appear on a Daily or a private board", async () => {
  const q = quickAt(NOW + 3_600_000);
  const t = NOW + 3_600_000 + 60_000;
  await handleEvents(sql, get("/api/events?scope=open", t));
  for (let i = 0; i < 4; i++) await join(q.id, pid(20 + i), t);
  const four = await handleBoard(sql, get(`/api/board?eventId=${q.id}`, t + 5000));
  assert.equal((four.body.rows as { rival?: boolean }[]).filter((r) => r.rival).length, 2, "four anglers + two Regulars = six names");
  for (let i = 4; i < 7; i++) await join(q.id, pid(20 + i), t);
  const seven = await handleBoard(sql, get(`/api/board?eventId=${q.id}`, t + 5000));
  assert.equal((seven.body.rows as { rival?: boolean }[]).filter((r) => r.rival).length, 0);
  assert.equal(seven.body.entrants, 7);

  const made = await handleEvents(sql, post({ op: "create", playerId: pid(50), name: "Host", water: 1, minutes: 15, rules: { category: "total" } }, t));
  const pe = `p-${made.body.code as string}`;
  await join(pe, pid(50), t);
  const pb = await handleBoard(sql, get(`/api/board?eventId=${pe}`, t + 1000));
  assert.equal((pb.body.rows as { rival?: boolean }[]).filter((r) => r.rival).length, 0);
});

/* ── Names ───────────────────────────────────────────────────────────────── */

test("rude names and contact details never reach a board or a friend list", async () => {
  const q = quickAt(NOW);
  for (const [n, name] of [[60, "fuck"], [61, "call 5551234567"], [62, "b1tch"], [63, "me@x.com"]] as const) {
    const r = await join(q.id, pid(n), NOW, name);
    assert.match(String(r.body.name), /^Angler [0-9A-Z]{4}$/, name);
  }
  const hi = await act({ op: "hello", playerId: pid(64), name: "sh1t" });
  assert.match((hi.body as unknown as FriendView).me.name, /^Angler /);
  const fine = await act({ op: "hello", playerId: pid(64), name: "Bass Pro" });
  assert.equal((fine.body as unknown as FriendView).me.name, "Bass Pro");
});

/* ── Friends ─────────────────────────────────────────────────────────────── */

test("friends: add by code makes you friends both ways; the player id is never shown", async () => {
  const a = pid(100);
  const b = pid(101);
  const va = (await act({ op: "hello", playerId: a, name: "Ann" })).body as unknown as FriendView;
  const vb = (await act({ op: "hello", playerId: b, name: "Ben" })).body as unknown as FriendView;
  assert.match(va.me.code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.notEqual(va.me.code, vb.me.code);
  assert.equal(((await friends(a)).body as unknown as FriendView).me.code, va.me.code, "the code is stable");

  const added = await act({ op: "add", playerId: b, code: va.me.code.toLowerCase() });
  assert.equal(added.status, 200);
  const seenByB = added.body as unknown as FriendView;
  assert.deepEqual(seenByB.friends.map((f) => f.name), ["Ann"]);
  const seenByA = (await friends(a)).body as unknown as FriendView;
  assert.deepEqual(seenByA.friends.map((f) => f.name), ["Ben"]);
  assert.ok(!JSON.stringify(seenByA).includes(b) && !JSON.stringify(seenByB).includes(a), "ids stay secret");
  /* Adding again changes nothing. */
  assert.equal(((await act({ op: "add", playerId: b, code: va.me.code })).body as unknown as FriendView).friends.length, 1);

  assert.equal((await act({ op: "add", playerId: a, code: va.me.code })).body.error, "that_is_you");
  assert.equal((await act({ op: "add", playerId: a, code: "ZZZZZZ" })).status, 404);
  assert.equal((await act({ op: "add", playerId: a, code: "ABC" })).status, 400);
  assert.equal((await act({ op: "add", playerId: "short", code: "ABCDEF" })).status, 400);
  assert.equal((await act({ op: "wat", playerId: a })).status, 400);

  const gone = (await act({ op: "remove", playerId: a, code: vb.me.code })).body as unknown as FriendView;
  assert.equal(gone.friends.length, 0);
  assert.equal(((await friends(b)).body as unknown as FriendView).friends.length, 0, "removal goes both ways");
});

test("friends: presence shows who is around and which event they are fishing", async () => {
  const a = pid(110);
  const b = pid(111);
  const va = (await act({ op: "hello", playerId: a, name: "Cleo" })).body as unknown as FriendView;
  await act({ op: "hello", playerId: b, name: "Dan" });
  await act({ op: "add", playerId: b, code: va.me.code });
  const q = quickAt(NOW);
  let seen = ((await friends(b, NOW + 5000)).body as unknown as FriendView).friends[0];
  assert.equal(seen.online, true);
  assert.equal(seen.fishing, null);
  await join(q.id, a, NOW + 6000);
  seen = ((await friends(b, NOW + 8000)).body as unknown as FriendView).friends[0];
  assert.equal(seen.fishing?.id, q.id);
  /* Asking about the board is the heartbeat while fishing. */
  await handleBoard(sql, get(`/api/board?eventId=${q.id}&around=${a}`, NOW + 60_000));
  assert.equal(((await friends(b, NOW + 100_000)).body as unknown as FriendView).friends[0].online, true);
  /* Silent for two minutes: offline, and no longer "fishing". */
  seen = ((await friends(b, NOW + 300_000)).body as unknown as FriendView).friends[0];
  assert.equal(seen.online, false);
  assert.equal(seen.fishing, null);
});

test("friends: invites need friendship, a joined inviter and a live event; joining answers them", async () => {
  const a = pid(120);
  const b = pid(121);
  const c = pid(122);
  const va = (await act({ op: "hello", playerId: a, name: "Eve" })).body as unknown as FriendView;
  const vb = (await act({ op: "hello", playerId: b, name: "Finn" })).body as unknown as FriendView;
  const vc = (await act({ op: "hello", playerId: c, name: "Gus" })).body as unknown as FriendView;
  await act({ op: "add", playerId: b, code: va.me.code });
  const q = quickAt(NOW);
  const early = await act({ op: "invite", playerId: a, code: vb.me.code, eventId: q.id });
  assert.equal(early.body.error, "join_first");
  await join(q.id, a, NOW, "Eve");
  assert.equal((await act({ op: "invite", playerId: a, code: vc.me.code, eventId: q.id })).body.error, "not_friends");
  assert.equal((await act({ op: "invite", playerId: a, code: vb.me.code, eventId: "nope-nope" })).status, 410);
  const sent = await act({ op: "invite", playerId: a, code: vb.me.code, eventId: q.id });
  assert.equal(sent.status, 200);
  await act({ op: "invite", playerId: a, code: vb.me.code, eventId: q.id }); // again: still one
  const inbox = ((await friends(b)).body as unknown as FriendView).invites;
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].from.name, "Eve");
  assert.equal(inbox[0].event.id, q.id);
  assert.equal(((await friends(a)).body as unknown as FriendView).invites.length, 0, "the inviter has nothing in their own inbox");

  await join(q.id, b, NOW + 1000, "Finn");
  assert.equal(((await friends(b, NOW + 2000)).body as unknown as FriendView).invites.length, 0, "joining answers the invite");

  /* An invite dies with its event, and can be waved away. */
  await act({ op: "invite", playerId: a, code: vb.me.code, eventId: q.id }, NOW + 3000);
  assert.equal(((await friends(b, NOW + 4000)).body as unknown as FriendView).invites.length, 1);
  assert.equal(((await friends(b, q.endsAt + 1000)).body as unknown as FriendView).invites.length, 0);
  const again = ((await friends(b, NOW + 5000)).body as unknown as FriendView).invites;
  assert.equal(((await act({ op: "dismiss", playerId: b, inviteId: again[0].id }, NOW + 6000)).body as unknown as FriendView).invites.length, 0);
});

test("friends: guessing codes is slowed down per address, and actions per player", async () => {
  const a = pid(130);
  await act({ op: "hello", playerId: a, name: "Hal" });
  const ip = "9.9.9.9";
  const codes: number[] = [];
  for (let i = 0; i < CODE_TRIES_PER_MINUTE + 3; i++) codes.push((await act({ op: "add", playerId: a, code: "ZZZZZZ" }, NOW + 7_200_000, ip)).status);
  assert.ok(codes.slice(0, CODE_TRIES_PER_MINUTE).every((s) => s === 404), "the first tries get an honest answer");
  assert.ok(codes.slice(CODE_TRIES_PER_MINUTE).every((s) => s === 429), "then slow down");
  const spam: number[] = [];
  for (let i = 0; i < 25; i++) spam.push((await act({ op: "hello", playerId: pid(131), name: "Ivy" }, NOW + 9_000_000)).status);
  assert.equal(spam.filter((s) => s === 429).length > 0, true);
});

/* ── Teams ───────────────────────────────────────────────────────────────── */

test("team events: pick a preset team, four to a team, the board adds each team's weight", async () => {
  const t0 = NOW + 10_000_000;
  const made = await handleEvents(sql, post({ op: "create", playerId: pid(200), name: "Coach", water: 2, minutes: 20, rules: { team: true, category: "big" } }, t0));
  assert.equal(made.status, 200);
  const info = made.body.event as { id: string; team: boolean; category: string; code: string };
  assert.equal(info.team, true);
  assert.equal(info.category, "total", "a team event always adds up Total Weight");
  assert.equal(info.code, (made.body.code as string));
  const id = info.id;

  assert.equal((await join(id, pid(201), t0)).body.error, "pick_a_team");
  assert.equal((await join(id, pid(201), t0, "Zed", { team: "hax" })).body.error, "pick_a_team");
  for (let i = 0; i < TEAM_MAX; i++) assert.equal((await join(id, pid(210 + i), t0, `Otter ${i}`, { team: "otters" })).status, 200);
  const full = await join(id, pid(220), t0, "Late", { team: "otters" });
  assert.equal(full.status, 409);
  assert.equal(full.body.error, "team_full");
  const ok = await join(id, pid(220), t0, "Late", { team: "pike" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.team, "pike");
  /* Rejoining keeps your team, even if you ask for another. */
  assert.equal((await join(id, pid(220), t0 + 1000, "Late", { team: "frogs" })).body.team, "pike");

  /* Fish: two otters and the pike. */
  await fish(id, pid(210), 3, t0 + 60_000);
  await fish(id, pid(211), 3, t0 + 60_000);
  await fish(id, pid(220), 3, t0 + 60_000);
  const b = await handleBoard(sql, get(`/api/board?eventId=${id}&around=${pid(220)}`, t0 + 400_000));
  assert.equal(b.status, 200);
  const teams = b.body.teams as { team: string; rank: number; score: number; members: number; you: boolean }[];
  assert.deepEqual(teams.map((t) => t.team).sort(), ["otters", "pike"]);
  const rows = b.body.rows as { team?: string; score: number }[];
  const otterSum = rows.filter((r) => r.team === "otters").reduce((a, r) => a + r.score, 0);
  const otters = teams.find((t) => t.team === "otters")!;
  assert.ok(Math.abs(otters.score - otterSum) < 1e-6, "team weight is the sum of its members");
  assert.equal(otters.members, 4);
  assert.equal(teams.find((t) => t.team === "pike")!.you, true);
  assert.equal(teams[0].rank, 1);
});

/* ── Results, medals and trophies ────────────────────────────────────────── */

test("results: the first look after the end writes final standings once; medals follow the board", async () => {
  const q = quickAt(NOW + 7_200_000);
  const t = q.startsAt + 60_000;
  await handleEvents(sql, get("/api/events?scope=open", t));
  const a = pid(300);
  const b = pid(301);
  await fish(q.id, a, 4, t);
  await fish(q.id, b, 1, t);
  const end = q.endsAt + 5000;
  assert.equal((await handleBoard(sql, get(`/api/board?eventId=${q.id}&final=1`, t))).status, 409, "not over yet");

  const fin = await handleBoard(sql, get(`/api/board?eventId=${q.id}&final=1&around=${a}`, end));
  assert.equal(fin.status, 200);
  const finRows = fin.body.rows as { rank: number; name: string; rival?: boolean }[];
  assert.ok(finRows.length >= 3);
  const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from event_final where event_id = $1", [q.id]);
  assert.equal(n, 1);

  const ra = (await handleTrophies(sql, get(`/api/trophies?playerId=${a}`, end))).body.results as { id: string; rank: number; entrants: number; medal: number; at: number; title: string; kind: string }[];
  const rb = (await handleTrophies(sql, get(`/api/trophies?playerId=${b}`, end))).body.results as typeof ra;
  assert.equal(ra.length, 1);
  assert.equal(ra[0].id, q.id);
  assert.equal(ra[0].entrants, 2 + 4, "two anglers and four Regulars");
  assert.equal(ra[0].at, q.endsAt);
  assert.equal(ra[0].kind, "quick");
  for (const r of [ra[0], rb[0]]) assert.equal(r.medal, r.rank <= 3 ? r.rank : 0, "gold, silver, bronze for the top three");
  assert.ok(ra[0].rank <= rb[0].rank || ra[0].rank === rb[0].rank, "the angler with more casts is not behind");
  const rows = await sql.query("select 1 from results where event_id = $1", [q.id]);
  assert.equal(rows.length, 2);
  /* Idempotent: asking again writes nothing new. */
  await handleTrophies(sql, get(`/api/trophies?playerId=${a}`, end + 1000));
  assert.equal((await sql.query("select 1 from results where event_id = $1", [q.id])).length, 2);

  /* The client files them into its cabinet. */
  const cab = applyResults({ trophies: [], titles: [], tourneyHistory: [], bobberSkin: "plain" }, readResults(ra));
  assert.equal(cab.tourneyHistory.length, 1);
  assert.equal(cab.trophies.length, ra[0].medal ? 1 : 0);
});

test("results: nobody medals for catching nothing, or for being alone in a private event", async () => {
  const t = NOW + 20_000_000;
  const made = await handleEvents(sql, post({ op: "create", playerId: pid(400), name: "Solo", water: 0, minutes: 10 }, t));
  const id = `p-${made.body.code as string}`;
  await fish(id, pid(400), 3, t);
  const after = t + 11 * 60_000;
  const r = (await handleTrophies(sql, get(`/api/trophies?playerId=${pid(400)}`, after))).body.results as { medal: number; entrants: number }[];
  assert.equal(r.length, 1);
  assert.equal(r[0].entrants, 1);
  assert.equal(r[0].medal, 0);

  const q = quickAt(NOW + 30_000_000);
  await handleEvents(sql, get("/api/events?scope=open", q.startsAt + 500));
  await join(q.id, pid(410), q.startsAt + 1000);
  const none = (await handleTrophies(sql, get(`/api/trophies?playerId=${pid(410)}`, q.endsAt + 1000))).body.results as { medal: number; score: number }[];
  assert.equal(none[0].score, 0);
  assert.equal(none[0].medal, 0, "a zero score is not on the podium");
});

test("results: team medals go to every member of the winning team", async () => {
  const t0 = NOW + 40_000_000;
  const made = await handleEvents(sql, post({ op: "create", playerId: pid(500), name: "Cap", water: 0, minutes: 10, rules: { team: true } }, t0));
  const id = `p-${made.body.code as string}`;
  await fish(id, pid(501), 4, t0, { team: "otters" });
  await fish(id, pid(502), 4, t0, { team: "otters" });
  await fish(id, pid(503), 1, t0, { team: "gulls" });
  const end = t0 + 11 * 60_000;
  const b = await handleBoard(sql, get(`/api/board?eventId=${id}&final=1`, end));
  const teams = b.body.teams as { team: string; rank: number; score: number }[];
  const results = new Map<string, { medal: number; team: string }>();
  for (const p of [501, 502, 503]) {
    const r = (await handleTrophies(sql, get(`/api/trophies?playerId=${pid(p)}`, end))).body.results as { medal: number; team: string }[];
    results.set(String(p), r[0]);
  }
  assert.equal(results.get("501")!.medal, results.get("502")!.medal, "teammates share a medal");
  const otters = teams.find((t) => t.team === "otters")!;
  assert.equal(results.get("501")!.medal, otters.score > 0 ? otters.rank : 0);
  assert.equal(results.get("501")!.team, "otters");
});

test("trophies: needs a player id and is read-only", async () => {
  assert.equal((await handleTrophies(sql, get("/api/trophies?playerId=x"))).status, 400);
  assert.equal((await handleTrophies(sql, post({}))).status, 405);
  const empty = await handleTrophies(sql, get(`/api/trophies?playerId=${pid(999)}`));
  assert.deepEqual(empty.body.results, []);
});

test("events list: a player's own private events show up under privates, others' do not", async () => {
  const t = NOW + 50_000_000;
  const host = pid(600);
  const made = await handleEvents(sql, post({ op: "create", playerId: host, name: "Hosty", water: 4, minutes: 30 }, t));
  const id = `p-${made.body.code as string}`;
  const mine = await handleEvents(sql, get(`/api/events?scope=open&playerId=${host}`, t));
  assert.deepEqual((mine.body.privates as { id: string }[]).map((e) => e.id), [id]);
  const theirs = await handleEvents(sql, get(`/api/events?scope=open&playerId=${pid(601)}`, t));
  assert.deepEqual(theirs.body.privates, []);
  await join(id, pid(601), t);
  const joined = await handleEvents(sql, get(`/api/events?scope=open&playerId=${pid(601)}`, t));
  assert.equal((joined.body.privates as unknown[]).length, 1);
});
