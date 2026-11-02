/* Joining an event and submitting casts (docs/architecture/06 §1.2 entry.ts and catch.ts, §1.4–1.5).

   The server never takes the client's word for a catch. It re-rolls the cast from the seed with the
   same pure game code the client played with (src/game/replay.ts), replays the fight from the recorded
   inputs, and only then scores it. Verdicts: ok · mismatch · budget · stale · rate (rate is answered,
   not stored, so the client can try again). */

import type { Sql } from "@/lib/db";
import { BIOMES } from "@/game/content";
import { claimMatches, parseEnvelope, replayCast, type Envelope, type Replayed } from "@/game/replay";
import { scoreEntry, type Landed } from "@/game/scoring";
import { fillCount, rivalRows, rivalsAhead } from "@/game/fill";
import { teamById, TEAM_MAX } from "@/game/social";
import {
  asObject,
  AT_AHEAD_MS,
  AT_BEHIND_MS,
  BAN_MS,
  cleanEventId,
  cleanId,
  cleanName,
  defaultName,
  ENVELOPE_GAP_MS,
  fail,
  MS,
  ok,
  STRIKES_TO_BAN,
  TS,
  WALL_SLACK_S,
  WINDOW_SLACK_MS,
  writeGuard,
  type ApiReq,
  type ApiRes,
} from "./common.server.ts";
import { getEvent, publicEvent, type EventRow } from "./events.server.ts";

type EntryRaw = {
  casts_used: number;
  seconds_used: number;
  score: number;
  tiebreak: number;
  best_weight: number;
  species: number;
  fish: number;
  strikes: number;
  last_ms: number;
  joined_ms: number;
  banned_ms: number | null;
  name: string;
  team: string | null;
};

const ENTRY_COLUMNS = `e.casts_used, e.seconds_used::float8 as seconds_used, e.score::float8 as score, e.tiebreak::float8 as tiebreak,
  e.best_weight::float8 as best_weight, e.species, e.fish, e.strikes, e.last_ms, ${MS("e.joined_at")} as joined_ms,
  ${MS("p.banned_until")} as banned_ms, p.name, e.team`;

async function getEntry(sql: Sql, eventId: string, playerId: string): Promise<EntryRaw | null> {
  const rows = await sql.query<EntryRaw>(
    `select ${ENTRY_COLUMNS} from entries e join players p on p.id = e.player_id where e.event_id = $1 and e.player_id = $2`,
    [eventId, playerId],
  );
  return rows[0] ?? null;
}

/** 1 + the number of entries ahead of this score; and how many have entered. */
export async function rankOf(sql: Sql, eventId: string, score: number, tiebreak: number) {
  const rows = await sql.query<{ ahead: number; total: number }>(
    `select count(*) filter (where score > $2 or (score = $2 and tiebreak > $3))::int as ahead, count(*)::int as total
       from entries where event_id = $1`,
    [eventId, score, tiebreak],
  );
  return { rank: Number(rows[0]?.ahead ?? 0) + 1, entrants: Number(rows[0]?.total ?? 0), humans: Number(rows[0]?.total ?? 0) };
}

/** Like `rankOf`, but a Quick board that is short of anglers is topped up with Regulars (06 §3.2),
    so the rank and the headcount match what the board shows. */
export async function rankIn(sql: Sql, e: EventRow, score: number, tiebreak: number, now: number) {
  const base = await rankOf(sql, e.id, score, tiebreak);
  const n = fillCount(e.kind, base.humans);
  if (!n) return base;
  const rivals = rivalRows({ id: e.id, seed: e.seed, water: e.water, startsAt: e.startsAt, endsAt: e.endsAt, category: e.rules.category, castBudget: e.rules.castBudget }, n, now);
  return { rank: base.rank + rivalsAhead(rivals, score, tiebreak), entrants: base.entrants + n, humans: base.humans };
}

const isBanned = (banMs: number | null, now: number) => banMs != null && Number(banMs) > now;

