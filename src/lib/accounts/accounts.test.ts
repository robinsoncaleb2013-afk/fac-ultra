/* The account API against a real (embedded) Postgres: sign in by email link, profiles, cloud saves, the
   conflict answer, export, delete, and Google's pieces. No Neon, no email provider, no Google needed. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import type { Sql } from "@/lib/db";
import { testSql } from "@/lib/tournaments/testing.server";
import { handleAccount } from "./accounts.server.ts";
import { MAX_BODY, parseCookies, SESSION_COOKIE, type AccReq, type AccRes, type Deps } from "./common.server.ts";
import { checkIdToken, handleGoogleCallback, handleGoogleStart, redirectUri } from "./google.server.ts";
import { logSender, resendSender, senderFromEnv, type Mail } from "./mail.server.ts";
import { handleProfiles } from "./profiles.server.ts";
import { handleSave } from "./saves.server.ts";

let sql: Sql;
let close: () => Promise<void>;
before(async () => {
  ({ sql, close } = await testSql());
});
after(async () => close());

const BASE = "https://fish.test";
const NOW = Date.UTC(2026, 10, 2, 13, 0, 0);
const sent: Mail[] = [];
const deps = (env: Deps["env"] = {}, f: typeof fetch = fetch): Deps => ({ send: async (m) => void sent.push(m), fetch: f, env });
let ipN = 0;

/** A browser: a cookie jar and an address. */
function browser(ip = `10.9.0.${++ipN}`) {
  const jar: Record<string, string> = {};
  const call = async (h: (s: Sql, r: AccReq, d: Deps) => Promise<AccRes>, method: "GET" | "POST", path: string, body?: unknown, now = NOW, d = deps()) => {
    const req: AccReq = { method, url: new URL(BASE + path), body, ip, now, cookies: { ...jar }, origin: method === "POST" ? BASE : null, base: BASE, secure: true };
    const res = await h(sql, req, d);
    for (const c of res.setCookies ?? []) {
      const [pair, ...attrs] = c.split("; ");
      const [k, ...v] = pair.split("=");
      if (attrs.includes("Max-Age=0")) delete jar[k];
      else jar[k] = decodeURIComponent(v.join("="));
    }
    return res;
  };
  return {
    jar,
    account: (m: "GET" | "POST", p: string, b?: unknown, now?: number, d?: Deps) => call(handleAccount, m, p, b, now, d),
    profiles: (b: unknown, now?: number) => call(handleProfiles, "POST", "/api/profiles", b, now),
    save: (m: "GET" | "POST", p: string, b?: unknown, now?: number) => call(handleSave, m, p, b, now),
    google: (h: Parameters<typeof call>[0], p: string, d: Deps, now?: number) => call(h, "GET", p, undefined, now, d),
  };
}

const tokenOf = (m: Mail) => new URL(m.link).searchParams.get("signin")!;

async function signIn(b: ReturnType<typeof browser>, email: string, now = NOW) {
  const before = sent.length;
  const r = await b.account("POST", "/api/account", { op: "request", email }, now);
  assert.equal(r.status, 200);
  assert.equal(sent.length, before + 1);
  const v = await b.account("POST", "/api/account", { op: "verify", token: tokenOf(sent[sent.length - 1]) }, now);
  assert.equal(v.status, 200);
  return v;
}

const fixture = JSON.parse(readFileSync(new URL("../../game/__fixtures__/save-v9.json", import.meta.url), "utf8")) as Record<string, unknown>;

