/* Shared plumbing for the account API (WP-9): the request/response shape, secrets, cookies and rate limits.
   Server-only. Handlers take a `Sql` and a `Deps`, so tests run them on an in-memory PGlite with a fake
   mailer and a fake Google, and routes stay thin. This folder is the game's own account code; the
   platform's sign-in (src/lib/auth) is not touched. */

import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "@/lib/db";
import type { ApiReq, ApiRes } from "@/lib/tournaments/common.server";
import type { MailSender } from "./mail.server.ts";

export { asObject, fail, ok } from "@/lib/tournaments/common.server";

/** A request as the account handlers see it: the tournament shape plus cookies and where the site lives. */
export type AccReq = ApiReq & {
  cookies: Record<string, string>;
  /** The `Origin` header, when the browser sent one (checked on every POST). */
  origin: string | null;
  /** The site's own address as the browser used it, e.g. "https://fish.example.com". */
  base: string;
  /** True when the site is served over https (cookies then carry `Secure`). */
  secure: boolean;
};

export type AccRes = ApiRes & { setCookies?: string[]; redirect?: string };

export type Deps = {
  send: MailSender;
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
};

export const SESSION_COOKIE = "fac_session";
export const OAUTH_COOKIE = "fac_oauth";

export const MAGIC_MS = 15 * 60_000;
export const SESSION_MS = 30 * 24 * 3600_000;
export const OAUTH_MS = 10 * 60_000;
export const MAX_SESSIONS = 10;
/** Sign-in links per hour, per address and per email; verifying tries per hour per address. */
export const LINKS_PER_HOUR_IP = 10;
export const LINKS_PER_HOUR_EMAIL = 5;
export const VERIFY_PER_HOUR_IP = 30;
/** Account writes (profiles, saves) per minute per account. */
export const WRITES_PER_MINUTE_ACCOUNT = 60;
export const MAX_BODY = 8 * 1024;

export const newToken = () => randomBytes(32).toString("base64url");
export const newId = (prefix: string) => `${prefix}_${randomBytes(12).toString("base64url")}`;
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export function cleanEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  if (e.length < 5 || e.length > 254) return null;
  return /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\.]{2,}$/.test(e) ? e : null;
}

/** "ca***@gmail.com": enough for the owner to recognise, not enough for a shoulder-surfer to use. */
export function maskEmail(email: string): string {
  const [user, host] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(2, Math.min(6, user.length - 2)))}@${host}`;
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    if (!(k in out)) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name: string, value: string, req: Pick<AccReq, "secure">, maxAgeS: number): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeS}`,
    "HttpOnly",
    "SameSite=Lax",
    req.secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export const clearCookie = (name: string, req: Pick<AccReq, "secure">) => cookie(name, "", req, 0);

/** Count one hit on `key` in a window of `windowMs`; true while within `limit`. */
export async function windowHit(sql: Sql, key: string, limit: number, windowMs: number, now: number): Promise<boolean> {
  const bucket = Math.floor(now / windowMs);
  const until = (bucket + 2) * windowMs;
  const rows = await sql.query<{ n: number }>(
    `insert into acct_hits (key, bucket, n, until) values ($1, $2, 1, $3)
     on conflict (key, bucket) do update set n = acct_hits.n + 1 returning n`,
    [key, bucket, until],
  );
  if (Math.random() < 0.02) await sql.query("delete from acct_hits where until < $1", [now]);
  return Number(rows[0]?.n ?? 1) <= limit;
}

export const HOUR = 3600_000;
export const MINUTE = 60_000;

/** Same-site check for POSTs: if the browser says where the request came from, it must be here. */
export function sameSite(req: AccReq): boolean {
  if (req.method !== "POST") return true;
  if (!req.origin) return true;
  try {
    return new URL(req.origin).host === new URL(req.base).host;
  } catch {
    return false;
  }
}

export const ts = (n: number) => `to_timestamp(($${n}::double precision) / 1000.0)`;

/** Google sign-in is offered only when both halves of the key are set. */
export const googleConfigured = (env: Deps["env"]): boolean => !!(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
