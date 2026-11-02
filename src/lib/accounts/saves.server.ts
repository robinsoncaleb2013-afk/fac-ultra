/* Cloud saves (WP-9, docs/architecture/07 §4). The browser never decides what the server stores: every
   uploaded save goes back through the game's own sanitize() here, so a hand-edited file cannot put
   nonsense in the cloud. The server moves the revision, one step at a time, and says "conflict" when the
   browser was working from an old one. */

import type { Sql } from "@/lib/db";
import { isSyncMode, MAX_SAVE_BYTES, summarize, type SyncMode } from "@/game/cloud";
import { modeOfSyncId } from "@/game/slots";
import { asObject, fail, MINUTE, ok, sameSite, windowHit, WRITES_PER_MINUTE_ACCOUNT, type AccReq, type AccRes } from "./common.server.ts";
import { sessionOf } from "./session.server.ts";
import { currentEpoch, resetSwitchOn } from "@/lib/test-phase";

/** Anything in, a safe save of that mode out (the same functions the game loads with). */
export async function cleanSave(mode: SyncMode, raw: unknown): Promise<Record<string, unknown>> {
  if (modeOfSyncId(mode) === "survival") {
    const { sanitizeSurvival } = await import("@/game/survival");
    return sanitizeSurvival(raw) as unknown as Record<string, unknown>;
  }
  const { sanitize, snapshot } = await import("@/game/engine");
  return snapshot(sanitize(raw)) as unknown as Record<string, unknown>;
}

type Row = { mode: string; rev: number; data: Record<string, unknown>; device: string | null; updated_ms: number };

const view = (r: Row, withData: boolean) => ({
  mode: r.mode,
  rev: Number(r.rev),
  updatedAt: Number(r.updated_ms),
  device: r.device,
  summary: summarize(r.mode as SyncMode, r.data),
  ...(withData ? { data: r.data } : {}),
});

const COLS = "mode, rev, data, device, (extract(epoch from updated_at) * 1000)::bigint as updated_ms";

export async function handleSave(sql: Sql, req: AccReq): Promise<AccRes> {
  if (!sameSite(req)) return fail(403, "wrong_site");
  const who = await sessionOf(sql, req);
  if (!who) return fail(401, "signed_out");
  const asked = req.method === "GET" ? req.url.searchParams.get("profile") : asObject(req.body)?.profile;
  const profileId = typeof asked === "string" ? asked : "";
  const mine = await sql.query<{ id: string }>("select id from profiles where id = $1 and account_id = $2", [profileId, who.accountId]);
  if (!mine[0]) return fail(404, "no_such_profile");

  if (req.method === "GET") {
    const mode = req.url.searchParams.get("mode");
    if (mode) {
      if (!isSyncMode(mode)) return fail(400, "bad_mode");
      const rows = await sql.query<Row>(`select ${COLS} from saves where profile_id = $1 and mode = $2`, [profileId, mode]);
      return ok({ save: rows[0] ? view(rows[0], true) : null });
    }
    const rows = await sql.query<Row>(`select ${COLS} from saves where profile_id = $1 order by mode`, [profileId]);
    return ok({ saves: rows.map((r) => view(r, false)) });
  }

  if (!(await windowHit(sql, `wr:${who.accountId}`, WRITES_PER_MINUTE_ACCOUNT, MINUTE, req.now))) return fail(429, "slow_down");
  const body = asObject(req.body);
  if (!body) return fail(400, "bad_request");
  /* Test phase: a tab left open from an older build must not push its old save back after a reset. */
  if (typeof body.epoch === "string" && resetSwitchOn(process.env) && body.epoch !== currentEpoch(process.env)) return fail(412, "old_build");
  const mode = body.mode;
  if (!isSyncMode(mode)) return fail(400, "bad_mode");
  /* WP-16: deleting a save slot on the device deletes its cloud copy (only that profile's own row). */
  if (body.op === "delete") {
    await sql.query("delete from saves where profile_id = $1 and mode = $2", [profileId, mode]);
    return ok({ deleted: true });
  }
  if (!asObject(body.data)) return fail(400, "bad_save");
  const baseRev = Number.isInteger(body.baseRev) && (body.baseRev as number) >= 0 ? (body.baseRev as number) : -1;
  if (baseRev < 0 && body.force !== true) return fail(400, "bad_rev");
  const clean = await cleanSave(mode, body.data);
  const json = JSON.stringify(clean);
  if (json.length > MAX_SAVE_BYTES) return fail(413, "save_too_large", { max: MAX_SAVE_BYTES });
  const device = typeof body.device === "string" ? body.device.replace(/[^\w .-]/g, "").slice(0, 40) || null : null;

  let rev: number | null = null;
  if (body.force === true) {
    /* "Keep this device": the player looked at both and chose. The revision still only moves forward. */
    const rows = await sql.query<{ rev: number }>(
      `insert into saves (profile_id, mode, rev, data, device) values ($1, $2, 1, $3::jsonb, $4)
       on conflict (profile_id, mode) do update set rev = saves.rev + 1, data = excluded.data, device = excluded.device, updated_at = now()
       returning rev`,
      [profileId, mode, json, device],
    );
    rev = Number(rows[0].rev);
  } else if (baseRev === 0) {
    const rows = await sql.query<{ rev: number }>(
      `insert into saves (profile_id, mode, rev, data, device) values ($1, $2, 1, $3::jsonb, $4)
       on conflict (profile_id, mode) do nothing returning rev`,
      [profileId, mode, json, device],
    );
    rev = rows[0] ? Number(rows[0].rev) : null;
  } else {
    const rows = await sql.query<{ rev: number }>(
      `update saves set rev = rev + 1, data = $4::jsonb, device = $5, updated_at = now()
        where profile_id = $1 and mode = $2 and rev = $3 returning rev`,
      [profileId, mode, baseRev, json, device],
    );
    rev = rows[0] ? Number(rows[0].rev) : null;
  }
  if (rev !== null) return ok({ saved: true, rev, summary: summarize(mode, clean) });
  const stored = await sql.query<Row>(`select ${COLS} from saves where profile_id = $1 and mode = $2`, [profileId, mode]);
  return fail(409, "conflict", { conflict: true, save: stored[0] ? view(stored[0], true) : null });
}
