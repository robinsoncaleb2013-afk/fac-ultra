/* The fish-fight matchmaker: POST /api/fight-queue (docs/architecture/06 §1.2).

   Update Three's fish-fight rooms shipped with the queue living in a WebRTC lobby room:
   every device kept its own copy of the queue and paired anglers locally. That raced
   whenever two devices heard the joins in a different order, and Kids Mode was refused
   only by the client's own say-so. The queue now lives here, in two small tables
   (migrations/0013_fight_queue.sql), and this handler is the one queue every device
   agrees on:

     POST {op:"join", playerId, name, fishId, kid}   join the queue (idempotent while matched)
     POST {op:"status", playerId}                    the heartbeat: refreshes your place, reports where you stand
     POST {op:"leave", playerId}                     leave the queue, or dissolve your unclaimed match

   join and status answer the same standing:
     { state: "waiting", waiting }                              still in line (waiting = anglers in line)
     { state: "matched", match: { room, seed, you, opponent } } paired — go and fight
     { state: "off" }                                           not in the queue (status only)

   The fight itself — ready taps, input runs, chat — still rides the peer room named by
   fightroom.ts's roomNameFor, exactly as before; this handler only pairs people and
   never sees a cast, so nothing here can touch a tournament score.

   Kids Mode is refused HERE, by the server, in fightroom.ts's own words (KID_PROBLEM):
   the join carries the device's kid flag (kid.ts's kidActive — Kid Mode is a lens on
   the device, so there is no account flag for the server to look up instead), and a
   flagged join is turned away before anything is written. A kid-mode device never
   enters the queue, so it can never be paired, whatever its UI does. The rest of
   fightroom.ts's refusal words (already waiting, queue full) are answered the same
   way, as a `problem` field next to the error code, so the screen can show them as-is.

   Pairing is fightroom.ts's own rule — join order, ties broken by id — run over the
   table: the two longest-waiting anglers pair, and the match takes matchSeedFor's seed
   and roomNameFor's room name, so both devices build the very room the pure machine
   would have built, with the same shared seed. The fish is chosen by id from
   fightroom.ts's ready-made FIGHT_FISH, so the stats a fighter brings are the game's
   own, never numbers the client made up. */

import type { Sql } from "@/lib/db";
import { fightFishOf, KID_PROBLEM, matchSeedFor, QUEUE_MAX, roomNameFor, wireFishOf, type WireFish } from "@/game/fightroom";
import { asObject, cleanId, cleanName, fail, MS, ok, readGuard, TS, writeGuard, type ApiReq, type ApiRes } from "./common.server.ts";

/** A waiting angler who has not polled for this long is treated as gone (the client polls every 2 s). */
export const QUEUE_TTL_MS = 15_000;
/** A match that sits unclaimed this long is dissolved. An angler who did claim it keeps
    their local room; the fight is peer-to-peer from there and the screen lets them leave. */
export const MATCH_TTL_MS = 60_000;
/** A requeue (your partner left a waiting room) may reclaim a join time at most this far back. */
const REQUEUE_MAX_AGE_MS = 10 * 60_000;

type QueueRow = { player_id: string; name: string; fish: WireFish; joined_ms: number };
type MatchRow = {
  room: string;
  a_id: string;
  b_id: string;
  a_name: string;
  b_name: string;
  a_fish: WireFish;
  b_fish: WireFish;
  a_at: number;
  b_at: number;
  seed: number;
  a_seen: boolean;
  b_seen: boolean;
};

const MATCH_COLUMNS = "room, a_id, b_id, a_name, b_name, a_fish, b_fish, a_at, b_at, seed, a_seen, b_seen";

async function matchOf(sql: Sql, playerId: string): Promise<MatchRow | null> {
  const rows = await sql.query<MatchRow>(`select ${MATCH_COLUMNS} from fight_matches where a_id = $1 or b_id = $1`, [playerId]);
  return rows[0] ?? null;
}

