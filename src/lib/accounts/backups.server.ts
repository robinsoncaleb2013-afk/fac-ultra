/* "Clear my data" (docs/architecture/07 §7): the per-player replacement for the old test-phase wipe.
   A signed-in player can clear ONE profile's saves at any time. The cloud copies are first kept as
   that profile's one backup — a newer clear replaces an older backup, so there is only ever the
   newest — and for 24 hours (CLEAR_BACKUP_MS) the player can restore it. After the window the backup
   is gone for good. Restoring does not use the backup up: it stays until the window ends or a newer
   clear replaces it.

   Only the account's own profile can be cleared, read or restored: the ownership check below is the
   same one the saves handler uses, and every query is scoped to that one profile id. */

import type { Sql } from "@/lib/db";
import { CLEAR_BACKUP_MS, isSyncMode, summarize, type SyncMode } from "@/game/cloud";
import { asObject, fail, MINUTE, ok, sameSite, windowHit, WRITES_PER_MINUTE_ACCOUNT, type AccReq, type AccRes } from "./common.server.ts";
import { sessionOf } from "./session.server.ts";

type SavedRow = { mode: string; rev: number; data: Record<string, unknown> };
type BackupPayload = { v: 1; saves: SavedRow[] };
type BackupRow = { data: unknown; created_ms: number };

/** Read a stored backup payload back into shape. Never trusts it: saves are user-shaped JSON. */
function payloadOf(raw: unknown): BackupPayload {
  const list = asObject(raw)?.saves;
  const saves: SavedRow[] = [];
  if (Array.isArray(list)) {
    for (const s of list) {
      const r = asObject(s);
      if (r && isSyncMode(r.mode) && Number.isInteger(r.rev) && asObject(r.data)) saves.push({ mode: r.mode, rev: Number(r.rev), data: r.data as Record<string, unknown> });
    }
  }
  return { v: 1, saves };
}

const windowOf = (createdMs: number) => ({ createdAt: createdMs, expiresAt: createdMs + CLEAR_BACKUP_MS });
const expired = (createdMs: number, now: number) => now - createdMs >= CLEAR_BACKUP_MS;

async function readRow(sql: Sql, profileId: string): Promise<BackupRow | null> {
  const rows = await sql.query<BackupRow>("select data, created_ms from save_backups where profile_id = $1", [profileId]);
  return rows[0] ? { data: rows[0].data, created_ms: Number(rows[0].created_ms) } : null;
}

export async function handleSaveBackup(sql: Sql, req: AccReq): Promise<AccRes> {
  if (!sameSite(req)) return fail(403, "wrong_site");
  const who = await sessionOf(sql, req);
  if (!who) return fail(401, "signed_out");
  const asked = req.method === "GET" ? req.url.searchParams.get("profile") : asObject(req.body)?.profile;
  const profileId = typeof asked === "string" ? asked : "";
  const mine = await sql.query<{ id: string }>("select id from profiles where id = $1 and account_id = $2", [profileId, who.accountId]);
  if (!mine[0]) return fail(404, "no_such_profile");

  if (req.method === "GET") {
    const row = await readRow(sql, profileId);
    if (!row) return ok({ backup: null });
    if (expired(row.created_ms, req.now)) {
      /* The window has closed: the backup is gone for good. */
      await sql.query("delete from save_backups where profile_id = $1", [profileId]);
      return ok({ backup: null });
    }
    const payload = payloadOf(row.data);
    return ok({
      backup: {
        ...windowOf(row.created_ms),
        saves: payload.saves.map((s) => ({ mode: s.mode, rev: s.rev, summary: summarize(s.mode as SyncMode, s.data) })),
      },
    });
  }

  if (!(await windowHit(sql, `wr:${who.accountId}`, WRITES_PER_MINUTE_ACCOUNT, MINUTE, req.now))) return fail(429, "slow_down");
  const body = asObject(req.body);
  if (!body) return fail(400, "bad_request");

  if (body.op === "clear") {
    /* Snapshot every cloud save this profile has (replacing any older backup), then remove the saves. */
    const rows = await sql.query<SavedRow>("select mode, rev, data from saves where profile_id = $1 order by mode", [profileId]);
    const payload: BackupPayload = { v: 1, saves: rows.filter((r) => isSyncMode(r.mode)).map((r) => ({ mode: r.mode, rev: Number(r.rev), data: r.data })) };
    await sql.query(
      `insert into save_backups (profile_id, data, created_ms) values ($1, $2::jsonb, $3)
       on conflict (profile_id) do update set data = excluded.data, created_ms = excluded.created_ms`,
      [profileId, JSON.stringify(payload), req.now],
    );
    await sql.query("delete from saves where profile_id = $1", [profileId]);
    return ok({ cleared: true, backup: { ...windowOf(req.now), count: payload.saves.length } });
  }

  if (body.op === "restore") {
    const row = await readRow(sql, profileId);
    if (!row) return fail(404, "no_backup");
    if (expired(row.created_ms, req.now)) {
      await sql.query("delete from save_backups where profile_id = $1", [profileId]);
      return fail(410, "backup_expired");
    }
    const payload = payloadOf(row.data);
    /* The restored rows get revisions past both histories (the backup's and whatever was played
       since the clear), so no device can mistake them for a copy it already has. */
    const current = await sql.query<{ mode: string; rev: number }>("select mode, rev from saves where profile_id = $1", [profileId]);
    const curRev = new Map(current.map((r) => [r.mode, Number(r.rev)]));
    await sql.query("delete from saves where profile_id = $1", [profileId]);
    const restored: SavedRow[] = [];
    for (const s of payload.saves) {
      const rev = Math.max(curRev.get(s.mode) ?? 0, s.rev) + 1;
      await sql.query("insert into saves (profile_id, mode, rev, data, device) values ($1, $2, $3, $4::jsonb, null)", [profileId, s.mode, rev, JSON.stringify(s.data)]);
      restored.push({ mode: s.mode, rev, data: s.data });
    }
    return ok({ restored: true, saves: restored, backup: windowOf(row.created_ms) });
  }

  return fail(400, "bad_op");
}
