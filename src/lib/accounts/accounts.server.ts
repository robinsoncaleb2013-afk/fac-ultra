/* GET/POST /api/account (WP-9): who am I, request a sign-in link, use it, sign out, export my data, delete
   my account. Framework-free: takes a `Sql`, a request and `Deps`. */

import type { Sql } from "@/lib/db";
import { MAX_PROFILES } from "@/game/cloud";
import {
  asObject,
  cleanEmail,
  fail,
  HOUR,
  googleConfigured,
  hashToken,
  LINKS_PER_HOUR_EMAIL,
  LINKS_PER_HOUR_IP,
  MAGIC_MS,
  newId,
  newToken,
  ok,
  sameSite,
  ts,
  VERIFY_PER_HOUR_IP,
  windowHit,
  maskEmail,
  type AccReq,
  type AccRes,
  type Deps,
} from "./common.server.ts";
import { emailProvider } from "./mail.server.ts";
import { endSession, sessionOf, startSession, type Who } from "./session.server.ts";
import { listProfiles } from "./profiles.server.ts";

/** Find or make the account for a verified email, and sign this browser in. Shared by the email link and Google. */
export async function signInEmail(sql: Sql, email: string, req: AccReq): Promise<{ accountId: string; setCookie: string }> {
  const rows = await sql.query<{ id: string }>(
    `insert into accounts (id, email, last_login) values ($1, $2, ${ts(3)})
     on conflict ((lower(email))) do update set last_login = excluded.last_login
     returning id`,
    [newId("acc"), email, req.now],
  );
  const accountId = rows[0].id;
  return { accountId, setCookie: await startSession(sql, accountId, req) };
}

async function me(sql: Sql, who: Who | null, deps: Deps): Promise<AccRes> {
  const providers = { email: true, google: googleConfigured(deps.env), emailDelivery: emailProvider(deps.env) };
  if (!who) return ok({ signedIn: false, providers });
  return ok({
    signedIn: true,
    providers,
    account: { id: who.accountId, email: maskEmail(who.email) },
    profiles: await listProfiles(sql, who.accountId),
    maxProfiles: MAX_PROFILES,
  });
}

/** Everything we hold about this account, as one JSON document the grown-up can keep. */
export async function exportAccount(sql: Sql, accountId: string, email: string, now: number): Promise<Record<string, unknown>> {
  const acc = await sql.query<{ created_at: string }>("select created_at::text from accounts where id = $1", [accountId]);
  const profiles = await listProfiles(sql, accountId);
  const out = [];
  for (const p of profiles) {
    const saves = await sql.query<{ mode: string; rev: number; data: unknown; updated_at: string }>(
      "select mode, rev, data, updated_at::text from saves where profile_id = $1 order by mode",
      [p.id],
    );
    let tournaments: Record<string, unknown> | null = null;
    if (p.playerId) {
      const [pl] = await sql.query<{ name: string; friend_code: string | null }>("select name, friend_code from players where id = $1", [p.playerId]);
      tournaments = {
        name: pl?.name ?? null,
        friendCode: pl?.friend_code ?? null,
        results: await sql.query("select event_id, rank, entrants, score, best_weight, medal, ended_at::text from results where player_id = $1 order by ended_at desc", [p.playerId]),
        entries: await sql.query("select event_id, casts_used, score, best_weight, species, joined_at::text from entries where player_id = $1 order by joined_at desc", [p.playerId]),
        friends: Number((await sql.query<{ n: number }>("select count(*)::int as n from friends where player_id = $1", [p.playerId]))[0]?.n ?? 0),
      };
    }
    out.push({ id: p.id, name: p.name, kid: p.kid, saves: saves.map((s) => ({ mode: s.mode, rev: s.rev, savedAt: s.updated_at, data: s.data })), tournaments });
  }
  return { about: "Everything FAC Ultra's cloud holds for this account.", exportedAt: new Date(now).toISOString(), account: { email, createdAt: acc[0]?.created_at ?? null }, profiles: out };
}

/** Delete the account and everything under it. The tournament rows that other anglers' boards depend on
    stay, but with nothing left that points back to a person. */