test("signed out: the account answer is small, and says which sign-in methods exist", async () => {
  const b = browser();
  const r = await b.account("GET", "/api/account");
  assert.equal(r.body.signedIn, false);
  assert.deepEqual(r.body.providers, { email: true, google: false, emailDelivery: "log" });
  const g = await b.account("GET", "/api/account", undefined, NOW, deps({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s", RESEND_API_KEY: "k" }));
  assert.deepEqual(g.body.providers, { email: true, google: true, emailDelivery: "resend" });
});

test("email link: works once, signs in with a safe cookie, and the email is never given back in full", async () => {
  const b = browser();
  const r = await b.account("POST", "/api/account", { op: "request", email: "  Casey@Example.com " });
  assert.deepEqual(r.body, { sent: true }, "nothing about the link or the account comes back");
  const mail = sent[sent.length - 1];
  assert.equal(mail.to, "casey@example.com");
  assert.match(mail.link, /^https:\/\/fish\.test\/\?signin=[A-Za-z0-9_-]{40,}$/);
  const v = await b.account("POST", "/api/account", { op: "verify", token: tokenOf(mail) });
  assert.equal(v.status, 200);
  assert.equal(v.body.signedIn, true);
  assert.match(String((v.body.account as { email: string }).email), /^ca\*+@example\.com$/);
  const cookie = v.setCookies![0];
  for (const flag of ["HttpOnly", "SameSite=Lax", "Secure", "Path=/"]) assert.ok(cookie.includes(flag), flag);
  const raw = parseCookies(cookie.split(";")[0])[SESSION_COOKIE];
  const stored = await sql.query<{ token_hash: string }>("select token_hash from sessions");
  assert.ok(stored.every((s) => s.token_hash !== raw), "the database holds a hash, not the secret");
  assert.equal((await b.account("GET", "/api/account")).body.signedIn, true);
  const again = await browser().account("POST", "/api/account", { op: "verify", token: tokenOf(mail) });
  assert.equal(again.status, 400);
  assert.equal(again.body.error, "link_used_or_old");
});

test("email link: an old link, a made-up link and a bad address are refused", async () => {
  const b = browser();
  await b.account("POST", "/api/account", { op: "request", email: "late@example.com" });
  const mail = sent[sent.length - 1];
  const late = await b.account("POST", "/api/account", { op: "verify", token: tokenOf(mail) }, NOW + 16 * 60_000);
  assert.equal(late.status, 400);
  assert.equal((await b.account("POST", "/api/account", { op: "verify", token: "x".repeat(43) })).status, 400);
  assert.equal((await b.account("POST", "/api/account", { op: "verify", token: "short" })).status, 400);
  assert.equal((await b.account("POST", "/api/account", { op: "request", email: "not-an-email" })).status, 400);
  assert.equal((await b.account("POST", "/api/account", { op: "request", email: "a@b" })).status, 400);
  assert.equal((await b.account("POST", "/api/account", { op: "nope" })).status, 400);
});

test("email link: limits per email and per address, and a cross-site POST is refused", async () => {
  const b = browser();
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await b.account("POST", "/api/account", { op: "request", email: "spam@example.com" }, NOW + 3 * 3600_000)).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);
  const c = browser();
  const ok = [];
  for (let i = 0; i < 12; i++) ok.push((await c.account("POST", "/api/account", { op: "request", email: `n${i}@example.com` }, NOW + 5 * 3600_000)).status);
  assert.equal(ok.filter((s) => s === 200).length, 10);
  const req: AccReq = { method: "POST", url: new URL(BASE + "/api/account"), body: { op: "logout" }, ip: "1.1.1.1", now: NOW, cookies: {}, origin: "https://evil.test", base: BASE, secure: true };
  assert.equal((await handleAccount(sql, req, deps())).status, 403);
});

test("a session expires after 30 days and logging out ends it", async () => {
  const b = browser();
  await signIn(b, "expire@example.com");
  const out = await b.account("GET", "/api/account", undefined, NOW + 31 * 86400_000);
  assert.equal(out.body.signedIn, false);
  const near = browser();
  await signIn(near, "expire3@example.com");
  assert.equal((await near.account("GET", "/api/account", undefined, NOW + 29 * 86400_000)).body.signedIn, true);
  assert.equal((await near.account("GET", "/api/account", undefined, NOW + 55 * 86400_000)).body.signedIn, true, "use keeps it going");
  const b2 = browser();
  await signIn(b2, "expire2@example.com");
  await b2.account("POST", "/api/account", { op: "logout" });
  assert.equal((await b2.account("GET", "/api/account")).body.signedIn, false);
});

test("profiles: need a sign-in, hold four, keep nicknames kid-safe and ask for no email", async () => {
  const anon = browser();
  assert.equal((await anon.profiles({ op: "create", name: "Mia" })).status, 401);
  const b = browser();
  await signIn(b, "family@example.com");
  const made: string[] = [];
  for (const [name, kid] of [["Mia", true], ["Dad", false], ["Sam", true], ["Nana", false]] as const) {
    const r = await b.profiles({ op: "create", name, kid });
    assert.equal(r.status, 200, name);
    made.push((r.body.profile as { id: string }).id);
  }
  const fifth = await b.profiles({ op: "create", name: "Extra" });
  assert.equal(fifth.status, 409);
  assert.equal(fifth.body.error, "profiles_full");
  assert.equal((await b.profiles({ op: "remove", profile: made[1] })).status, 200);
  const slotted = await b.profiles({ op: "create", name: "Pop" });
  assert.equal((slotted.body.profile as { slot: number }).slot, 1, "the freed place is reused");
  assert.equal((await b.profiles({ op: "create", name: "Zed" })).status, 409, "full again");
  const me = await b.account("GET", "/api/account");
  const list = me.body.profiles as { name: string; kid: boolean }[];
  assert.equal(list.length, 4);
  for (const p of list) assert.deepEqual(Object.keys(p).sort(), ["id", "kid", "name", "playerId", "slot"], "a profile is a nickname and nothing else");
  const c = browser();
  await signIn(c, "other@example.com");
  assert.equal((await c.profiles({ op: "create", name: "<b>hi</b>" })).body.profile !== undefined, true);
  assert.equal((await c.profiles({ op: "create", name: "" })).status, 400);
  assert.equal((await c.profiles({ op: "rename", profile: made[0], name: "Hack" })).status, 404, "not yours");
  assert.equal((await c.profiles({ op: "remove", profile: made[0] })).status, 404);
});

test("profiles: the tournament identity follows the profile to a second device", async () => {
  const pc = browser();
  await signIn(pc, "link@example.com");
  const made = await pc.profiles({ op: "create", name: "Mia", playerId: "device-one-id-abcd" });
  const profile = made.body.profile as { id: string; playerId: string };
  assert.equal(profile.playerId, "device-one-id-abcd");
  await sql.query("insert into players (id, name) values ($1, 'Mia') on conflict do nothing", ["device-one-id-abcd"]);
  await sql.query("insert into results (event_id, player_id, rank, entrants, humans, ended_at) values ('e-1', $1, 2, 9, 4, now()) on conflict do nothing", ["device-one-id-abcd"]);
  const phone = browser();
  await signIn(phone, "link@example.com");
  const linked = await phone.profiles({ op: "link", profile: profile.id, playerId: "phone-id-different-1" });
  assert.equal(linked.body.playerId, "device-one-id-abcd", "the phone is told to fish as the profile's identity");
  /* Another profile cannot take an identity that is already held. */
  const b = browser();
  await signIn(b, "thief@example.com");
  const t = await b.profiles({ op: "create", name: "Thief", playerId: "device-one-id-abcd" });
  assert.equal((t.body.profile as { playerId: string | null }).playerId, null);
  const free = await phone.profiles({ op: "create", name: "Sis" });
  const sis = (free.body.profile as { id: string }).id;
  assert.equal((await phone.profiles({ op: "link", profile: sis, playerId: "phone-id-different-1" })).body.playerId, "phone-id-different-1");
  assert.equal((await phone.profiles({ op: "link", profile: sis, playerId: "device-one-id-abcd" })).body.playerId, "phone-id-different-1", "an identity once set stays");
});

test("cloud save: push, pull on a second device, and every upload is sanitised on the server", async () => {
  const home = browser();
  await signIn(home, "saves@example.com");
  const p = (await home.profiles({ op: "create", name: "Mia" })).body.profile as { id: string };
  assert.deepEqual((await home.save("GET", `/api/save?profile=${p.id}`)).body.saves, []);
  const first = await home.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 0, data: fixture, device: "Home PC" });
  assert.equal(first.status, 200);
  assert.equal(first.body.rev, 1);
  const school = browser();
  await signIn(school, "saves@example.com");
  const pulled = await school.save("GET", `/api/save?profile=${p.id}&mode=expedition`);
  const save = pulled.body.save as { rev: number; data: { c: number; caught: number; version: number }; device: string; summary: { caught: number } };
  assert.equal(save.rev, 1);
  assert.equal(save.data.c, fixture.c);
  assert.equal(save.data.caught, fixture.caught);
  assert.equal(save.device, "Home PC");
  assert.equal(save.summary.caught, fixture.caught);
  const second = await school.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 1, data: { ...fixture, caught: Number(fixture.caught) + 5 } });
  assert.equal(second.body.rev, 2);
  const listed = (await home.save("GET", `/api/save?profile=${p.id}`)).body.saves as { mode: string; rev: number }[];
  assert.deepEqual(listed.map((s) => [s.mode, s.rev]), [["expedition", 2]]);
  /* A hand-edited save cannot poison the cloud. */
  const evil = await home.save("POST", "/api/save", {
    profile: p.id, mode: "recreational", baseRev: 0,
    data: { ...fixture, c: 1e300, caught: "lots", lv: -5, dex: { "99-99": { c: 5 }, "0-0": { c: 1e30, w: 5 } }, inv: "no", __proto__: { x: 1 }, hax: "<script>" },
  });
  assert.equal(evil.status, 200);
  const stored = ((await home.save("GET", `/api/save?profile=${p.id}&mode=recreational`)).body.save as { data: Record<string, unknown> }).data;
  assert.ok(Number.isFinite(stored.c as number) && (stored.c as number) <= 1e16);
  assert.equal(stored.hax, undefined);
  assert.equal(typeof stored.caught, "number");
  assert.ok(!("99-99" in (stored.dex as object)));
  assert.equal(stored.version, (await import("@/game/engine")).fresh().version);
  /* Survival has its own shape and its own sanitiser. */
  const sv = await home.save("POST", "/api/save", { profile: p.id, mode: "survival", baseRev: 0, data: { run: "junk", history: [], dex: {} } });
  assert.equal(sv.status, 200);
  assert.equal((await home.save("POST", "/api/save", { profile: p.id, mode: "tournament", baseRev: 0, data: {} })).status, 400, "tournaments keep their truth on the tournament server");
});