async function waitingCount(sql: Sql): Promise<number> {
  const rows = await sql.query<{ n: number }>("select count(*)::int as n from fight_queue");
  return Number(rows[0]?.n ?? 0);
}

/** Forget waiting anglers who stopped polling, and matches nobody claimed in time. */
async function prune(sql: Sql, now: number) {
  await sql.query(`delete from fight_queue where last_seen < ${TS(1)}`, [now - QUEUE_TTL_MS]);
  await sql.query(`delete from fight_matches where created_at < ${TS(1)}`, [now - MATCH_TTL_MS]);
}

/** Pair the two longest-waiting anglers, again and again, until fewer than two are waiting.
    A lost insert race (two joins pairing at once) just means someone else paired them —
    the unique constraints keep one match per angler either way. */
async function tryPair(sql: Sql, now: number) {
  for (let i = 0; i < 8; i++) {
    const rows = await sql.query<QueueRow>(
      `select player_id, name, fish, ${MS("joined_at")} as joined_ms from fight_queue order by joined_at asc, player_id asc limit 2`,
    );
    if (rows.length < 2) return;
    const [a, b] = rows;
    try {
      await sql.query(
        `insert into fight_matches (room, a_id, b_id, a_name, b_name, a_fish, b_fish, a_at, b_at, seed, created_at)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, ${TS(11)})`,
        [
          roomNameFor(a.player_id, b.player_id),
          a.player_id,
          b.player_id,
          a.name,
          b.name,
          JSON.stringify(a.fish),
          JSON.stringify(b.fish),
          Number(a.joined_ms),
          Number(b.joined_ms),
          matchSeedFor(a.player_id, b.player_id),
          now,
        ],
      );
    } catch {
      return;
    }
    await sql.query("delete from fight_queue where player_id in ($1, $2)", [a.player_id, b.player_id]);
  }
}

function matchedBody(m: MatchRow, playerId: string): ApiRes {
  const you =
    m.a_id === playerId
      ? { id: m.a_id, name: m.a_name, fish: m.a_fish, at: Number(m.a_at) }
      : { id: m.b_id, name: m.b_name, fish: m.b_fish, at: Number(m.b_at) };
  const opponent =
    m.a_id === playerId
      ? { id: m.b_id, name: m.b_name, fish: m.b_fish, at: Number(m.b_at) }
      : { id: m.a_id, name: m.a_name, fish: m.a_fish, at: Number(m.a_at) };
  return ok({ state: "matched", match: { room: m.room, seed: Number(m.seed), you, opponent } });
}

/** Where this angler stands: their match if one is held for them (claimed on the way
    out — once both anglers have it, the row has done its job and is deleted), else
    their place in the queue, else off. */
async function standing(sql: Sql, playerId: string): Promise<ApiRes> {
  const m = await matchOf(sql, playerId);
  if (m) {
    const res = matchedBody(m, playerId);
    const otherSeen = m.a_id === playerId ? m.b_seen : m.a_seen;
    if (otherSeen) {
      await sql.query("delete from fight_matches where room = $1", [m.room]);
    } else {
      await sql.query(`update fight_matches set ${m.a_id === playerId ? "a_seen" : "b_seen"} = true where room = $1`, [m.room]);
    }
    return res;
  }
  const rows = await sql.query<{ player_id: string }>("select player_id from fight_queue where player_id = $1", [playerId]);
  if (rows.length) return ok({ state: "waiting", waiting: await waitingCount(sql) });
  return ok({ state: "off" });
}

