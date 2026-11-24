/* "Clear my data" against a real (embedded) Postgres: the backup a clear makes, the one-backup rule,
   the 24-hour restore window, restore after playing again, and the fence that keeps one player's
   clear away from everyone else's fish. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import type { Sql } from "@/lib/db";
import { testSql } from "@/lib/tournaments/testing.server";
import { runTestReset } from "../test-reset.server.ts";
import { CLEAR_BACKUP_MS } from "@/game/cloud";
import { handleAccount } from "./accounts.server.ts";
import { handleSaveBackup } from "./backups.server.ts";
import { type AccReq, type AccRes, type Deps } from "./common.server.ts";
import { type Mail } from "./mail.server.ts";
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
const HOUR = 3_600_000;
const sent: Mail[] = [];
const deps = (env: Deps["env"] = {}, f: typeof fetch = fetch): Deps => ({ send: async (m) => void sent.push(m), fetch: f, env });
let ipN = 0;

/** A browser: a cookie jar and an address. */
function browser(ip = `10.8.0.${++ipN}`) {
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
    backup: (m: "GET" | "POST", p: string, b?: unknown, now?: number) => call(handleSaveBackup, m, p, b, now),
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

/** A signed-in player with one profile and the given cloud saves already pushed. */
async function playerWithSaves(email: string, modes: string[]) {
  const b = browser();
  await signIn(b, email);
  const p = (await b.profiles({ op: "create", name: "Mia" })).body.profile as { id: string };
  for (const mode of modes) {
    const r = await b.save("POST", "/api/save", { profile: p.id, mode, baseRev: 0, data: fixture });
    assert.equal(r.status, 200, `push ${mode}`);
  }
  return { b, profileId: p.id };
}

const getSave = async (b: ReturnType<typeof browser>, profileId: string, mode: string) =>
  (await b.save("GET", `/api/save?profile=${profileId}&mode=${mode}`)).body.save as { data: Record<string, unknown>; rev: number } | null;

test("clear: every cloud save goes into the backup, the saves are gone, the window is 24 hours", async () => {
  const { b, profileId } = await playerWithSaves("clear1@example.com", ["expedition", "recreational"]);
  assert.equal((await b.backup("GET", `/api/save-backup?profile=${profileId}`)).body.backup, null);
  const r = await b.backup("POST", "/api/save-backup", { profile: profileId, op: "clear" }, NOW);
  assert.equal(r.status, 200);
  assert.equal(r.body.cleared, true);
  const bk = r.body.backup as { createdAt: number; expiresAt: number; count: number };
  assert.equal(bk.createdAt, NOW);
  assert.equal(bk.expiresAt, NOW + CLEAR_BACKUP_MS, "24 hours, no more");
  assert.equal(bk.count, 2, "both modes were backed up");
  assert.deepEqual((await b.save("GET", `/api/save?profile=${profileId}`)).body.saves, [], "the saves themselves are cleared");
  const status = (await b.backup("GET", `/api/save-backup?profile=${profileId}`, undefined, NOW)).body.backup as {
    createdAt: number;
    expiresAt: number;
    saves: { mode: string; summary: { caught: number } }[];
  };
  assert.equal(status.createdAt, NOW);
  assert.deepEqual(status.saves.map((s) => s.mode), ["expedition", "recreational"]);
  assert.equal(status.saves[0].summary.caught, Number(fixture.caught), "the backup describes the fish that were cleared");
});

test("a second clear replaces the backup: only the newest clear can be restored", async () => {
  const { b, profileId } = await playerWithSaves("clear2@example.com", ["expedition"]);
  await b.backup("POST", "/api/save-backup", { profile: profileId, op: "clear" }, NOW);
  const push = await b.save("POST", "/api/save", { profile: profileId, mode: "expedition", baseRev: 0, data: { ...fixture, caught: Number(fixture.caught) + 7 } });
  assert.equal(push.status, 200);
  const second = await b.backup("POST", "/api/save-backup", { profile: profileId, op: "clear" }, NOW + HOUR);
  assert.equal((second.body.backup as { createdAt: number }).createdAt, NOW + HOUR);
  const rows = await sql.query<{ n: number }>("select count(*)::int as n from save_backups where profile_id = $1", [profileId]);
  assert.equal(Number(rows[0].n), 1, "still exactly one backup row for the profile");
  const status = (await b.backup("GET", `/api/save-backup?profile=${profileId}`, undefined, NOW + HOUR)).body.backup as { saves: { summary: { caught: number } }[] };
  assert.equal(status.saves[0].summary.caught, Number(fixture.caught) + 7, "the backup holds the newer fish, not the first clear's");
});

test("restore inside 24 hours brings the fish back, exactly as they were", async () => {
  const { b, profileId } = await playerWithSaves("clear3@example.com", ["expedition", "recreational"]);
  const before = await getSave(b, profileId, "expedition");
  await b.backup("POST", "/api/save-backup", { profile: profileId, op: "clear" }, NOW);
  const r = await b.backup("POST", "/api/save-backup", { profile: profileId, op: "restore" }, NOW + 23 * HOUR);
  assert.equal(r.status, 200);
  assert.equal(r.body.restored, true);
  const after = await getSave(b, profileId, "expedition");
  assert.deepEqual(after?.data, before?.data, "the same save, field for field");
  const listed = (await b.save("GET", `/api/save?profile=${profileId}`)).body.saves as { mode: string }[];
  assert.deepEqual(listed.map((s) => s.mode), ["expedition", "recreational"], "every mode came back");
  const status = (await b.backup("GET", `/api/save-backup?profile=${profileId}`, undefined, NOW + 23 * HOUR)).body.backup;
  assert.ok(status, "restoring does not use the backup up — it stays until the window ends");
});

test("restore after 24 hours is refused, and the backup is gone for good", async () => {
  const { b, profileId } = await playerWithSaves("clear4@example.com", ["expedition"]);
  await b.backup("POST", "/api/save-backup", { profile: profileId, op: "clear" }, NOW);
  const late = await b.backup("POST", "/api/save-backup", { profile: profileId, op: "restore" }, NOW + CLEAR_BACKUP_MS);
  assert.equal(late.status, 410);
  assert.equal(late.body.error, "backup_expired");
  assert.equal((await b.backup("GET", `/api/save-backup?profile=${profileId}`, undefined, NOW + CLEAR_BACKUP_MS)).body.backup, null, "the status agrees: nothing left");
  const again = await b.backup("POST", "/api/save-backup", { profile: profileId, op: "restore" }, NOW + CLEAR_BACKUP_MS + 1000);
  assert.equal(again.status, 404, "and it does not come back");
  /* One minute inside the window still works. */
  const p2 = await playerWithSaves("clear4b@example.com", ["expedition"]);
  await p2.b.backup("POST", "/api/save-backup", { profile: p2.profileId, op: "clear" }, NOW);
  const just = await p2.b.backup("POST", "/api/save-backup", { profile: p2.profileId, op: "restore" }, NOW + CLEAR_BACKUP_MS - 60_000);
  assert.equal(just.status, 200);
});

test("the fence: signed-out is refused, another account's profile is invisible, a neighbour's clear changes nothing", async () => {
  const a = await playerWithSaves("clear5a@example.com", ["expedition"]);
  const c = await playerWithSaves("clear5c@example.com", ["expedition"]);
  const anon = browser();
  assert.equal((await anon.backup("GET", `/api/save-backup?profile=${a.profileId}`)).status, 401);
  assert.equal((await anon.backup("POST", "/api/save-backup", { profile: a.profileId, op: "clear" })).status, 401);
  assert.equal((await c.b.backup("GET", `/api/save-backup?profile=${a.profileId}`)).status, 404, "not yours to see");
  assert.equal((await c.b.backup("POST", "/api/save-backup", { profile: a.profileId, op: "clear" })).status, 404, "not yours to clear");
  assert.equal((await c.b.backup("POST", "/api/save-backup", { profile: a.profileId, op: "restore" })).status, 404, "not yours to restore");
  await a.b.backup("POST", "/api/save-backup", { profile: a.profileId, op: "clear" }, NOW);
  const neighbour = (await c.b.save("GET", `/api/save?profile=${c.profileId}`)).body.saves as unknown[];
  assert.equal(neighbour.length, 1, "the neighbour's saves are untouched");
  assert.equal((await c.b.backup("GET", `/api/save-backup?profile=${c.profileId}`)).body.backup, null, "and they hold no backup they didn't make");
});

test("restore after playing again: the new start is replaced by the backup, at a higher revision", async () => {
  const { b, profileId } = await playerWithSaves("clear6@example.com", ["expedition"]);
  const before = await getSave(b, profileId, "expedition");
  await b.backup("POST", "/api/save-backup", { profile: profileId, op: "clear" }, NOW);
  /* The player tries the fresh start for a while… */
  const fresh = await b.save("POST", "/api/save", { profile: profileId, mode: "expedition", baseRev: 0, data: { ...fixture, caught: 3 } });
  assert.equal(fresh.status, 200);
  /* …and changes their mind inside the window. */
  const r = await b.backup("POST", "/api/save-backup", { profile: profileId, op: "restore" }, NOW + 2 * HOUR);
  assert.equal(r.status, 200);
  const after = await getSave(b, profileId, "expedition");
  assert.equal(after?.data.caught, before?.data.caught, "the old fish are back, not the three new ones");
  assert.ok((after?.rev ?? 0) > Number(fresh.body.rev), "the restored save is newer than the fresh start it replaced");
});

test("even a test-phase reset (if anyone turns it back on) keeps clear-my-data backups", async () => {
  const { b, profileId } = await playerWithSaves("clear7@example.com", ["expedition"]);
  await b.backup("POST", "/api/save-backup", { profile: profileId, op: "clear" }, NOW);
  await runTestReset(sql, { epoch: "the-build-before", on: true, log: () => {} });
  const r = await runTestReset(sql, { epoch: "some-new-build", on: true, log: () => {} });
  assert.equal(r.verdict, "reset");
  const rows = await sql.query<{ n: number }>("select count(*)::int as n from save_backups where profile_id = $1", [profileId]);
  assert.equal(Number(rows[0].n), 1, "the backup survives the reset — it is the copy a player would restore from");
  const restore = await b.backup("POST", "/api/save-backup", { profile: profileId, op: "restore" }, NOW + 60_000);
  assert.equal(restore.status, 200, "and it can still be restored afterwards");
});
