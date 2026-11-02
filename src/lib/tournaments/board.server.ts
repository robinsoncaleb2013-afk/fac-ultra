/* Leaderboards (docs/architecture/06 §1.2 board.ts) and the daily Survival board (survival-board.ts). */

import type { Sql } from "@/lib/db";
import { BIOMES } from "@/game/content";
import { claimMatches, parseEnvelope, replayCast, type ReplayEvent } from "@/game/replay";
import { dateStamp, DAY, survivalAt, survivalId, SURVIVAL_WATERS, survivalSeed } from "@/game/schedule";
import {
  asObject,
  cleanEventId,
  cleanId,
  cleanName,
  clampInt,
  defaultName,
  fail,
  ok,
  readGuard,
  TS,
  writeGuard,
  type ApiReq,
  type ApiRes,
} from "./common.server.ts";
import { getEvent, insertEvent } from "./events.server.ts";

export type BoardRow = {
  rank: number;
  name: string;
  score: number;
  bestWeight: number;
  species: number;
  fish: number;
  casts: number;
  you: boolean;
};

type Raw = {
  pid: string;
  name: string;
  score: number;
  best: number;
  species: number;
  fish: number;
  casts: number;
  rk: number;
  rn: number;
};

const toRow = (r: Raw, me: string | null): BoardRow => ({
  rank: Number(r.rk),
  name: r.name,
  score: Number(r.score),
  bestWeight: Number(r.best),
  species: Number(r.species),
  fish: Number(r.fish),
  casts: Number(r.casts),
  you: me != null && r.pid === me,
});

/** GET /api/board?eventId=…[&top=25][&around=playerId][&final=1]  ·  ?series=w-… (the weekly's waters added up).
    The top N plus the five rows around the player. Cached for five seconds (no player in the key). */
export async function handleBoard(sql: Sql, req: ApiReq): Promise<ApiRes> {
  if (req.method !== "GET") return fail(405, "get_only");
  const limited = await readGuard(sql, req);
  if (limited) return limited;
  const q = req.url.searchParams;
  const top = clampInt(q.get("top"), 1, 100, 25);
  const me = cleanId(q.get("around"));
  const cache = me ? "private, max-age=5" : "public, max-age=5, s-maxage=5, stale-while-revalidate=5";

  const series = q.get("series");
  if (series) {
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(series)) return fail(400, "bad_series");
    const rows = await sql.query<Raw>(
      `with sums as (
         select e.player_id as pid, p.name, sum(e.score)::float8 as score, max(e.best_weight)::float8 as best,
                sum(e.species)::int as species, sum(e.fish)::int as fish, sum(e.casts_used)::int as casts
           from entries e join players p on p.id = e.player_id join events v on v.id = e.event_id
          where v.series = $1 group by e.player_id, p.name),
       ranked as (
         select *, rank() over (order by score desc) as rk, row_number() over (order by score desc, pid) as rn from sums)
       select * from ranked where rn <= $2 or pid = $3::text order by rn`,
      [series, top, me],
    );
    return ok({ series, rows: rows.map((r) => toRow(r, me)) }, cache);
  }

  const eventId = cleanEventId(q.get("eventId"));
  if (!eventId) return fail(400, "bad_event");
  const e = await getEvent(sql, eventId);
  if (!e) return fail(404, "no_such_event");
  if (e.kind === "survival") return fail(400, "survival_uses_its_own_board");
  const final = q.get("final") === "1";
  if (final && req.now < e.endsAt) return fail(409, "not_over_yet", { endsAt: e.endsAt });

  const rows = await sql.query<Raw>(
    `with ranked as (
       select e.player_id as pid, p.name, e.score::float8 as score, e.best_weight::float8 as best, e.species, e.fish,
              e.casts_used as casts,
              rank() over (order by e.score desc, e.tiebreak desc) as rk,
              row_number() over (order by e.score desc, e.tiebreak desc, e.joined_at asc, e.player_id) as rn
         from entries e join players p on p.id = e.player_id
        where e.event_id = $1)
     select * from ranked
      where rn <= $2 or pid = $3::text
         or rn between (select rn - 2 from ranked where pid = $3::text) and (select rn + 2 from ranked where pid = $3::text)
      order by rn`,
    [e.id, final ? 3 : top, me],
  );
  const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from entries where event_id = $1", [e.id]);
  const mapped = rows.map((r) => toRow(r, me));
  return ok(
    {
      eventId: e.id,
      title: e.title,
      category: e.rules.category,
      state: req.now < e.startsAt ? "upcoming" : req.now < e.endsAt ? "live" : "ended",
      endsAt: e.endsAt,
      serverNow: req.now,
      entrants: Number(n),
      final,
      rows: mapped,
      me: mapped.find((r) => r.you) ?? null,
    },
    final && req.now >= e.endsAt ? "public, max-age=60" : cache,
  );
}

