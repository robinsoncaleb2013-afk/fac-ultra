/* Leaderboards (docs/architecture/06 §1.2 board.ts) and the daily Survival board (survival-board.ts). */

import type { Sql } from "@/lib/db";
import { BIOMES } from "@/game/content";
import { claimMatches, parseEnvelope, replayCast, type ReplayEvent } from "@/game/replay";
import { fillCount, rivalRows } from "@/game/fill";
import { rankTeams, type TeamRow } from "@/game/social";
import { finalizeEvent } from "./awards.server.ts";
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
  /** A Regular topping up a short Quick board (06 §3.2); `portrait` is their emoji. */
  rival?: boolean;
  portrait?: string;
  /** The preset team id, in a team event. */
  team?: string | null;
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
  team?: string | null;
  tb?: number;
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
  ...(r.team !== undefined ? { team: r.team } : {}),
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
  if (final) await finalizeEvent(sql, e, req.now);

  /* Asking about the board while fishing is also the heartbeat friends see (presence, 06 §3.3). */
  if (me && req.now < e.endsAt) {
    await sql.query(
      `update players set last_seen = ${TS(2)}, at_event = $3 where id = $1 and exists (select 1 from entries where event_id = $3 and player_id = $1)`,
      [me, req.now, e.id],
    );
  }

  const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from entries where event_id = $1", [e.id]);
  const humans = Number(n);
  const fill = fillCount(e.kind, humans);
  const limit = final ? 3 : top;
  let mapped: BoardRow[];
  if (fill) {
    /* A short Quick board: every human (there are fewer than six) plus the Regulars, ranked together. */
    const all = await sql.query<Raw>(
      `select e.player_id as pid, p.name, e.score::float8 as score, e.tiebreak::float8 as tb, e.best_weight::float8 as best,
              e.species, e.fish, e.casts_used as casts, e.team, 0 as rk, 0 as rn
         from entries e join players p on p.id = e.player_id where e.event_id = $1`,
      [e.id],
    );
    const rivals = rivalRows({ id: e.id, seed: e.seed, water: e.water, startsAt: e.startsAt, endsAt: e.endsAt, category: e.rules.category, castBudget: e.rules.castBudget }, fill, req.now);
    type Item = { row: BoardRow; tb: number; human: boolean };
    const items: Item[] = [
      ...all.map((r) => ({ row: toRow(r, me), tb: Number(r.tb ?? 0), human: true })),
      ...rivals.map((r) => ({
        row: { rank: 0, name: r.rival.name, score: r.score, bestWeight: r.best, species: r.kinds, fish: r.fish, casts: r.casts, you: false, rival: true, portrait: r.rival.emoji } as BoardRow,
        tb: r.tiebreak,
        human: false,
      })),
    ];
    items.sort((a, b) => b.row.score - a.row.score || b.tb - a.tb || Number(b.human) - Number(a.human) || a.row.name.localeCompare(b.row.name));
    items.forEach((it, i) => {
      const ahead = items.filter((o) => o.row.score > it.row.score || (o.row.score === it.row.score && o.tb > it.tb)).length;
      it.row.rank = ahead + 1;
      void i;
    });
    const mine = items.findIndex((it) => it.row.you);
    mapped = items
      .filter((_, i) => i < limit || (mine >= 0 && Math.abs(i - mine) <= 2))
      .map((it) => it.row);
  } else {
    const rows = await sql.query<Raw>(
      `with ranked as (
         select e.player_id as pid, p.name, e.score::float8 as score, e.best_weight::float8 as best, e.species, e.fish,
                e.casts_used as casts, e.team,
                rank() over (order by e.score desc, e.tiebreak desc) as rk,
                row_number() over (order by e.score desc, e.tiebreak desc, e.joined_at asc, e.player_id) as rn
           from entries e join players p on p.id = e.player_id
          where e.event_id = $1)
       select * from ranked
        where rn <= $2 or pid = $3::text
           or rn between (select rn - 2 from ranked where pid = $3::text) and (select rn + 2 from ranked where pid = $3::text)
        order by rn`,
      [e.id, limit, me],
    );
    mapped = rows.map((r) => toRow(r, me));
  }
  if (!e.rules.team) for (const r of mapped) delete r.team;

  /* Team events: the board adds each team's Total Weight (06 §3.4). */
  let teams: TeamRow[] | undefined;
  if (e.rules.team) {
    const t = await sql.query<{ team: string; score: number; best: number; members: number; fish: number }>(
      `select team, sum(score)::float8 as score, max(best_weight)::float8 as best, count(*)::int as members, sum(fish)::int as fish
         from entries where event_id = $1 and team is not null group by team order by sum(score) desc, max(best_weight) desc, team`,
      [e.id],
    );
    const myTeam = me ? ((await sql.query<{ team: string | null }>("select team from entries where event_id = $1 and player_id = $2", [e.id, me]))[0]?.team ?? null) : null;
    teams = rankTeams(t).map((r) => ({ ...r, you: myTeam != null && r.team === myTeam }));
  }

  return ok(
    {
      eventId: e.id,
      title: e.title,
      kind: e.kind,
      category: e.rules.category,
      state: req.now < e.startsAt ? "upcoming" : req.now < e.endsAt ? "live" : "ended",
      endsAt: e.endsAt,
      serverNow: req.now,
      entrants: humans + fill,
      humans,
      final,
      rows: mapped,
      me: mapped.find((r) => r.you) ?? null,
      ...(teams ? { teams } : {}),
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
