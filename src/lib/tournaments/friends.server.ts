/* Friends, presence and invites (docs/architecture/06 §3.3, WP-8).

   Identity is still the anonymous browser id (WP-9 adds accounts). That id is a secret: whoever holds it
   can post catches as that player. So friends never see it. Each player has a short public friend code;
   typing a friend's code is the handshake, and the two of you are friends from then on (both directions
   are stored). A friend can see whether you are around and which event you are fishing, and can invite
   you to an event. Nothing else: no messages, no names beyond the one you chose for the boards.

   WP-9 links an account by moving `players.id`; `friends`, `invites` and `results` are keyed by that same
   column, so history and friends follow the player. */

import type { Sql } from "@/lib/db";
import { cleanFriendCode, friendCodeFrom, INVITE_MS, MAX_FRIENDS, MAX_INVITES, ONLINE_MS } from "@/game/social";
import { BIOMES } from "@/game/content";
import {
  asObject,
  cleanEventId,
  cleanId,
  cleanName,
  defaultName,
  fail,
  MS,
  ok,
  rateHit,
  readGuard,
  TS,
  writeGuard,
  type ApiReq,
  type ApiRes,
} from "./common.server.ts";

/** Wrong-code guesses per address per minute, and friend actions per player per minute. */
export const CODE_TRIES_PER_MINUTE = 15;
export const FRIEND_ACTIONS_PER_MINUTE = 20;

/** The player's row and friend code, made on first use. */
async function profile(sql: Sql, playerId: string, name: string | null, now: number): Promise<{ code: string; name: string }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    const fresh = friendCodeFrom(bytes);
    const clean = name === null ? null : cleanName(name, defaultName(playerId));
    try {
      const rows = await sql.query<{ code: string; name: string }>(
        `insert into players (id, name, created_at, friend_code, last_seen) values ($1, $2, ${TS(4)}, $3, ${TS(4)})
         on conflict (id) do update
           set friend_code = coalesce(players.friend_code, excluded.friend_code),
               name = case when $5::boolean then excluded.name else players.name end,
               last_seen = excluded.last_seen
         returning friend_code as code, name`,
        [playerId, clean ?? defaultName(playerId), fresh, now, clean !== null],
      );
      if (rows[0]) return rows[0];
    } catch (err) {
      /* Two players drew the same code (the unique index said no): draw again. */
      if (attempt === 7) throw err;
    }
  }
  throw new Error("could not make a friend code");
}

type FriendRaw = { code: string; name: string; seen_ms: number | null; at_event: string | null; ev_title: string | null; ev_end: number | null };

async function listFor(sql: Sql, playerId: string, now: number) {
  const friends = await sql.query<FriendRaw>(
    `select p.friend_code as code, p.name, ${MS("p.last_seen")} as seen_ms, p.at_event, ev.title as ev_title, ${MS("ev.ends_at")} as ev_end
       from friends f join players p on p.id = f.friend_id left join events ev on ev.id = p.at_event
      where f.player_id = $1 and p.friend_code is not null`,
    [playerId],
  );
  const list = friends.map((f) => {
    const online = f.seen_ms != null && now - Number(f.seen_ms) <= ONLINE_MS;
    const fishing = online && f.at_event && f.ev_end != null && Number(f.ev_end) > now ? { id: f.at_event, title: f.ev_title ?? "" } : null;
    return { code: f.code, name: f.name, online, fishing };
  });
  list.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));

  await sql.query(`delete from invites where created_at < ${TS(1)}`, [now - INVITE_MS]);
  const invites = await sql.query<{ id: number; code: string; name: string; event_id: string; title: string; water: number; starts: number; ends: number }>(
    `select i.id, p.friend_code as code, p.name, ev.id as event_id, ev.title, ev.water, ${MS("ev.starts_at")} as starts, ${MS("ev.ends_at")} as ends
       from invites i join players p on p.id = i.from_id join events ev on ev.id = i.event_id
      where i.to_id = $1 and ev.ends_at > ${TS(2)} order by i.created_at desc limit 20`,
    [playerId, now],
  );
  return {
    friends: list,
    invites: invites.map((i) => ({
      id: Number(i.id),
      from: { code: i.code, name: i.name },
      event: { id: i.event_id, title: i.title, waterName: BIOMES[Number(i.water)]?.name ?? "", startsAt: Number(i.starts), endsAt: Number(i.ends) },
    })),
  };
}

const view = async (sql: Sql, playerId: string, req: ApiReq, name: string | null = null): Promise<ApiRes> => {
  const me = await profile(sql, playerId, name, req.now);
  return ok({ serverNow: req.now, me, ...(await listFor(sql, playerId, req.now)) });
};

