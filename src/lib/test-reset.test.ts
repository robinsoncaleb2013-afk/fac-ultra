/* The server side of the test-phase reset against a real (embedded) Postgres. docs/TEST-PHASE.md. */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Sql } from "@/lib/db";
import { testSql } from "@/lib/tournaments/testing.server";
import { runTestReset } from "./test-reset.server.ts";
import { KEEP_TABLES, WIPE_TABLES } from "./test-phase.ts";

let sql: Sql;
let close: () => Promise<void>;
before(async () => {
  ({ sql, close } = await testSql());
});
after(async () => close());

const count = async (t: string) => Number((await sql.query<{ n: number }>(`select count(*)::int as n from ${t}`))[0].n);
const quiet = { log: () => {} };

async function seed() {
  await sql`insert into accounts (id, email) values ('a1', 'x@example.com') on conflict do nothing`;
  await sql`insert into sessions (token_hash, account_id, expires_at) values ('t1', 'a1', now() + interval '1 day') on conflict do nothing`;
  await sql`insert into players (id, name, banned_until, at_event, last_seen) values ('p1', 'Casey', now() + interval '1 hour', 'q-1', now()) on conflict do nothing`;
  await sql`insert into players (id, name) values ('p2', 'Robin') on conflict do nothing`;
  await sql`insert into profiles (id, account_id, slot, name, player_id) values ('pr1', 'a1', 0, 'Casey', 'p1') on conflict do nothing`;
  await sql`insert into friends (player_id, friend_id) values ('p1', 'p2') on conflict do nothing`;
  await sql`insert into events (id, kind, title, water, rules, seed, starts_at, ends_at) values ('q-1', 'quick', 'Q', 0, '{}'::jsonb, 1, now(), now() + interval '1 hour') on conflict do nothing`;
  await sql`insert into entries (event_id, player_id, score) values ('q-1', 'p1', 5) on conflict do nothing`;
  await sql`insert into catches (event_id, player_id, cast_index, envelope, verdict) values ('q-1', 'p1', 0, '{}'::jsonb, 'ok') on conflict do nothing`;
  await sql`insert into results (event_id, player_id, rank, entrants, humans, ended_at) values ('q-0', 'p1', 1, 2, 1, now()) on conflict do nothing`;
  await sql`insert into saves (profile_id, mode, rev, data) values ('pr1', 'expedition', 7, '{"c":9}'::jsonb) on conflict do nothing`;
  await sql`insert into rate_hits (key, bucket, n) values ('k', 1, 3) on conflict do nothing`;
  await sql`insert into friend_requests (from_id, to_id) values ('p2', 'p1') on conflict do nothing`;
  await sql`insert into invites (from_id, to_id, event_id) values ('p1', 'p2', 'q-1') on conflict do nothing`;
  await sql`insert into rooms (room, peer) values ('r', 'p1') on conflict do nothing`;
  await sql`insert into survival_runs (event_id, player_id, days, fish_eaten, biggest, log) values ('s-1', 'p1', 3, 2, 1, '[]'::jsonb) on conflict do nothing`;
}

test("a brand-new database stores the epoch (and wipes the nothing it has)", async () => {
  const r = await runTestReset(sql, { epoch: "b1", on: true, ...quiet });
  assert.equal(r.verdict, "first");
  assert.equal((await sql`select value from app_state where key = 'build_epoch'`)[0].value, "b1");
});

test("same build again: nothing is wiped", async () => {
  await seed();
  const r = await runTestReset(sql, { epoch: "b1", on: true, ...quiet });
  assert.equal(r.verdict, "same");
  assert.equal(await count("saves"), 1);
  assert.equal(await count("entries"), 1);
});

test("a new build wipes progress once, keeps identities, and logs one line", async () => {
  const lines: string[] = [];
  const r = await runTestReset(sql, { epoch: "b2", on: true, log: (l) => lines.push(l) });
  assert.equal(r.verdict, "reset");
  assert.equal(r.previous, "b1");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[test-phase\].*b2.*b1/);
  for (const t of WIPE_TABLES) assert.equal(await count(t), 0, `${t} should be empty`);
  assert.equal(await count("accounts"), 1);
  assert.equal(await count("sessions"), 1);
  assert.equal(await count("profiles"), 1);
  assert.equal(await count("friends"), 1);
  assert.equal(await count("players"), 2);
  const p = (await sql`select banned_until, at_event, last_seen, name from players where id = 'p1'`)[0];
  assert.equal(p.banned_until, null);
  assert.equal(p.at_event, null);
  assert.equal(p.last_seen, null);
  assert.equal(p.name, "Casey");
});

test("running it again for the same build is idempotent (new progress survives)", async () => {
  await seed();
  const lines: string[] = [];
  const r = await runTestReset(sql, { epoch: "b2", on: true, log: (l) => lines.push(l) });
  assert.equal(r.verdict, "same");
  assert.equal(lines.length, 0);
  assert.equal(await count("saves"), 1);
});

test("two requests at boot: exactly one wipes", async () => {
  await seed();
  const lines: string[] = [];
  const log = (l: string) => lines.push(l);
  const all = await Promise.all([1, 2, 3, 4, 5].map(() => runTestReset(sql, { epoch: "b3", on: true, log })));
  assert.equal(all.filter((x) => x.verdict === "reset").length, 1);
  assert.equal(lines.length, 1);
  assert.equal(await count("saves"), 0);
});

test("switch OFF: nothing is wiped and the stored epoch is not touched", async () => {
  await seed();
  const r = await runTestReset(sql, { epoch: "b4", on: false, ...quiet });
  assert.equal(r.verdict, "off");
  assert.equal(await count("saves"), 1);
  assert.equal((await sql`select value from app_state where key = 'build_epoch'`)[0].value, "b3");
});

test("turning it back ON with a newer build wipes then", async () => {
  const r = await runTestReset(sql, { epoch: "b4", on: true, ...quiet });
  assert.equal(r.verdict, "reset");
  assert.equal(await count("saves"), 0);
});

test("every table in the database is on exactly one list", async () => {
  const rows = await sql.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public' and tablename not like '\\_%'");
  for (const { tablename } of rows) {
    const n = Number(WIPE_TABLES.includes(tablename)) + Number(KEEP_TABLES.includes(tablename));
    assert.equal(n, 1, `table ${tablename} must be listed in WIPE_TABLES or KEEP_TABLES (src/lib/test-phase.ts)`);
  }
});
