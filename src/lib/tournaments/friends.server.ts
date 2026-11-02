/* Friends, presence and invites (docs/architecture/06 §3.3, WP-8).

   Identity is still the anonymous browser id (WP-9 adds accounts). That id is a secret: whoever holds it
   can post catches as that player. So friends never see it. Each player has a short public friend code;
   typing a friend's code is the handshake, and the two of you are friends from then on (both directions
   are stored). A friend can see whether you are around and which event you are fishing, and can invite
   you to an event. Nothing else: no messages, no names beyond the one you chose for the boards.

   WP-9 links an account by moving `players.id`; `friends`, `invites` and `results` are keyed by that same
   column, so history and friends follow the player.

   WP-10 adds three more ways in, all of them a request the other player accepts:
     - by player name: "RiverRat#4821" (a name plus the short number the server hands out), with a type-ahead for grown-up account players;
     - by email: we mail a link; the answer to the sender is the same whether or not that address has an account (we never look);
     - the friend code still adds instantly, for people sitting together.
   And Block: the blocked player vanishes from lists and search, cannot ask again, and their emotes are hidden. */

import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "@/lib/db";
import {
  cleanEmail,
  cleanFriendCode,
  cleanHandle,
  friendCodeFrom,
  handleOf,
  INVITE_MS,
  MAX_FRIENDS,
  MAX_INVITES,
  MAX_PENDING,
  ONLINE_MS,
  searchPrefix,
} from "@/game/social";
import { senderFromEnv, type MailSender } from "@/lib/accounts/mail.server.ts";
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
/** Type-ahead and name lookups per address per minute (they are the only way to find strangers by name). */
export const SEARCHES_PER_MINUTE = 30;
/** Email invites: per player per hour, per address per day, and how long the link lasts. */
export const EMAIL_INVITES_PER_HOUR = 5;
export const EMAIL_INVITES_PER_ADDRESS_PER_DAY = 3;
export const EMAIL_INVITE_MS = 7 * 24 * 60 * 60_000;

/* The sender is a function, so tests can watch the mail without sending any. */
let sender: MailSender | null = null;
export function setInviteSender(fn: MailSender | null) {
  sender = fn;
}
const mailer = (): MailSender => sender ?? (sender = senderFromEnv(process.env));

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** The player's row and friend code, made on first use. */
type Me = { code: string; name: string; handle: string };

/** Give the player the short number that makes "Name#1234" unique; keep it unless the name changed under it. */
async function ensureTag(sql: Sql, playerId: string): Promise<number> {
  const [row] = await sql.query<{ name: string; tag: number | null }>("select name, tag from players where id = $1", [playerId]);
  if (!row) return 0;
  if (row.tag != null) {
    const clash = await sql.query("select 1 from players where lower(name) = lower($1) and tag = $2 and id <> $3", [row.name, row.tag, playerId]);
    if (!clash.length) return Number(row.tag);
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const bytes = new Uint8Array(2);
    globalThis.crypto.getRandomValues(bytes);
    const tag = 1000 + ((bytes[0] * 256 + bytes[1]) % 9000);
    const clash = await sql.query("select 1 from players where lower(name) = lower($1) and tag = $2 and id <> $3", [row.name, tag, playerId]);
    if (clash.length) continue;
    await sql.query("update players set tag = $2 where id = $1", [playerId, tag]);
    return tag;
  }
  throw new Error("could not make a name number");
}

async function profile(sql: Sql, playerId: string, name: string | null, now: number): Promise<Me> {
  const base = await profileRow(sql, playerId, name, now);
  const tag = await ensureTag(sql, playerId);
  return { ...base, handle: handleOf(base.name, tag) };
}