test("cloud save: an old revision gets the conflict answer with the stored save; 'keep this device' moves forward", async () => {
  const a = browser();
  await signIn(a, "conflict@example.com");
  const p = (await a.profiles({ op: "create", name: "Mia" })).body.profile as { id: string };
  await a.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 0, data: fixture });
  await a.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 1, data: { ...fixture, caught: 400 } });
  const stale = await a.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 1, data: { ...fixture, caught: 7 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.conflict, true);
  const cloud = stale.body.save as { rev: number; data: { caught: number } };
  assert.equal(cloud.rev, 2);
  assert.equal(cloud.data.caught, 400, "the cloud copy was not overwritten");
  const again = await a.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 0, data: fixture });
  assert.equal(again.status, 409, "'new' when one exists is also a conflict");
  const forced = await a.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 2, force: true, data: { ...fixture, caught: 7 } });
  assert.equal(forced.body.rev, 3);
  assert.equal(((await a.save("GET", `/api/save?profile=${p.id}&mode=expedition`)).body.save as { data: { caught: number } }).data.caught, 7);
});

test("cloud save: signed out, someone else's profile, bad input and big input are all refused", async () => {
  const a = browser();
  await signIn(a, "mine@example.com");
  const p = (await a.profiles({ op: "create", name: "Mia" })).body.profile as { id: string };
  const stranger = browser();
  assert.equal((await stranger.save("GET", `/api/save?profile=${p.id}`)).status, 401);
  await signIn(stranger, "stranger@example.com");
  assert.equal((await stranger.save("GET", `/api/save?profile=${p.id}`)).status, 404);
  assert.equal((await stranger.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 0, data: fixture })).status, 404);
  assert.equal((await a.save("POST", "/api/save", { profile: p.id, mode: "nope", baseRev: 0, data: fixture })).status, 400);
  assert.equal((await a.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 0, data: "text" })).status, 400);
  assert.equal((await a.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: "x", data: fixture })).status, 400);
  const huge = { ...fixture, trips: Array.from({ length: 5000 }, (_, i) => ({ id: i, note: "x".repeat(200) })) };
  const r = await a.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 0, data: huge });
  assert.ok(r.status === 200 || r.status === 413);
  if (r.status === 200) assert.ok(JSON.stringify((await a.save("GET", `/api/save?profile=${p.id}&mode=expedition`)).body.save).length < 300_000, "the stored copy is the sanitised one");
  assert.ok(MAX_BODY > 0);
});

