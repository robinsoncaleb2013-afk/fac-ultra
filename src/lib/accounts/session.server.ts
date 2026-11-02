/* Sessions (WP-9). The browser holds a random secret in an httpOnly cookie; the database holds only its
   SHA-256, so a leaked database cannot be used to sign in. A session lasts 30 days from its last use. */

import type { Sql } from "@/lib/db";
import { clearCookie, cookie, hashToken, MAX_SESSIONS, newToken, SESSION_COOKIE, SESSION_MS, ts, type AccReq } from "./common.server.ts";

export type Who = { accountId: string; email: string };

/** Sign this account in on this browser: returns the Set-Cookie header. */
export async function startSession(sql: Sql, accountId: string, req: AccReq): Promise<string> {
  const token = newToken();
  await sql.query(`insert into sessions (token_hash, account_id, expires_at) values ($1, $2, ${ts(3)})`, [hashToken(token), accountId, req.now + SESSION_MS]);
  /* Tidy: expired ones go, and one account keeps at most MAX_SESSIONS (the oldest are signed out). */
  await sql.query(`delete from sessions where expires_at < ${ts(1)}`, [req.now]);
  await sql.query(
    `delete from sessions where account_id = $1 and token_hash not in
       (select token_hash from sessions where account_id = $1 order by last_seen desc limit ${MAX_SESSIONS})`,
    [accountId],
  );
  return cookie(SESSION_COOKIE, token, req, Math.floor(SESSION_MS / 1000));
}

/** Who is this request? Null when signed out, expired or unknown. Slides the expiry forward. */
export async function sessionOf(sql: Sql, req: AccReq): Promise<Who | null> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token || token.length < 20 || token.length > 100) return null;
  const rows = await sql.query<{ account_id: string; email: string; expires_ms: number }>(
    `select s.account_id, a.email, (extract(epoch from s.expires_at) * 1000)::bigint as expires_ms
       from sessions s join accounts a on a.id = s.account_id
      where s.token_hash = $1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row || Number(row.expires_ms) < req.now) return null;
  /* Slide the expiry at most once a day so a read does not always write. */
  if (Number(row.expires_ms) - req.now < SESSION_MS - 24 * 3600_000) {
    await sql.query(`update sessions set last_seen = ${ts(2)}, expires_at = ${ts(3)} where token_hash = $1`, [hashToken(token), req.now, req.now + SESSION_MS]);
  }
  return { accountId: row.account_id, email: row.email };
}

export async function endSession(sql: Sql, req: AccReq): Promise<string> {
  const token = req.cookies[SESSION_COOKIE];
  if (token) await sql.query("delete from sessions where token_hash = $1", [hashToken(token)]);
  return clearCookie(SESSION_COOKIE, req);
}