export async function deleteAccount(sql: Sql, accountId: string, email: string): Promise<void> {
  const profiles = await sql.query<{ id: string; player_id: string | null }>("select id, player_id from profiles where account_id = $1", [accountId]);
  const ids = profiles.map((p) => p.id);
  const players = profiles.map((p) => p.player_id).filter((v): v is string => !!v);
  if (ids.length) await sql.query("delete from saves where profile_id = any($1::text[])", [ids]);
  if (players.length) {
    await sql.query("delete from friends where player_id = any($1::text[]) or friend_id = any($1::text[])", [players]);
    await sql.query("delete from invites where from_id = any($1::text[]) or to_id = any($1::text[])", [players]);
    await sql.query("delete from results where player_id = any($1::text[])", [players]);
    await sql.query("update players set name = 'Former angler', friend_code = null, at_event = null where id = any($1::text[])", [players]);
  }
  await sql.query("delete from profiles where account_id = $1", [accountId]);
  await sql.query("delete from sessions where account_id = $1", [accountId]);
  await sql.query("delete from magic_links where lower(email) = lower($1)", [email]);
  await sql.query("delete from accounts where id = $1", [accountId]);
}

export async function handleAccount(sql: Sql, req: AccReq, deps: Deps): Promise<AccRes> {
  if (!sameSite(req)) return fail(403, "wrong_site");
  if (req.method === "GET") {
    if (req.url.searchParams.get("export") === "1") {
      const who = await sessionOf(sql, req);
      if (!who) return fail(401, "signed_out");
      return { ...ok(await exportAccount(sql, who.accountId, who.email, req.now)), cache: "no-store" };
    }
    return me(sql, await sessionOf(sql, req), deps);
  }
  const body = asObject(req.body);
  if (!body) return fail(400, "bad_request");
  switch (body.op) {
    case "request": {
      const email = cleanEmail(body.email);
      if (!email) return fail(400, "bad_email");
      const okIp = await windowHit(sql, `ml:ip:${req.ip}`, LINKS_PER_HOUR_IP, HOUR, req.now);
      const okMail = await windowHit(sql, `ml:em:${email}`, LINKS_PER_HOUR_EMAIL, HOUR, req.now);
      if (!okIp || !okMail) return fail(429, "slow_down");
      const token = newToken();
      await sql.query(`insert into magic_links (token_hash, email, expires_at) values ($1, $2, ${ts(3)})`, [hashToken(token), email, req.now + MAGIC_MS]);
      const base = (deps.env.FAC_PUBLIC_URL?.trim() || req.base).replace(/\/$/, "");
      try {
        await deps.send({ to: email, link: `${base}/?signin=${token}`, minutes: MAGIC_MS / 60_000 });
      } catch (err) {
        console.error("[accounts] could not send the sign-in email:", err);
        return fail(502, "mail_failed");
      }
      /* The same answer whether or not this email already has an account. */
      return ok({ sent: true });
    }
    case "verify": {
      if (!(await windowHit(sql, `vf:ip:${req.ip}`, VERIFY_PER_HOUR_IP, HOUR, req.now))) return fail(429, "slow_down");
      const token = typeof body.token === "string" ? body.token : "";
      if (token.length < 20 || token.length > 100) return fail(400, "bad_link");
      /* Used exactly once: the update only matches a link that is unused and unexpired. */
      const rows = await sql.query<{ email: string }>(
        `update magic_links set used_at = ${ts(2)}
          where token_hash = $1 and used_at is null and expires_at > ${ts(2)} returning email`,
        [hashToken(token), req.now],
      );
      if (!rows[0]) return fail(400, "link_used_or_old");
      const { accountId, setCookie } = await signInEmail(sql, rows[0].email, req);
      const res = await me(sql, { accountId, email: rows[0].email }, deps);
      return { ...res, setCookies: [setCookie] };
    }
    case "logout":
      return { ...ok({ signedIn: false }), setCookies: [await endSession(sql, req)] };
    case "delete": {
      const who = await sessionOf(sql, req);
      if (!who) return fail(401, "signed_out");
      if (body.confirm !== "DELETE") return fail(400, "need_confirm");
      await deleteAccount(sql, who.accountId, who.email);
      return { ...ok({ deleted: true }), setCookies: [await endSession(sql, req)] };
    }
    default:
      return fail(400, "bad_op");
  }
}
