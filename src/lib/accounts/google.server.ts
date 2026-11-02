/* "Sign in with Google" (WP-9), the standard OAuth 2.0 authorization-code flow over plain fetch.

   Off unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. Redirect URL to register with Google:
   <your site>/api/google-callback

   Safety: a one-time `state` (also held in a short httpOnly cookie) stops forged callbacks; a `nonce`
   inside Google's id_token stops replays; only a Google-VERIFIED email is accepted. The token comes
   straight from Google's token endpoint over TLS, which OpenID Connect allows us to trust without
   checking its signature. The person then gets the very same account and session as the email link. */

import type { Sql } from "@/lib/db";
import { clearCookie, cookie, googleConfigured, hashToken, newToken, OAUTH_COOKIE, OAUTH_MS, ts, type AccReq, type AccRes, type Deps } from "./common.server.ts";
import { signInEmail } from "./accounts.server.ts";

export const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export const redirectUri = (base: string) => `${base.replace(/\/$/, "")}/api/google-callback`;

const back = (req: AccReq, to: string, cookies: string[] = []): AccRes => ({ status: 302, body: {}, redirect: to, setCookies: [clearCookie(OAUTH_COOKIE, req), ...cookies] });

/** GET /api/google-start: send the person to Google. */
export async function handleGoogleStart(sql: Sql, req: AccReq, deps: Deps): Promise<AccRes> {
  if (!googleConfigured(deps.env)) return back(req, "/?cloud=google-off");
  const state = newToken();
  const nonce = newToken();
  await sql.query(`insert into oauth_states (state_hash, nonce, expires_at) values ($1, $2, ${ts(3)})`, [hashToken(state), nonce, req.now + OAUTH_MS]);
  await sql.query(`delete from oauth_states where expires_at < ${ts(1)}`, [req.now]);
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", deps.env.GOOGLE_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri", redirectUri(req.base));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account");
  return { status: 302, body: {}, redirect: url.toString(), setCookies: [cookie(OAUTH_COOKIE, state, req, Math.floor(OAUTH_MS / 1000))] };
}

export type IdTokenCheck = { ok: true; email: string } | { ok: false; reason: string };

/** The claims of an id_token we got directly from Google. Every field we rely on is checked. */
export function checkIdToken(idToken: unknown, want: { clientId: string; nonce: string; now: number }): IdTokenCheck {
  if (typeof idToken !== "string") return { ok: false, reason: "no_token" };
  const parts = idToken.split(".");
  if (parts.length !== 3) return { ok: false, reason: "bad_token" };
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_token" };
  }
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") return { ok: false, reason: "wrong_issuer" };
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(want.clientId)) return { ok: false, reason: "wrong_audience" };
  if (typeof c.exp !== "number" || c.exp * 1000 < want.now) return { ok: false, reason: "expired" };
  if (typeof c.nonce !== "string" || c.nonce !== want.nonce) return { ok: false, reason: "wrong_nonce" };
  if (c.email_verified !== true && c.email_verified !== "true") return { ok: false, reason: "email_not_verified" };
  const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !email.includes("@")) return { ok: false, reason: "no_email" };
  return { ok: true, email };
}

/** GET /api/google-callback: Google sends the person back here with ?code&state. */
export async function handleGoogleCallback(sql: Sql, req: AccReq, deps: Deps): Promise<AccRes> {
  const fail = (why: string) => back(req, `/?cloud=error&why=${encodeURIComponent(why)}`);
  if (!googleConfigured(deps.env)) return back(req, "/?cloud=google-off");
  if (req.url.searchParams.get("error")) return fail("cancelled");
  const state = req.url.searchParams.get("state") ?? "";
  const code = req.url.searchParams.get("code") ?? "";
  if (!state || !code || req.cookies[OAUTH_COOKIE] !== state) return fail("bad_state");
  /* One use only: the row is deleted as it is read. */
  const rows = await sql.query<{ nonce: string; expires_ms: number }>(
    "delete from oauth_states where state_hash = $1 returning nonce, (extract(epoch from expires_at) * 1000)::bigint as expires_ms",
    [hashToken(state)],
  );
  if (!rows[0] || Number(rows[0].expires_ms) < req.now) return fail("expired");
  const clientId = deps.env.GOOGLE_CLIENT_ID!.trim();
  let idToken: unknown;
  try {
    const res = await deps.fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: deps.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: redirectUri(req.base),
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!res.ok) return fail("google_refused");
    idToken = ((await res.json()) as { id_token?: unknown }).id_token;
  } catch {
    return fail("google_unreachable");
  }
  const checked = checkIdToken(idToken, { clientId, nonce: rows[0].nonce, now: req.now });
  if (!checked.ok) return fail(checked.reason);
  const { setCookie } = await signInEmail(sql, checked.email, req);
  return back(req, "/?cloud=ok", [setCookie]);
}