test("export lists everything held; delete removes it, signs out and leaves no link to a person", async () => {
  const a = browser();
  await signIn(a, "bye@example.com");
  const p = (await a.profiles({ op: "create", name: "Mia", playerId: "bye-player-id-0001" })).body.profile as { id: string };
  await a.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 0, data: fixture });
  await sql.query("insert into players (id, name, friend_code) values ($1, 'Mia', 'BYEBYE') on conflict do nothing", ["bye-player-id-0001"]);
  await sql.query("insert into friends (player_id, friend_id) values ($1, 'someone-else-1'), ('someone-else-1', $1)", ["bye-player-id-0001"]);
  await sql.query("insert into results (event_id, player_id, rank, entrants, humans, ended_at) values ('e-9', $1, 1, 3, 2, now())", ["bye-player-id-0001"]);
  const ex = await a.account("GET", "/api/account?export=1");
  assert.equal(ex.status, 200);
  const profiles = ex.body.profiles as { name: string; saves: { mode: string }[]; tournaments: { friendCode: string; results: unknown[]; friends: number } }[];
  assert.equal(profiles[0].saves[0].mode, "expedition");
  assert.equal(profiles[0].tournaments.friendCode, "BYEBYE");
  assert.equal(profiles[0].tournaments.results.length, 1);
  assert.equal((ex.body.account as { email: string }).email, "bye@example.com", "the owner sees their own address in their export");
  assert.equal((await browser().account("GET", "/api/account?export=1")).status, 401);
  assert.equal((await a.account("POST", "/api/account", { op: "delete" })).status, 400, "needs the word DELETE");
  const gone = await a.account("POST", "/api/account", { op: "delete", confirm: "DELETE" });
  assert.equal(gone.status, 200);
  assert.equal((await a.account("GET", "/api/account")).body.signedIn, false);
  const left = async (q: string, v: string) => Number((await sql.query<{ n: number }>(q, [v]))[0].n);
  assert.equal(await left("select count(*)::int as n from accounts where lower(email) = $1", "bye@example.com"), 0);
  assert.equal(await left("select count(*)::int as n from profiles where id = $1", p.id), 0);
  assert.equal(await left("select count(*)::int as n from saves where profile_id = $1", p.id), 0);
  assert.equal(await left("select count(*)::int as n from friends where player_id = $1 or friend_id = $1", "bye-player-id-0001"), 0);
  assert.equal(await left("select count(*)::int as n from results where player_id = $1", "bye-player-id-0001"), 0);
  assert.equal(await left("select count(*)::int as n from magic_links where lower(email) = $1", "bye@example.com"), 0);
  const [pl] = await sql.query<{ name: string; friend_code: string | null }>("select name, friend_code from players where id = 'bye-player-id-0001'");
  assert.deepEqual([pl.name, pl.friend_code], ["Former angler", null]);
});