async function profileRow(sql: Sql, playerId: string, name: string | null, now: number): Promise<{ code: string; name: string }> {
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

type FriendRaw = { code: string; name: string; tag: number | null; seen_ms: number | null; at_event: string | null; ev_title: string | null; ev_end: number | null };

async function listFor(sql: Sql, playerId: string, now: number) {
  const friends = await sql.query<FriendRaw>(
    `select p.friend_code as code, p.name, p.tag, ${MS("p.last_seen")} as seen_ms, p.at_event, ev.title as ev_title, ${MS("ev.ends_at")} as ev_end
       from friends f join players p on p.id = f.friend_id left join events ev on ev.id = p.at_event
      where f.player_id = $1 and p.friend_code is not null`,
    [playerId],
  );
  const list = friends.map((f) => {
    const online = f.seen_ms != null && now - Number(f.seen_ms) <= ONLINE_MS;
    const fishing = online && f.at_event && f.ev_end != null && Number(f.ev_end) > now ? { id: f.at_event, title: f.ev_title ?? "" } : null;
    return { code: f.code, name: f.name, handle: f.tag != null ? handleOf(f.name, Number(f.tag)) : null, online, fishing };
  });
  list.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));

  await sql.query(`delete from invites where created_at < ${TS(1)}`, [now - INVITE_MS]);
  const invites = await sql.query<{ id: number; code: string; name: string; event_id: string; title: string; water: number; starts: number; ends: number }>(
    `select i.id, p.friend_code as code, p.name, ev.id as event_id, ev.title, ev.water, ${MS("ev.starts_at")} as starts, ${MS("ev.ends_at")} as ends
       from invites i join players p on p.id = i.from_id join events ev on ev.id = i.event_id
      where i.to_id = $1 and ev.ends_at > ${TS(2)}
        and not exists (select 1 from blocks b where b.player_id = $1 and b.blocked_id = i.from_id)
      order by i.created_at desc limit 20`,
    [playerId, now],
  );
  const other = async (q: string): Promise<PersonRaw[]> => sql.query<PersonRaw>(q, [playerId]);
  const person = (r: PersonRaw) => ({ code: r.code, name: r.name, handle: r.tag != null ? handleOf(r.name, Number(r.tag)) : null });
  const incoming = await other(
    `select p.friend_code as code, p.name, p.tag from friend_requests r join players p on p.id = r.from_id
      where r.to_id = $1 and p.friend_code is not null
        and not exists (select 1 from blocks b where b.player_id = $1 and b.blocked_id = r.from_id)
      order by r.created_at desc limit 50`,
  );
  const outgoing = await other(
    `select p.friend_code as code, p.name, p.tag from friend_requests r join players p on p.id = r.to_id
      where r.from_id = $1 and p.friend_code is not null order by r.created_at desc limit 50`,
  );
  const blocked = await other(
    `select p.friend_code as code, p.name, p.tag from blocks b join players p on p.id = b.blocked_id
      where b.player_id = $1 and p.friend_code is not null order by b.created_at desc limit 100`,
  );
  return {
    friends: list,
    requests: { incoming: incoming.map(person), outgoing: outgoing.map(person) },
    blocked: blocked.map(person),
    invites: invites.map((i) => ({
      id: Number(i.id),
      from: { code: i.code, name: i.name },
      event: { id: i.event_id, title: i.title, waterName: BIOMES[Number(i.water)]?.name ?? "", startsAt: Number(i.starts), endsAt: Number(i.ends) },
    })),
  };
}