function state(e: EventRow, en: EntryRaw, rank: number, entrants: number, now: number) {
  const seconds = Number(en.seconds_used);
  return {
    serverNow: now,
    castsUsed: en.casts_used,
    castsLeft: Math.max(0, e.rules.castBudget - en.casts_used),
    secondsUsed: Math.round(seconds * 100) / 100,
    secondsLeft: Math.max(0, Math.round((e.rules.fishingSeconds - seconds) * 100) / 100),
    nextCast: en.casts_used,
    score: Number(en.score),
    bestWeight: Number(en.best_weight),
    species: en.species,
    fish: en.fish,
    rank,
    entrants,
  };
}

/* ── join ────────────────────────────────────────────────────────────────── */

/** POST /api/entry {op:"join", eventId, playerId, name}. Idempotent: joining again returns where you are. */
export async function handleEntry(sql: Sql, req: ApiReq): Promise<ApiRes> {
  if (req.method !== "POST") return fail(405, "post_only");
  const limited = await writeGuard(sql, req);
  if (limited) return limited;
  const body = asObject(req.body);
  if (!body || body.op !== "join") return fail(400, "unknown_op");
  const eventId = cleanEventId(body.eventId);
  const playerId = cleanId(body.playerId);
  if (!eventId) return fail(400, "bad_event");
  if (!playerId) return fail(400, "bad_player");
  const e = await getEvent(sql, eventId);
  if (!e) return fail(404, "no_such_event");
  if (e.kind === "survival") return fail(400, "survival_uses_its_own_board");
  if (req.now >= e.endsAt) return fail(410, "event_over", { endsAt: e.endsAt });
  if (req.now < e.startsAt - 60_000) return fail(425, "not_started", { startsAt: e.startsAt, serverNow: req.now });

  const name = cleanName(body.name, defaultName(playerId));
  const player = await sql.query<{ banned_ms: number | null }>(
    `insert into players (id, name, created_at) values ($1, $2, ${TS(3)})
     on conflict (id) do update set name = excluded.name
     returning ${MS("banned_until")} as banned_ms`,
    [playerId, name, req.now],
  );
  if (isBanned(player[0]?.banned_ms ?? null, req.now)) return fail(403, "banned", { until: Number(player[0].banned_ms) });

  let en = await getEntry(sql, e.id, playerId);
  if (!en) {
    const max = e.rules.maxPlayers;
    if (max) {
      const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from entries where event_id = $1", [e.id]);
      if (Number(n) >= max) return fail(409, "event_full", { max });
    }
    /* Team events (06 §3.4): pick one of the eight preset teams; each holds four. */
    let team: string | null = null;
    if (e.rules.team) {
      const t = teamById(body.team);
      if (!t) return fail(400, "pick_a_team");
      const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from entries where event_id = $1 and team = $2", [e.id, t.id]);
      if (Number(n) >= TEAM_MAX) return fail(409, "team_full", { max: TEAM_MAX });
      team = t.id;
    }
    await sql.query(
      `insert into entries (event_id, player_id, joined_at, team) values ($1, $2, ${TS(3)}, $4) on conflict do nothing`,
      [e.id, playerId, req.now, team],
    );
    en = await getEntry(sql, e.id, playerId);
  }
  if (!en) return fail(500, "join_failed");
  /* Presence for friends, and any invite to this event is now answered. */
  await sql.query(`update players set last_seen = ${TS(2)}, at_event = $3 where id = $1`, [playerId, req.now, e.id]);
  await sql.query(
    "delete from invites where to_id = $1 and event_id = $2",
    [playerId, e.id],
  );
  const { rank, entrants } = await rankIn(sql, e, Number(en.score), Number(en.tiebreak), req.now);
  return ok({
    event: publicEvent(e, entrants, req.now),
    seed: e.seed,
    rules: e.rules,
    water: e.water,
    waterName: BIOMES[e.water]?.name ?? "",
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    name: en.name,
    team: en.team,
    ...state(e, en, rank, entrants, req.now),
  });
}

/* ── catch ───────────────────────────────────────────────────────────────── */

type Stored = { verdict: string; envelope: Envelope | null; result: Record<string, unknown> | null };