/* ── Survival (06 §1.2 survival-board) ────────────────────────────────────────────────────────── */

export const SURVIVAL_MAX_DAYS = 60;
/** Until WP-5 supplies the real day rules, a run can claim at most this many days per fish it landed (plus the first). */
export const SURVIVAL_DAYS_PER_FISH = 3;

type SurvivalRaw = { name: string; days: number; fish_eaten: number; biggest: number; rk: number; pid: string };

/** GET /api/survival-board?date=YYYY-MM-DD&water=n  ·  POST {playerId, name, date, water, run:{days,fishEaten,biggest}, log:[Envelope…]}.
    The server replays every cast in the log from the daily seed, so the fish and the biggest catch are real;
    the day count is bounded by what the fish could have fed. */
export async function handleSurvivalBoard(sql: Sql, req: ApiReq): Promise<ApiRes> {
  const dailyOf = (date: unknown, water: unknown) => {
    const d = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    const w = typeof water === "number" ? water : typeof water === "string" && water.trim() ? Number(water) : NaN;
    if (!d || !Number.isInteger(w) || !SURVIVAL_WATERS.includes(w)) return null;
    return { date: d, water: w, id: survivalId(d, w) };
  };

  if (req.method === "GET") {
    const limited = await readGuard(sql, req);
    if (limited) return limited;
    const today = survivalAt(req.now);
    const day = dailyOf(req.url.searchParams.get("date") ?? dateStamp(today.startsAt), req.url.searchParams.get("water") ?? today.water);
    if (!day) return fail(400, "bad_day");
    const me = cleanId(req.url.searchParams.get("around"));
    const rows = await sql.query<SurvivalRaw>(
      `with ranked as (
         select r.player_id as pid, p.name, r.days, r.fish_eaten, r.biggest::float8 as biggest,
                rank() over (order by r.days desc, r.fish_eaten desc) as rk
           from survival_runs r join players p on p.id = r.player_id where r.event_id = $1)
       select * from ranked order by rk, pid limit 25`,
      [day.id],
    );
    return ok(
      {
        eventId: day.id,
        date: day.date,
        water: day.water,
        waterName: BIOMES[day.water].name,
        seed: survivalSeed(day.date, day.water),
        rows: rows.map((r) => ({ rank: Number(r.rk), name: r.name, days: r.days, fishEaten: r.fish_eaten, biggest: Number(r.biggest), you: me != null && r.pid === me })),
      },
      "public, max-age=10",
    );
  }

  const limited = await writeGuard(sql, req);
  if (limited) return limited;
  const body = asObject(req.body);
  const playerId = cleanId(body?.playerId);
  const day = dailyOf(body?.date, body?.water);
  const run = asObject(body?.run);
  if (!body || !playerId || !day || !run) return fail(400, "bad_body");
  /* Today's seed, or yesterday's for a run that crossed midnight. Nothing older. */
  const today = dateStamp(req.now);
  const yesterday = dateStamp(req.now - DAY);
  if (day.date !== today && day.date !== yesterday) return fail(410, "seed_expired");
  const days = run.days;
  const eaten = run.fishEaten;
  const biggest = run.biggest;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > SURVIVAL_MAX_DAYS) return fail(400, "bad_days");
  if (typeof eaten !== "number" || !Number.isInteger(eaten) || eaten < 0 || eaten > 5000) return fail(400, "bad_fish");
  if (typeof biggest !== "number" || !Number.isFinite(biggest) || biggest < 0 || biggest > 1e5) return fail(400, "bad_biggest");
  const log = body.log;
  if (!Array.isArray(log) || log.length > 600) return fail(400, "bad_log");

  /* Replay every cast from the daily seed. */
  const startsAt = Date.parse(`${day.date}T00:00:00Z`);
  const ev: ReplayEvent = { id: day.id, seed: survivalSeed(day.date, day.water), water: day.water, startsAt };
  let landed = 0;
  let heaviest = 0;
  for (let i = 0; i < log.length; i++) {
    const p = parseEnvelope(log[i]);
    if (!p.ok) return fail(400, "bad_log_entry", { verdict: "mismatch", index: i, reason: p.reason });
    if (p.env.castIndex !== i) return fail(400, "bad_log_entry", { verdict: "mismatch", index: i, reason: "cast_index" });
    const r = replayCast(ev, playerId, p.env);
    if (!r.ok) return fail(422, "log_does_not_replay", { verdict: "mismatch", index: i, reason: r.reason });
    if (!claimMatches(p.env.claim, r)) return fail(422, "log_does_not_replay", { verdict: "mismatch", index: i, reason: "claim" });
    if (r.outcome === "landed") {
      landed++;
      heaviest = Math.max(heaviest, r.fish.w);
    }
  }
  if (eaten > landed) return fail(422, "more_fish_than_the_log_lands", { verdict: "mismatch", landed });
  if (Math.abs(biggest - heaviest) > 0.05) return fail(422, "biggest_does_not_match", { verdict: "mismatch", heaviest });
  if (days > 1 + landed * SURVIVAL_DAYS_PER_FISH) return fail(422, "more_days_than_the_fish_could_feed", { verdict: "mismatch", landed });

  const spec = survivalAt(startsAt);
  if (spec.id === day.id) await insertEvent(sql, spec); // keep the daily's row for history; others are seeds only
  const name = cleanName(body.name, defaultName(playerId));
  await sql.query(
    `insert into players (id, name, created_at) values ($1, $2, ${TS(3)}) on conflict (id) do update set name = excluded.name`,
    [playerId, name, req.now],
  );
  const stored = await sql.query<{ days: number; fish_eaten: number }>(
    `insert into survival_runs (event_id, player_id, days, fish_eaten, biggest, log, created_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, ${TS(7)})
     on conflict (event_id, player_id) do update
       set days = excluded.days, fish_eaten = excluded.fish_eaten, biggest = excluded.biggest, log = excluded.log, created_at = excluded.created_at
       where (excluded.days, excluded.fish_eaten) > (survival_runs.days, survival_runs.fish_eaten)
     returning days, fish_eaten`,
    [day.id, playerId, days, eaten, biggest, JSON.stringify(log), req.now],
  );
  const ranked = await sql.query<{ rk: number; total: number }>(
    `select (select count(*) from survival_runs where event_id = $1 and (days, fish_eaten) > (select days, fish_eaten from survival_runs where event_id = $1 and player_id = $2))::int + 1 as rk,
            (select count(*) from survival_runs where event_id = $1)::int as total`,
    [day.id, playerId],
  );
  return ok({ verdict: "ok", improved: stored.length > 0, rank: Number(ranked[0]?.rk ?? 1), runs: Number(ranked[0]?.total ?? 1), landed, serverNow: req.now });
}