async function join(sql: Sql, req: ApiReq, body: Record<string, unknown>, playerId: string): Promise<ApiRes> {
  const limited = await writeGuard(sql, req);
  if (limited) return limited;
  /* Kids Mode: refused by the server, before anything is written (see the header). */
  if (body.kid === true) return fail(403, "kid_mode", { problem: KID_PROBLEM });
  const picked = fightFishOf(body.fishId);
  if (!picked) return fail(400, "bad_fish", { problem: "Pick a fish first." });
  await prune(sql, req.now);
  /* Already paired (a retried join): the match is the answer, like entry's idempotent join. */
  if (await matchOf(sql, playerId)) return standing(sql, playerId);
  const waiting = await sql.query<{ player_id: string }>("select player_id from fight_queue where player_id = $1", [playerId]);
  if (waiting.length) return fail(409, "already_queued", { problem: "You are already in the queue." });
  if ((await waitingCount(sql)) >= QUEUE_MAX) {
    return fail(429, "queue_full", { problem: "The queue is full right now. Try again in a bit." });
  }
  /* A requeue — your partner left a waiting room — may reclaim the join time the match
     was made at, so you keep your place (fightroom.ts's leaveRoom rule). Anything older
     than REQUEUE_MAX_AGE_MS, or in the future, is just "now". */
  const claimed = typeof body.at === "number" && Number.isFinite(body.at) ? Math.round(body.at) : req.now;
  const joinedAt = Math.min(req.now, Math.max(req.now - REQUEUE_MAX_AGE_MS, claimed));
  await sql.query(
    `insert into fight_queue (player_id, name, fish, joined_at, last_seen) values ($1, $2, $3::jsonb, ${TS(4)}, ${TS(5)})`,
    [playerId, cleanName(body.name, "Angler"), JSON.stringify(wireFishOf(picked.fish)), joinedAt, req.now],
  );
  await tryPair(sql, req.now);
  return standing(sql, playerId);
}

async function status(sql: Sql, req: ApiReq, playerId: string): Promise<ApiRes> {
  const limited = await readGuard(sql, req);
  if (limited) return limited;
  /* The poll is the heartbeat: refresh your own row first, so your own poll never prunes you. */
  await sql.query(`update fight_queue set last_seen = ${TS(2)} where player_id = $1`, [playerId, req.now]);
  await prune(sql, req.now);
  await tryPair(sql, req.now);
  return standing(sql, playerId);
}

async function leave(sql: Sql, req: ApiReq, playerId: string): Promise<ApiRes> {
  const limited = await writeGuard(sql, req);
  if (limited) return limited;
  await sql.query("delete from fight_queue where player_id = $1", [playerId]);
  const m = await matchOf(sql, playerId);
  if (m) {
    await sql.query("delete from fight_matches where room = $1", [m.room]);
    /* The match never got going: the other angler goes back in line with the place they
       held when the match was made (fightroom.ts's leaveRoom rule), and may pair at once. */
    const other =
      m.a_id === playerId
        ? { id: m.b_id, name: m.b_name, fish: m.b_fish }
        : { id: m.a_id, name: m.a_name, fish: m.a_fish };
    await sql.query(
      `insert into fight_queue (player_id, name, fish, joined_at, last_seen) values ($1, $2, $3::jsonb, ${TS(4)}, ${TS(5)})
       on conflict (player_id) do nothing`,
      [other.id, other.name, JSON.stringify(other.fish), Math.max(Number(m.a_at), Number(m.b_at)), req.now],
    );
    await tryPair(sql, req.now);
  }
  return ok({ state: "off" });
}

/** POST /api/fight-queue — the fish-fight matchmaker (see the header for the contract). */
export async function handleFightQueue(sql: Sql, req: ApiReq): Promise<ApiRes> {
  if (req.method !== "POST") return fail(405, "post_only");
  const body = asObject(req.body);
  if (!body) return fail(400, "invalid json");
  const playerId = cleanId(body.playerId);
  if (!playerId) return fail(400, "bad_player");
  switch (body.op) {
    case "join":
      return join(sql, req, body, playerId);
    case "status":
      return status(sql, req, playerId);
    case "leave":
      return leave(sql, req, playerId);
    default:
      return fail(400, "unknown_op");
  }
}
