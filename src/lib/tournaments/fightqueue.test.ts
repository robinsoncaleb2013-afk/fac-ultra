/* The fish-fight matchmaker against a real (embedded) Postgres: pairing, claiming,
   leaving, going stale, the queue cap, and every way to be refused — Kids Mode above
   all, refused by the server itself. docs/architecture/06 §1.2. */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Sql } from "@/lib/db";
import { fightFishOf, KID_PROBLEM, matchSeedFor, QUEUE_MAX, roomNameFor, wireFishOf } from "@/game/fightroom";
import { handleFightQueue, MATCH_TTL_MS, QUEUE_TTL_MS } from "./fightqueue.server.ts";
import type { ApiReq } from "./common.server.ts";
import { testSql } from "./testing.server.ts";

let sql: Sql;
let close: () => Promise<void>;
before(async () => {
  ({ sql, close } = await testSql());
});
after(async () => close());

let ipN = 0;
const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);
const post = (body: unknown, now = NOW, ip = `10.9.0.${++ipN}`): ApiReq => ({ method: "POST", url: new URL("http://x/"), body, ip, now });
const idOf = (n: number) => `fighter-${String(n).padStart(4, "0")}-abcd`;

type Match = {
  room: string;
  seed: number;
  you: { id: string; name: string; fish: unknown; at: number };
  opponent: { id: string; name: string; fish: unknown; at: number };
};

/** Each test starts from an empty queue and no held matches (the tables are this handler's whole world). */
async function reset() {
  await sql.query("delete from fight_queue");
  await sql.query("delete from fight_matches");
}

const join = (playerId: string, now = NOW, extra: Record<string, unknown> = {}) =>
  handleFightQueue(sql, post({ op: "join", playerId, name: "Casey", fishId: "perch", ...extra }, now));
const status = (playerId: string, now = NOW) => handleFightQueue(sql, post({ op: "status", playerId }, now));
const leave = (playerId: string, now = NOW) => handleFightQueue(sql, post({ op: "leave", playerId }, now));
const rows = async (table: string) => (await sql.query<{ n: number }>(`select count(*)::int as n from ${table}`))[0].n;

test("two anglers are paired with fightroom's room and seed; a third waits", async () => {
  await reset();
  const a = idOf(1);
  const b = idOf(2);
  const c = idOf(3);
  const first = await join(a, NOW, { fishId: "trout" });
  assert.equal(first.status, 200);
  assert.equal(first.body.state, "waiting");
  assert.equal(first.body.waiting, 1);

  const second = await join(b, NOW + 1000);
  assert.equal(second.status, 200);
  assert.equal(second.body.state, "matched");
  const match = second.body.match as Match;
  assert.equal(match.room, roomNameFor(a, b), "the room both devices work out for themselves");
  assert.equal(match.seed, matchSeedFor(a, b), "the shared seed fightroom would have picked");
  assert.equal(match.you.id, b);
  assert.equal(match.opponent.id, a);
  assert.equal(match.opponent.name, "Casey");
  assert.deepEqual(match.opponent.fish, wireFishOf(fightFishOf("trout")!.fish), "the fish A chose, as wire fish");
  assert.ok(match.opponent.at < match.you.at, "join order is carried, so both devices build the room the same way");

  const third = await join(c, NOW + 2000);
  assert.equal(third.body.state, "waiting");
  assert.equal(third.body.waiting, 1, "only C is in line now");

  /* A picks the match up with a status poll; once both have it, the held row is gone. */
  const claimed = await status(a, NOW + 3000);
  assert.equal(claimed.body.state, "matched");
  assert.equal((claimed.body.match as Match).opponent.id, b);
  assert.equal(await rows("fight_matches"), 0, "a claimed match leaves nothing behind");
  assert.equal((await status(c, NOW + 4000)).body.state, "waiting", "C is still in line");
});

test("pairing is join order across pairs: the two longest-waiting go first", async () => {
  await reset();
  const [a, b, c, d] = [idOf(11), idOf(12), idOf(13), idOf(14)];
  await join(a, NOW);
  await join(b, NOW + 100);
  const third = await join(c, NOW + 200);
  assert.equal(third.body.state, "waiting");
  const fourth = await join(d, NOW + 300);
  assert.equal(fourth.body.state, "matched");
  assert.equal((fourth.body.match as Match).opponent.id, c, "D is paired with C, who was waiting longest");
  const cView = await status(c, NOW + 400);
  assert.equal((cView.body.match as Match).opponent.id, d);
});

test("Kids Mode is refused by the server, in fightroom's words, and never queued", async () => {
  await reset();
  const kid = idOf(21);
  const r = await join(kid, NOW, { kid: true });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, "kid_mode");
  assert.equal(r.body.problem, KID_PROBLEM);
  assert.equal(await rows("fight_queue"), 0, "a kid-mode join writes nothing");
  assert.equal((await status(kid, NOW + 1000)).body.state, "off", "and holds no place to report");

  /* Two grown-up anglers pair with each other — the refused join took no slot. */
  const a = idOf(22);
  const b = idOf(23);
  await join(a, NOW + 2000);
  const paired = await join(b, NOW + 3000);
  assert.equal(paired.body.state, "matched");
  assert.equal((paired.body.match as Match).opponent.id, a);
});

