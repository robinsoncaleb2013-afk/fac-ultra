/* The WebRTC signaling relay on database tables instead of an in-memory Map
   (docs/architecture/06 §1.2 rtc.ts, EXPANSION-DESIGN §7). Same wire contract as before:
     GET  /api/rtc?room&peer&name&since   registers the peer (this is also the poll) and returns {peers, signals}
     POST {op:"signal", room, from, to, kind, payload}   queues an offer/answer/ice envelope
     POST {op:"leave", room, peer}                       drops the peer and anything addressed to it
   Rooms and signals live in Postgres, so any number of server instances (and cold starts) agree. */

import type { Sql } from "@/lib/db";
import { asObject, fail, ok, TS, type ApiReq, type ApiRes } from "./common.server.ts";

export const PEER_TTL_MS = 20_000;
export const SIGNAL_TTL_MS = 120_000;
export const MAX_SIGNALS_PER_ROOM = 400;
const MAX_PAYLOAD_CHARS = 32_000;

/** Forget peers that stopped polling, signals that nobody picked up, and anything past the room's cap. */
async function prune(sql: Sql, room: string, now: number) {
  await sql.query(`delete from rooms where room = $1 and last_seen < ${TS(2)}`, [room, now - PEER_TTL_MS]);
  await sql.query(`delete from signals where room = $1 and at < ${TS(2)}`, [room, now - SIGNAL_TTL_MS]);
  await sql.query(
    `delete from signals where room = $1 and id <= coalesce((select id from signals where room = $1 order by id desc offset $2 limit 1), 0)`,
    [room, MAX_SIGNALS_PER_ROOM],
  );
}

export async function handleRtc(sql: Sql, req: ApiReq): Promise<ApiRes> {
  if (req.method === "GET") {
    const q = req.url.searchParams;
    const room = (q.get("room") || "").slice(0, 64);
    const peer = (q.get("peer") || "").slice(0, 64);
    const name = (q.get("name") || "").slice(0, 64);
    const since = Number(q.get("since") || 0) || 0;
    if (!room || !peer) return fail(400, "room and peer are required");
    await prune(sql, room, req.now);
    await sql.query(
      `insert into rooms (room, peer, name, last_seen) values ($1, $2, $3, ${TS(4)})
       on conflict (room, peer) do update set name = excluded.name, last_seen = excluded.last_seen`,
      [room, peer, name, req.now],
    );
    const peers = await sql.query<{ id: string; name: string }>("select peer as id, name from rooms where room = $1 order by peer", [room]);
    const signals = await sql.query<{ id: number; from: string; kind: string; payload: unknown }>(
      `select id, "from", kind, payload from signals where room = $1 and "to" = $2 and id > $3 order by id`,
      [room, peer, since],
    );
    return ok({ peers, signals });
  }

  const body = asObject(req.body);
  if (!body) return fail(400, "invalid json");
  const room = typeof body.room === "string" ? body.room.slice(0, 64) : "";
  if (!room) return fail(400, "room is required");
  await prune(sql, room, req.now);
  if (body.op === "leave") {
    const peer = typeof body.peer === "string" ? body.peer.slice(0, 64) : "";
    if (peer) {
      await sql.query("delete from rooms where room = $1 and peer = $2", [room, peer]);
      await sql.query(`delete from signals where room = $1 and "to" = $2`, [room, peer]);
    }
    return ok({ ok: true });
  }
  if (body.op === "signal") {
    const from = typeof body.from === "string" ? body.from.slice(0, 64) : "";
    const to = typeof body.to === "string" ? body.to.slice(0, 64) : "";
    const kind = typeof body.kind === "string" ? body.kind.slice(0, 24) : "";
    if (!from || !to || !kind) return fail(400, "from, to and kind are required");
    const payload = JSON.stringify(body.payload ?? null);
    if (payload.length > MAX_PAYLOAD_CHARS) return fail(413, "payload too large");
    await sql.query(`insert into signals (room, "from", "to", kind, payload, at) values ($1, $2, $3, $4, $5::jsonb, ${TS(6)})`, [
      room,
      from,
      to,
      kind,
      payload,
      req.now,
    ]);
    await prune(sql, room, req.now);
    return ok({ ok: true });
  }
  return fail(400, "unknown op");
}
