/* Family profiles (WP-9, docs/architecture/07 §3): up to four named profiles under one account, each with its
   own saves and its own tournament identity. A profile has a nickname and nothing else: no email, no birthday.
   Only a signed-in grown-up can add one. */

import type { Sql } from "@/lib/db";
import { MAX_PROFILES } from "@/game/cloud";
import { safeName } from "@/game/safe";
import { cleanId } from "@/lib/tournaments/common.server";
import { asObject, fail, MINUTE, newId, ok, sameSite, windowHit, WRITES_PER_MINUTE_ACCOUNT, type AccReq, type AccRes } from "./common.server.ts";
import { sessionOf } from "./session.server.ts";

export type ProfileOut = { id: string; slot: number; name: string; kid: boolean; playerId: string | null };

export async function listProfiles(sql: Sql, accountId: string): Promise<ProfileOut[]> {
  const rows = await sql.query<{ id: string; slot: number; name: string; kid: boolean; player_id: string | null }>(
    "select id, slot, name, kid, player_id from profiles where account_id = $1 order by slot",
    [accountId],
  );
  return rows.map((r) => ({ id: r.id, slot: Number(r.slot), name: r.name, kid: r.kid, playerId: r.player_id }));
}

/** Claim a tournament identity for a profile if nobody else holds it. Returns the id the profile now fishes as. */
async function claim(sql: Sql, profileId: string, playerId: string | null): Promise<string | null> {
  const [cur] = await sql.query<{ player_id: string | null }>("select player_id from profiles where id = $1", [profileId]);
  if (cur?.player_id) return cur.player_id;
  if (!playerId) return null;
  /* The partial unique index makes this atomic: if another profile already holds this id, nothing changes. */
  const rows = await sql.query<{ player_id: string }>(
    `update profiles set player_id = $2
      where id = $1 and player_id is null
        and not exists (select 1 from profiles where player_id = $2)
      returning player_id`,
    [profileId, playerId],
  );
  return rows[0]?.player_id ?? null;
}

export async function handleProfiles(sql: Sql, req: AccReq): Promise<AccRes> {
  if (!sameSite(req)) return fail(403, "wrong_site");
  if (req.method !== "POST") return fail(405, "method_not_allowed");
  const who = await sessionOf(sql, req);
  if (!who) return fail(401, "signed_out");
  if (!(await windowHit(sql, `wr:${who.accountId}`, WRITES_PER_MINUTE_ACCOUNT, MINUTE, req.now))) return fail(429, "slow_down");
  const body = asObject(req.body);
  if (!body) return fail(400, "bad_request");
  const profileId = typeof body.profile === "string" ? body.profile : "";
  const owned = async () => {
    const rows = await sql.query<{ id: string }>("select id from profiles where id = $1 and account_id = $2", [profileId, who.accountId]);
    return !!rows[0];
  };
  const out = async (id: string) => (await listProfiles(sql, who.accountId)).find((p) => p.id === id) ?? null;
  switch (body.op) {
    case "create": {
      const name = safeName(body.name, "");
      if (!name) return fail(400, "bad_name");
      const have = await listProfiles(sql, who.accountId);
      if (have.length >= MAX_PROFILES) return fail(409, "profiles_full", { max: MAX_PROFILES });
      const used = new Set(have.map((p) => p.slot));
      let slot = 0;
      while (used.has(slot)) slot++;
      const id = newId("prf");
      try {
        await sql.query("insert into profiles (id, account_id, slot, name, kid) values ($1, $2, $3, $4, $5)", [id, who.accountId, slot, name, body.kid === true]);
      } catch {
        /* Two taps at once took the same slot: the unique key said no. */
        return fail(409, "profiles_full", { max: MAX_PROFILES });
      }
      const pid = cleanId(body.playerId);
      await claim(sql, id, pid);
      return ok({ profile: await out(id) });
    }
    case "rename": {
      if (!(await owned())) return fail(404, "no_such_profile");
      const name = safeName(body.name, "");
      if (!name) return fail(400, "bad_name");
      await sql.query("update profiles set name = $2 where id = $1", [profileId, name]);
      return ok({ profile: await out(profileId) });
    }
    case "remove": {
      if (!(await owned())) return fail(404, "no_such_profile");
      await sql.query("delete from saves where profile_id = $1", [profileId]);
      await sql.query("delete from profiles where id = $1", [profileId]);
      return ok({ removed: true });
    }
    case "link": {
      /* "This is the identity this device fishes as." The profile's own identity wins; a profile with none takes the device's. */
      if (!(await owned())) return fail(404, "no_such_profile");
      const pid = await claim(sql, profileId, cleanId(body.playerId));
      return ok({ playerId: pid, profile: await out(profileId) });
    }
    default:
      return fail(400, "bad_op");
  }
}