type PersonRaw = { code: string; name: string; tag: number | null };

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
      /* Someone who blocked you looks exactly like a code nobody has. */
      if (!target[0] || (await blocked(sql, playerId, target[0].id))) return fail(404, "no_such_code");
      const made = await makeFriends(sql, playerId, target[0].id);
      if (!made) return fail(409, "too_many_friends", { max: MAX_FRIENDS });
      return view(sql, playerId, req);
    }

    case "remove": {
      const code = cleanFriendCode(body.code);
      if (!code) return fail(400, "bad_code");
      const target = await idOfCode(sql, code);
      if (target) {
        await sql.query("delete from friends where (player_id = $1 and friend_id = $2) or (player_id = $2 and friend_id = $1)", [playerId, target]);
        await sql.query("delete from invites where (from_id = $1 and to_id = $2) or (from_id = $2 and to_id = $1)", [playerId, target]);
      }
      return view(sql, playerId, req);
    }

    case "search": {
      /* Type-ahead for grown-up account players. Three letters at least, five answers at most, never kids' profiles. */
      if (!(await rateHit(sql, `fs:${req.ip}`, SEARCHES_PER_MINUTE, req.now))) return fail(429, "slow_down");
      const q = searchPrefix(body.q);
      if (!q) return ok({ serverNow: req.now, matches: [] });
      const rows = await sql.query<PersonRaw>(
        `select p.friend_code as code, p.name, p.tag from players p
          where lower(p.name) like $2 and p.tag is not null and p.friend_code is not null and p.id <> $1
            and exists (select 1 from profiles pr where pr.player_id = p.id and not pr.kid)
            and not exists (select 1 from blocks b where (b.player_id = $1 and b.blocked_id = p.id) or (b.player_id = p.id and b.blocked_id = $1))
            and not exists (select 1 from friends f where f.player_id = $1 and f.friend_id = p.id)
          order by p.name limit 5`,
        [playerId, `${q.replace(/[%_\\]/g, "")}%`],
      );
      return ok({ serverNow: req.now, matches: rows.map((r) => ({ handle: handleOf(r.name, Number(r.tag)), name: r.name })) });
    }

    case "request": {
      /* By exact "Name#1234". The other player has to accept. */
      if (!(await rateHit(sql, `fs:${req.ip}`, SEARCHES_PER_MINUTE, req.now))) return fail(429, "slow_down");
      const h = cleanHandle(body.handle);
      if (!h) return fail(400, "bad_handle");
      await profile(sql, playerId, null, req.now);
      const target = await sql.query<{ id: string }>(
        `select p.id from players p where lower(p.name) = lower($1) and p.tag = $2 and exists (select 1 from profiles pr where pr.player_id = p.id)`,
        [h.name, h.tag],
      );
      if (!target[0]) return fail(404, "no_such_player");
      if (target[0].id === playerId) return fail(400, "that_is_you");
      const outcome = await ask(sql, playerId, target[0].id);
      if (outcome === "too_many") return fail(409, "too_many_friends", { max: MAX_FRIENDS });
      return view(sql, playerId, req);
    }

    case "invite_email": {
      /* The answer is the same for every address: we do not look it up, and a refused or over-limit send looks like a sent one. */
      const email = cleanEmail(body.email);
      if (!email) return fail(400, "bad_email");
      const sentLately = await sql.query<{ n: number }>(
        `select count(*)::int as n from friend_invites where from_id = $1 and created_at > ${TS(2)}`,
        [playerId, req.now - 60 * 60_000],
      );
      if (Number(sentLately[0]?.n ?? 0) >= EMAIL_INVITES_PER_HOUR) return fail(429, "slow_down");
      const me = await profile(sql, playerId, null, req.now);
      const addr = sha(email);
      const seen = await sql.query<{ n: number }>(
        `select count(*)::int as n from friend_invites where email_hash = $1 and created_at > ${TS(2)}`,
        [addr, req.now - 24 * 60 * 60_000],
      );
      const token = randomBytes(24).toString("base64url");
      /* Over the per-address cap: record nothing, send nothing, answer the same. */
      if (Number(seen[0]?.n ?? 0) < EMAIL_INVITES_PER_ADDRESS_PER_DAY) {
        await sql.query(
          `insert into friend_invites (token_hash, from_id, email_hash, created_at, expires_at) values ($1, $2, $3, ${TS(4)}, ${TS(5)})`,
          [sha(token), playerId, addr, req.now, req.now + EMAIL_INVITE_MS],
        );
        const base = (process.env.FAC_PUBLIC_URL?.trim() || req.url.origin).replace(/\/$/, "");
        try {
          await mailer()({ to: email, link: `${base}/?friend=${encodeURIComponent(token)}`, minutes: EMAIL_INVITE_MS / 60_000, kind: "invite", from: me.name });
        } catch (err) {
          console.error("[friends] invite email failed:", err instanceof Error ? err.message : err);
        }
      }
      return view(sql, playerId, req);
    }

    case "redeem": {
      /* Someone opened an invite link. It becomes a request from the person who sent it; the opener accepts or not. */
      const token = typeof body.token === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(body.token) ? body.token : null;
      if (!token) return fail(400, "bad_invite");
      if (!(await rateHit(sql, `fr:${req.ip}`, CODE_TRIES_PER_MINUTE, req.now))) return fail(429, "slow_down");
      await profile(sql, playerId, null, req.now);
      const rows = await sql.query<{ from_id: string }>(
        `update friend_invites set used_at = ${TS(2)} where token_hash = $1 and used_at is null and expires_at > ${TS(2)} returning from_id`,
        [sha(token), req.now],
      );
      if (!rows[0]) return fail(410, "invite_expired");
      if (rows[0].from_id !== playerId && !(await blocked(sql, playerId, rows[0].from_id))) {
        const already = await sql.query("select 1 from friends where player_id = $1 and friend_id = $2", [playerId, rows[0].from_id]);
        if (!already.length) {
          await sql.query(
            `insert into friend_requests (from_id, to_id) values ($1, $2) on conflict do nothing`,
            [rows[0].from_id, playerId],
          );
        }
      }
      return view(sql, playerId, req);
    }

    case "accept":
    case "decline":
    case "cancel": {
      const code = cleanFriendCode(body.code);
      if (!code) return fail(400, "bad_code");
      const other = await idOfCode(sql, code);
      if (!other) return view(sql, playerId, req);
      if (body.op === "cancel") {
        await sql.query("delete from friend_requests where from_id = $1 and to_id = $2", [playerId, other]);
      } else {
        const had = await sql.query("delete from friend_requests where from_id = $1 and to_id = $2 returning 1", [other, playerId]);
        if (body.op === "accept" && had.length && !(await blocked(sql, playerId, other))) {
          if (!(await makeFriends(sql, playerId, other))) return fail(409, "too_many_friends", { max: MAX_FRIENDS });
        }
      }
      return view(sql, playerId, req);
    }

    case "block":
    case "unblock": {
      const code = cleanFriendCode(body.code);
      if (!code) return fail(400, "bad_code");
      const other = await idOfCode(sql, code);
      if (other && other !== playerId) {
        if (body.op === "unblock") {
          await sql.query("delete from blocks where player_id = $1 and blocked_id = $2", [playerId, other]);
        } else {
          await sql.query("insert into blocks (player_id, blocked_id) values ($1, $2) on conflict do nothing", [playerId, other]);
          await sql.query("delete from friends where (player_id = $1 and friend_id = $2) or (player_id = $2 and friend_id = $1)", [playerId, other]);
          await sql.query("delete from friend_requests where (from_id = $1 and to_id = $2) or (from_id = $2 and to_id = $1)", [playerId, other]);
          await sql.query("delete from invites where (from_id = $1 and to_id = $2) or (from_id = $2 and to_id = $1)", [playerId, other]);
        }
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

/* ── Small helpers ─────────────────────────────────────────────────────── */

async function idOfCode(sql: Sql, code: string): Promise<string | null> {
  const rows = await sql.query<{ id: string }>("select id from players where friend_code = $1", [code]);
  return rows[0]?.id ?? null;
}

/** Has either player blocked the other? */
async function blocked(sql: Sql, a: string, b: string): Promise<boolean> {
  const rows = await sql.query("select 1 from blocks where (player_id = $1 and blocked_id = $2) or (player_id = $2 and blocked_id = $1)", [a, b]);
  return rows.length > 0;
}

/** Make two players friends both ways and clear any requests between them. False if either list is full. */
async function makeFriends(sql: Sql, a: string, b: string): Promise<boolean> {
  const already = await sql.query("select 1 from friends where player_id = $1 and friend_id = $2", [a, b]);
  if (!already.length) {
    const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from friends where player_id = $1", [a]);
    const [{ m }] = await sql.query<{ m: number }>("select count(*)::int as m from friends where player_id = $1", [b]);
    if (Number(n) >= MAX_FRIENDS || Number(m) >= MAX_FRIENDS) return false;
  }
  await sql.query(`insert into friends (player_id, friend_id) values ($1, $2), ($2, $1) on conflict do nothing`, [a, b]);
  await sql.query("delete from friend_requests where (from_id = $1 and to_id = $2) or (from_id = $2 and to_id = $1)", [a, b]);
  return true;
}

/** Ask `to` to be friends. If they had already asked us, that is a yes on both sides. A blocked ask quietly does nothing. */
async function ask(sql: Sql, from: string, to: string): Promise<"asked" | "friends" | "nothing" | "too_many"> {
  if (await blocked(sql, from, to)) return "nothing";
  const already = await sql.query("select 1 from friends where player_id = $1 and friend_id = $2", [from, to]);
  if (already.length) return "nothing";
  const theirs = await sql.query("select 1 from friend_requests where from_id = $1 and to_id = $2", [to, from]);
  if (theirs.length) return (await makeFriends(sql, from, to)) ? "friends" : "too_many";
  const [{ out }] = await sql.query<{ out: number }>("select count(*)::int as out from friend_requests where from_id = $1", [from]);
  const [{ inn }] = await sql.query<{ inn: number }>("select count(*)::int as inn from friend_requests where to_id = $1", [to]);
  if (Number(out) >= MAX_PENDING || Number(inn) >= MAX_PENDING) return "nothing";
  await sql.query(`insert into friend_requests (from_id, to_id) values ($1, $2) on conflict do nothing`, [from, to]);
  return "asked";
}