test("the refusal words: bad player, bad fish, already queued, unknown op, GET", async () => {
  await reset();
  assert.equal((await handleFightQueue(sql, post({ op: "join", playerId: "short", fishId: "perch" }))).status, 400);
  const badFish = await join(idOf(31), NOW, { fishId: "shark" });
  assert.equal(badFish.status, 400);
  assert.equal(badFish.body.error, "bad_fish");
  assert.equal(badFish.body.problem, "Pick a fish first.");
  assert.equal((await handleFightQueue(sql, post({ op: "dance", playerId: idOf(31) }))).status, 400);
  assert.equal((await handleFightQueue(sql, { method: "GET", url: new URL("http://x/"), ip: "10.9.9.9", now: NOW })).status, 405);

  const a = idOf(32);
  await join(a, NOW);
  const again = await join(a, NOW + 1000);
  assert.equal(again.status, 409);
  assert.equal(again.body.error, "already_queued");
  assert.equal(again.body.problem, "You are already in the queue.");
});

test("leaving the queue frees the line; leaving a match hands your place back", async () => {
  await reset();
  const a = idOf(41);
  await join(a, NOW);
  assert.equal((await leave(a, NOW + 100)).body.state, "off");
  assert.equal((await status(a, NOW + 200)).body.state, "off");
  assert.equal(await rows("fight_queue"), 0);

  /* A and B are matched by B's join (B has claimed it; A has not). B leaves: the match
     dissolves and A goes back in line, so the next joiner pairs with A. */
  const b = idOf(42);
  const c = idOf(43);
  await join(a, NOW + 1000);
  const paired = await join(b, NOW + 1100);
  assert.equal(paired.body.state, "matched");
  await leave(b, NOW + 1200);
  assert.equal(await rows("fight_matches"), 0, "the unclaimed match is dissolved");
  const next = await join(c, NOW + 1300);
  assert.equal(next.body.state, "matched");
  assert.equal((next.body.match as Match).opponent.id, a, "C pairs with A, who kept their place");
  const aView = await status(a, NOW + 1400);
  assert.equal((aView.body.match as Match).opponent.id, c);
});

test("an angler who stops polling goes stale and is never paired", async () => {
  await reset();
  const a = idOf(51);
  const b = idOf(52);
  await join(a, NOW);
  const late = await join(b, NOW + QUEUE_TTL_MS + 1000);
  assert.equal(late.body.state, "waiting", "B does not pair with a ghost");
  assert.equal(late.body.waiting, 1);
  assert.equal(await rows("fight_queue"), 1, "only B is really in line");
});

test("the status heartbeat keeps your place past the stale limit", async () => {
  await reset();
  const a = idOf(61);
  const b = idOf(62);
  await join(a, NOW);
  assert.equal((await status(a, NOW + 10_000)).body.state, "waiting");
  assert.equal((await status(a, NOW + 20_000)).body.state, "waiting");
  const paired = await join(b, NOW + 25_000);
  assert.equal(paired.body.state, "matched");
  assert.equal((paired.body.match as Match).opponent.id, a, "A is still there to be paired");
});

test("an unclaimed match dissolves on its own; a claimed fight is left alone", async () => {
  await reset();
  const a = idOf(71);
  const b = idOf(72);
  await join(a, NOW);
  await join(b, NOW + 100); // matched; B has claimed it via the join answer, A never polls
  /* Long after the match window, B's standing no longer reports a match to claim —
     the rendezvous is over — and no ghost is put back in the queue. */
  const late = await status(b, NOW + MATCH_TTL_MS + 1000);
  assert.equal(late.body.state, "off");
  assert.equal(await rows("fight_matches"), 0);
  assert.equal(await rows("fight_queue"), 0);
});

test("a full queue turns the next angler away with the words", async () => {
  await reset();
  const fish = JSON.stringify(wireFishOf(fightFishOf("perch")!.fish));
  for (let i = 0; i < QUEUE_MAX; i++) {
    await sql.query(
      `insert into fight_queue (player_id, name, fish, joined_at, last_seen)
       values ($1, 'Angler', $2::jsonb, to_timestamp(($3::double precision) / 1000.0), to_timestamp(($4::double precision) / 1000.0))`,
      [idOf(1000 + i), fish, NOW + i, NOW],
    );
  }
  const r = await join(idOf(77), NOW + 5000);
  assert.equal(r.status, 429);
  assert.equal(r.body.error, "queue_full");
  assert.equal(r.body.problem, "The queue is full right now. Try again in a bit.");
});