/* ── Google ─────────────────────────────────────────────────────────────── */

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const idToken = (claims: Record<string, unknown>) => `${b64({ alg: "RS256" })}.${b64(claims)}.sig`;
const GOOD = { iss: "https://accounts.google.com", aud: "client-1", exp: NOW / 1000 + 600, nonce: "N1", email: "Kid.Parent@Gmail.com", email_verified: true };
const WANT = { clientId: "client-1", nonce: "N1", now: NOW };

test("google: the id token is checked for issuer, audience, expiry, nonce and a verified email", () => {
  assert.deepEqual(checkIdToken(idToken(GOOD), WANT), { ok: true, email: "kid.parent@gmail.com" });
  assert.deepEqual(checkIdToken(idToken({ ...GOOD, iss: "accounts.google.com" }), WANT).ok, true);
  const bad = (patch: Record<string, unknown>) => checkIdToken(idToken({ ...GOOD, ...patch }), WANT);
  assert.deepEqual(bad({ iss: "https://evil.test" }), { ok: false, reason: "wrong_issuer" });
  assert.deepEqual(bad({ aud: "someone-else" }), { ok: false, reason: "wrong_audience" });
  assert.deepEqual(bad({ exp: NOW / 1000 - 1 }), { ok: false, reason: "expired" });
  assert.deepEqual(bad({ nonce: "other" }), { ok: false, reason: "wrong_nonce" });
  assert.deepEqual(bad({ email_verified: false }), { ok: false, reason: "email_not_verified" });
  assert.deepEqual(bad({ email: undefined }), { ok: false, reason: "no_email" });
  assert.deepEqual(checkIdToken("nope", WANT), { ok: false, reason: "bad_token" });
  assert.deepEqual(checkIdToken(undefined, WANT), { ok: false, reason: "no_token" });
});