/** GET /api/friends?playerId=…  ·  POST {op, playerId, …}. Every answer is the whole picture: you, your friends, your invites. */
export async function handleFriends(sql: Sql, req: ApiReq): Promise<ApiRes> {
  if (req.method === "GET") {
    const limited = await readGuard(sql, req);
    if (limited) return limited;
    const playerId = cleanId(req.url.searchParams.get("playerId"));
    if (!playerId) return fail(400, "bad_player");
    return view(sql, playerId, req);
  }

  const limited = await writeGuard(sql, req);
  if (limited) return limited;
  const body = asObject(req.body);
  const playerId = cleanId(body?.playerId);
  if (!body || !playerId) return fail(400, "bad_player");
  if (!(await rateHit(sql, `f:${playerId}`, FRIEND_ACTIONS_PER_MINUTE, req.now))) return fail(429, "slow_down");

  switch (body.op) {
    case "hello":
      return view(sql, playerId, req, typeof body.name === "string" ? body.name : null);

    case "add": {
      const code = cleanFriendCode(body.code);
      /* Guessing codes is the only way to find strangers: keep it slow. */
      if (!(await rateHit(sql, `fc:${req.ip}`, CODE_TRIES_PER_MINUTE, req.now))) return fail(429, "slow_down");
      if (!code) return fail(400, "bad_code");
      const me = await profile(sql, playerId, null, req.now);
      if (me.code === code) return fail(400, "that_is_you");
      const target = await sql.query<{ id: string }>("select id from players where friend_code = $1", [code]);
      if (!target[0]) return fail(404, "no_such_code");
      const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from friends where player_id = $1", [playerId]);
      const [{ m }] = await sql.query<{ m: number }>("select count(*)::int as m from friends where player_id = $1", [target[0].id]);
      const already = await sql.query("select 1 from friends where player_id = $1 and friend_id = $2", [playerId, target[0].id]);
      if (!already.length && (Number(n) >= MAX_FRIENDS || Number(m) >= MAX_FRIENDS)) return fail(409, "too_many_friends", { max: MAX_FRIENDS });
      await sql.query(
        `insert into friends (player_id, friend_id) values ($1, $2), ($2, $1) on conflict do nothing`,
        [playerId, target[0].id],
      );
      return view(sql, playerId, req);
    }

    case "remove": {
      const code = cleanFriendCode(body.code);
      if (!code) return fail(400, "bad_code");
      const target = await sql.query<{ id: string }>("select id from players where friend_code = $1", [code]);
      if (target[0]) {
        await sql.query("delete from friends where (player_id = $1 and friend_id = $2) or (player_id = $2 and friend_id = $1)", [playerId, target[0].id]);
        await sql.query("delete from invites where (from_id = $1 and to_id = $2) or (from_id = $2 and to_id = $1)", [playerId, target[0].id]);
      }
      return view(sql, playerId, req);
    }

    case "invite": {
      const code = cleanFriendCode(body.code);
      const eventId = cleanEventId(body.eventId);
      if (!code) return fail(400, "bad_code");
      if (!eventId) return fail(400, "bad_event");
      const target = await sql.query<{ id: string }>(
        `select p.id from players p join friends f on f.friend_id = p.id and f.player_id = $2 where p.friend_code = $1`,
        [code, playerId],
      );
      if (!target[0]) return fail(403, "not_friends");
      const ev = await sql.query<{ ends: number }>(`select ${MS("ends_at")} as ends from events where id = $1`, [eventId]);
      if (!ev[0] || Number(ev[0].ends) <= req.now) return fail(410, "event_over");
      /* You can only invite people to an event you are in yourself. */
      const mine = await sql.query("select 1 from entries where event_id = $1 and player_id = $2", [eventId, playerId]);
      if (!mine.length) return fail(403, "join_first");
      const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from invites where to_id = $1", [target[0].id]);
      if (Number(n) >= MAX_INVITES) return fail(429, "their_inbox_is_full");
      await sql.query(
        `insert into invites (from_id, to_id, event_id, created_at) values ($1, $2, $3, ${TS(4)})
         on conflict (from_id, to_id, event_id) do update set created_at = excluded.created_at`,
        [playerId, target[0].id, eventId, req.now],
      );
      return view(sql, playerId, req);
    }

    case "dismiss": {
      const id = typeof body.inviteId === "number" && Number.isInteger(body.inviteId) ? body.inviteId : null;
      if (id == null) return fail(400, "bad_invite");
      await sql.query("delete from invites where id = $1 and to_id = $2", [id, playerId]);
      return view(sql, playerId, req);
    }

    default:
      return fail(400, "unknown_op");
  }
}