/** JSON with sorted keys: Postgres jsonb does not keep key order, so envelopes are compared in this form. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/** The result block stored with a verified cast and returned to the client. */
function resultOf(r: Extract<Replayed, { ok: true }>) {
  const landed = r.outcome === "landed";
  return {
    outcome: r.outcome,
    why: r.why ?? null,
    seconds: Math.round(r.seconds * 1000) / 1000,
    species: landed ? r.fish.i : null,
    b: landed ? r.fish.b : null,
    name: landed ? r.fish.name : null,
    rarity: landed ? r.fish.t : null,
    mutation: landed ? r.fish.m : null,
    weight: landed ? r.fish.w : 0,
    value: landed ? r.fish.v : 0,
    weather: r.roll.weather,
    window: r.roll.window,
  };
}

async function strike(sql: Sql, eventId: string, playerId: string, now: number): Promise<number> {
  const rows = await sql.query<{ strikes: number }>(
    "update entries set strikes = strikes + 1 where event_id = $1 and player_id = $2 returning strikes",
    [eventId, playerId],
  );
  const n = Number(rows[0]?.strikes ?? 0);
  if (n >= STRIKES_TO_BAN) {
    await sql.query(`update players set banned_until = ${TS(2)} where id = $1`, [playerId, now + BAN_MS]);
  }
  return n;
}

/** Recompute an entry's score from every verified catch it has (the one source of truth). */
async function rescore(sql: Sql, e: EventRow, playerId: string) {
  const rows = await sql.query<{ cast_index: number; result: Record<string, unknown> | string }>(
    "select cast_index, result from catches where event_id = $1 and player_id = $2 and verdict = 'ok' order by cast_index",
    [e.id, playerId],
  );
  const landed: Landed[] = [];
  for (const r of rows) {
    const res = (typeof r.result === "string" ? JSON.parse(r.result) : r.result) as { outcome?: string; species?: number; weight?: number; value?: number };
    if (res?.outcome === "landed" && typeof res.species === "number") {
      landed.push({ castIndex: r.cast_index, species: res.species, weight: Number(res.weight), value: Number(res.value) });
    }
  }
  const s = scoreEntry(e.rules.category, landed);
  await sql.query(
    `update entries set score = $3, tiebreak = $4, best_weight = $5, species = $6, fish = $7 where event_id = $1 and player_id = $2`,
    [e.id, playerId, s.score, s.tiebreak, s.best, s.kinds, s.fish],
  );
}