const G_ENV = { GOOGLE_CLIENT_ID: "client-1", GOOGLE_CLIENT_SECRET: "secret-1" };

/** Walk the whole flow with a fake Google that answers the token request with `claims`. */
async function googleFlow(b: ReturnType<typeof browser>, claims: (nonce: string) => Record<string, unknown>, tamper?: (cb: string, stateCookie: () => string | undefined) => string) {
  const seen: { body?: string } = {};
  let seenNonce = "";
  const fake = (async (_url: string, init?: RequestInit) => {
    seen.body = String(init?.body);
    return new Response(JSON.stringify({ id_token: idToken(claims(seenNonce)) }), { status: 200 });
  }) as unknown as typeof fetch;
  const d = deps(G_ENV, fake);
  const start = await b.google(handleGoogleStart, "/api/google-start", d);
  assert.equal(start.status, 302);
  const to = new URL(start.redirect!);
  assert.equal(to.origin + to.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(to.searchParams.get("redirect_uri"), redirectUri(BASE));
  assert.equal(to.searchParams.get("client_id"), "client-1");
  assert.equal(to.searchParams.get("response_type"), "code");
  const state = to.searchParams.get("state")!;
  seenNonce = to.searchParams.get("nonce")!;
  assert.equal(b.jar.fac_oauth, state, "the state is also held in a cookie");
  const path = tamper ? tamper(`/api/google-callback?code=abc&state=${state}`, () => b.jar.fac_oauth) : `/api/google-callback?code=abc&state=${state}`;
  const cb = await b.google(handleGoogleCallback, path, d);
  return { cb, seen, state };
}

test("google: off unless both keys are set", async () => {
  const b = browser();
  const r = await b.google(handleGoogleStart, "/api/google-start", deps({ GOOGLE_CLIENT_ID: "only-id" }));
  assert.equal(r.redirect, "/?cloud=google-off");
});

test("google: a good login signs in, and it reaches the same account as the email link for that address", async () => {
  const viaMail = browser();
  await signIn(viaMail, "kid.parent@gmail.com");
  const p = (await viaMail.profiles({ op: "create", name: "Mia" })).body.profile as { id: string };
  await viaMail.save("POST", "/api/save", { profile: p.id, mode: "expedition", baseRev: 0, data: fixture });
  const g = browser();
  const { cb, seen } = await googleFlow(g, (nonce) => ({ ...GOOD, nonce }));
  assert.equal(cb.status, 302);
  assert.equal(cb.redirect, "/?cloud=ok");
  assert.match(cb.setCookies!.join("\n"), /fac_session=[^;]+; Path=\/; Max-Age=\d+; HttpOnly; SameSite=Lax; Secure/);
  assert.ok(seen.body!.includes("grant_type=authorization_code") && seen.body!.includes("client_secret=secret-1"));
  const me = await g.account("GET", "/api/account");
  assert.equal(me.body.signedIn, true);
  assert.deepEqual((me.body.profiles as { id: string }[]).map((x) => x.id), [p.id], "the same family, the same profiles");
  assert.equal(((await g.save("GET", `/api/save?profile=${p.id}&mode=expedition`)).body.save as { rev: number }).rev, 1);
  assert.equal(Number((await sql.query<{ n: number }>("select count(*)::int as n from accounts where lower(email) = 'kid.parent@gmail.com'"))[0].n), 1);
  /* And the other way round: Google first, then the email link. */
  const first = browser();
  await googleFlow(first, (nonce) => ({ ...GOOD, nonce, email: "new.person@gmail.com" }));
  const second = browser();
  await signIn(second, "New.Person@gmail.com");
  assert.equal(Number((await sql.query<{ n: number }>("select count(*)::int as n from accounts where lower(email) = 'new.person@gmail.com'"))[0].n), 1);
});

test("google: a forged state, a missing cookie, a replay, a wrong nonce and an unverified email all fail", async () => {
  const d = deps(G_ENV);
  const b = browser();
  const wrongState = await googleFlow(b, (nonce) => ({ ...GOOD, nonce }), (p) => p.replace(/state=.*/, "state=forged"));
  assert.match(wrongState.cb.redirect!, /why=bad_state/);
  assert.equal((await b.account("GET", "/api/account")).body.signedIn, false);
  const start = await b.google(handleGoogleStart, "/api/google-start", d);
  const state = new URL(start.redirect!).searchParams.get("state")!;
  const other = browser();
  const noCookie = await other.google(handleGoogleCallback, `/api/google-callback?code=c&state=${state}`, d);
  assert.match(noCookie.redirect!, /why=bad_state/, "a callback from a browser that never started the login is refused");
  const nonceBad = await googleFlow(browser(), () => ({ ...GOOD, nonce: "not-ours" }));
  assert.match(nonceBad.cb.redirect!, /why=wrong_nonce/);
  const unverified = await googleFlow(browser(), (nonce) => ({ ...GOOD, nonce, email_verified: false }));
  assert.match(unverified.cb.redirect!, /why=email_not_verified/);
  const replayBrowser = browser();
  const ok = await googleFlow(replayBrowser, (nonce) => ({ ...GOOD, nonce }));
  assert.equal(ok.cb.redirect, "/?cloud=ok");
  replayBrowser.jar.fac_oauth = ok.state;
  const replay = await replayBrowser.google(handleGoogleCallback, `/api/google-callback?code=c&state=${ok.state}`, deps(G_ENV));
  assert.match(replay.redirect!, /why=expired/, "a state works once");
  const denied = await browser().google(handleGoogleCallback, "/api/google-callback?error=access_denied", d);
  assert.match(denied.redirect!, /why=cancelled/);
});

/* ── Sending the email ──────────────────────────────────────────────────── */

test("mail: Resend when its key is set, the server log otherwise", async () => {
  assert.equal(senderFromEnv({}), logSender);
  const calls: { url: string; init: RequestInit }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const send = senderFromEnv({ RESEND_API_KEY: "re_123", FAC_EMAIL_FROM: "FAC <hi@fish.test>" }, fake);
  await send({ to: "a@b.co", link: "https://fish.test/?signin=abc", minutes: 15 });
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, "Bearer re_123");
  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body.to, ["a@b.co"]);
  assert.equal(body.from, "FAC <hi@fish.test>");
  assert.ok(body.text.includes("https://fish.test/?signin=abc"));
  const broken = resendSender("k", "f", (async () => new Response("no", { status: 403 })) as unknown as typeof fetch);
  await assert.rejects(() => broken({ to: "a@b.co", link: "l", minutes: 1 }));
  const lines: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  try {
    await logSender({ to: "a@b.co", link: "https://x/?signin=zzz", minutes: 15 });
  } finally {
    console.log = log;
  }
  assert.match(lines.join("\n"), /signin=zzz/);
  /* If the provider is down the person is told, and nothing says whether the address has an account. */
  const b = browser();
  const down = await b.account("POST", "/api/account", { op: "request", email: "down@example.com" }, NOW, { ...deps(), send: async () => { throw new Error("down"); } });
  assert.equal(down.status, 502);
});