/** POST /api/catch {eventId, playerId, envelope}. Verify, then score. */
export async function handleCatch(sql: Sql, req: ApiReq): Promise<ApiRes> {
  if (req.method !== "POST") return fail(405, "post_only");
  const limited = await writeGuard(sql, req);
  if (limited) return limited;
  const body = asObject(req.body);
  if (!body) return fail(400, "bad_body");
  const eventId = cleanEventId(body.eventId);
  const playerId = cleanId(body.playerId);
  if (!eventId) return fail(400, "bad_event");
  if (!playerId) return fail(400, "bad_player");
  const parsed = parseEnvelope(body.envelope);
  if (!parsed.ok) return fail(400, "bad_envelope", { verdict: "mismatch", reason: parsed.reason });
  const env = parsed.env;
  const now = req.now;

  const e = await getEvent(sql, eventId);
  if (!e) return fail(404, "no_such_event");
  if (e.kind === "survival") return fail(400, "survival_uses_its_own_board");
  const en = await getEntry(sql, e.id, playerId);
  if (!en) return fail(403, "not_joined");
  if (isBanned(en.banned_ms, now)) return fail(403, "banned", { verdict: "banned", until: Number(en.banned_ms) });

  const reply = async (verdict: string, extra: Record<string, unknown> = {}, status = 200): Promise<ApiRes> => {
    const fresh = (await getEntry(sql, e.id, playerId)) ?? en;
    const { rank, entrants } = await rankIn(sql, e, Number(fresh.score), Number(fresh.tiebreak), now);
    return { status, body: { verdict, ...extra, ...state(e, fresh, rank, entrants, now) } };
  };

  /* A resend of a cast we already judged gets the same answer (a lost reply must not cost a strike). */
  const prior = await sql.query<{ verdict: string; envelope: Envelope | string; result: Record<string, unknown> | string | null }>(
    "select verdict, envelope, result from catches where event_id = $1 and player_id = $2 and cast_index = $3",
    [e.id, playerId, env.castIndex],
  );
  if (prior[0]) {
    const old: Stored = {
      verdict: prior[0].verdict,
      envelope: (typeof prior[0].envelope === "string" ? JSON.parse(prior[0].envelope) : prior[0].envelope) as Envelope,
      result: (typeof prior[0].result === "string" ? JSON.parse(prior[0].result) : prior[0].result) as Record<string, unknown> | null,
    };
    if (canon(old.envelope) === canon(env)) return reply(old.verdict, { result: old.result, again: true });
    return reply("stale", { reason: "cast_index_reused" });
  }
  if (env.castIndex !== en.casts_used) return reply("stale", { reason: "cast_index", expected: en.casts_used });

  /* The clock. */
  if (now > e.endsAt + WINDOW_SLACK_MS) return reply("stale", { reason: "event_over" });
  if (env.at < e.startsAt - WINDOW_SLACK_MS || env.at > e.endsAt + WINDOW_SLACK_MS) return reply("stale", { reason: "outside_window" });
  if (env.at > now + AT_AHEAD_MS || env.at < now - AT_BEHIND_MS) return reply("stale", { reason: "clock" });

  /* How often. Answered, not stored, so an honest client simply tries again a moment later. */
  if (now - Number(en.last_ms) < ENVELOPE_GAP_MS) {
    const n = await strike(sql, e.id, playerId, now);
    return reply("rate", { reason: "too_fast", strikes: n }, 429);
  }

  const record = async (verdict: string, result: unknown, cost: number) => {
    const rows = await sql.query<{ id: number }>(
      `insert into catches (event_id, player_id, cast_index, envelope, verdict, result, created_at)
       values ($1, $2, $3, $4::jsonb, $5, $6::jsonb, ${TS(7)}) on conflict do nothing returning id`,
      [e.id, playerId, env.castIndex, JSON.stringify(env), verdict, result == null ? null : JSON.stringify(result), now],
    );
    if (!rows.length) return false; // a concurrent request judged this cast first
    await sql.query(
      `update entries set casts_used = casts_used + 1, seconds_used = seconds_used + $3, last_ms = $4
        where event_id = $1 and player_id = $2`,
      [e.id, playerId, cost, now],
    );
    return true;
  };

  /* Budgets: casts first. */
  if (en.casts_used >= e.rules.castBudget) {
    await record("budget", { reason: "casts" }, 0);
    return reply("budget", { reason: "casts" });
  }

  /* The replay. */
  const rep = replayCast({ id: e.id, seed: e.seed, water: e.water, startsAt: e.startsAt }, playerId, env);
  if (!rep.ok) {
    await record("mismatch", { reason: rep.reason }, 0);
    const n = await strike(sql, e.id, playerId, now);
    return reply("mismatch", { reason: rep.reason, strikes: n });
  }
  if (!claimMatches(env.claim, rep)) {
    await record("mismatch", { reason: "claim", ...resultOf(rep) }, 0);
    const n = await strike(sql, e.id, playerId, now);
    return reply("mismatch", { reason: "claim", strikes: n });
  }

  /* Time: the cast's own cost against the event's fishing seconds … */
  const cost = rep.seconds;
  const used = Number(en.seconds_used);
  if (used + cost > e.rules.fishingSeconds + 1e-6) {
    await record("budget", { reason: "seconds", seconds: cost }, 0);
    return reply("budget", { reason: "seconds" });
  }
  /* … and against the wall clock: nobody fishes 20 minutes of casts in 2 minutes. */
  if (used + cost > (now - Number(en.joined_ms)) / 1000 + WALL_SLACK_S) {
    const n = await strike(sql, e.id, playerId, now);
    return reply("rate", { reason: "faster_than_the_clock", strikes: n }, 429);
  }

  const result = resultOf(rep);
  if (!(await record("ok", result, cost))) return reply("stale", { reason: "cast_index_reused" });
  await rescore(sql, e, playerId);
  return reply("ok", { result });
}
