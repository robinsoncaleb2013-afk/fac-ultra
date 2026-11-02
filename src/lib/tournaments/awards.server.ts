/* What an event leaves behind (docs/architecture/06 §3.5): the final standings written once, and the
   read that feeds the client's trophy cabinet and the Lodge's Tournament history.

   The server is the only source of medals. An event is "finalized" the first time anybody looks at it
   after it ends (the player's trophies request, or a final board): there is no timer and no cron job.
   Finalizing is idempotent, so two requests racing each other write the same rows once. */

import type { Sql } from "@/lib/db";
import { fillCount, rivalRows, rivalsAhead } from "@/game/fill";
import { medalFor, rankTeams } from "@/game/social";
import {
  cleanId,
  fail,
  MS,
  ok,
  readGuard,
  TS,
  type ApiReq,
  type ApiRes,
} from "./common.server.ts";
import { getEvent, type EventRow } from "./events.server.ts";

type EntryRow = { pid: string; score: number; tiebreak: number; best: number; team: string | null };

/** Write the final standings of an ended event. Does nothing if it is not over or was already done. */
export async function finalizeEvent(sql: Sql, e: EventRow, now: number): Promise<void> {
  if (e.kind === "survival" || now < e.endsAt) return;
  const done = await sql.query("select 1 from event_final where event_id = $1", [e.id]);
  if (done.length) return;
  const entries = await sql.query<EntryRow>(
    `select player_id as pid, score::float8 as score, tiebreak::float8 as tiebreak, best_weight::float8 as best, team
       from entries where event_id = $1`,
    [e.id],
  );
  if (entries.length) {
    const humans = entries.length;
    const fill = fillCount(e.kind, humans);
    const rivals = fill
      ? rivalRows({ id: e.id, seed: e.seed, water: e.water, startsAt: e.startsAt, endsAt: e.endsAt, category: e.rules.category, castBudget: e.rules.castBudget }, fill, e.endsAt)
      : [];
    const entrants = humans + rivals.length;

    /* Teams: each team's rank is its Total Weight added up; a medal needs two teams on the board. */
    const teamRank = new Map<string, number>();
    if (e.rules.team) {
      const sums = new Map<string, { team: string; score: number; best: number; members: number; fish: number }>();
      for (const r of entries) {
        if (!r.team) continue;
        const t = sums.get(r.team) ?? { team: r.team, score: 0, best: 0, members: 0, fish: 0 };
        t.score += Number(r.score);
        t.best = Math.max(t.best, Number(r.best));
        t.members += 1;
        sums.set(r.team, t);
      }
      for (const t of rankTeams([...sums.values()])) teamRank.set(t.team, t.rank);
    }
    const teamsOnBoard = teamRank.size;
    const teamScore = new Map<string, number>();
    for (const r of entries) if (r.team) teamScore.set(r.team, (teamScore.get(r.team) ?? 0) + Number(r.score));

    const rows = entries.map((r) => {
      const score = Number(r.score);
      const ahead = entries.filter((o) => Number(o.score) > score || (Number(o.score) === score && Number(o.tiebreak) > Number(r.tiebreak))).length;
      const rank = ahead + rivalsAhead(rivals, score, Number(r.tiebreak)) + 1;
      const tr = r.team ? (teamRank.get(r.team) ?? null) : null;
      const medal = e.rules.team ? (tr != null ? medalFor(tr, teamsOnBoard, teamScore.get(r.team ?? "") ?? 0) : 0) : medalFor(rank, entrants, score);
      return { player_id: r.pid, rank, entrants, humans, score, best_weight: Number(r.best), medal, team: r.team, team_rank: tr };
    });
    await sql.query(
      `insert into results (event_id, player_id, rank, entrants, humans, score, best_weight, medal, team, team_rank, ended_at)
       select $1, x.player_id, x.rank, x.entrants, x.humans, x.score, x.best_weight, x.medal, x.team, x.team_rank, ${TS(3)}
         from jsonb_to_recordset($2::jsonb) as x(player_id text, rank int, entrants int, humans int, score numeric, best_weight numeric, medal int, team text, team_rank int)
       on conflict do nothing`,
      [e.id, JSON.stringify(rows), e.endsAt],
    );
  }
  await sql.query("insert into event_final (event_id) values ($1) on conflict do nothing", [e.id]);
}

type ResultRaw = {
  id: string;
  title: string;
  kind: string;
  water: number;
  rules: { category?: string } | string;
  team: string | null;
  rank: number;
  entrants: number;
  score: number;
  best: number;
  at: number;
  medal: number;
};

/** GET /api/trophies?playerId=… : this player's finished events, newest first (the last 50), with medals.
    Looks first for events that ended since the last visit and writes their results. */
export async function handleTrophies(sql: Sql, req: ApiReq): Promise<ApiRes> {
  if (req.method !== "GET") return fail(405, "get_only");
  const limited = await readGuard(sql, req);
  if (limited) return limited;
  const playerId = cleanId(req.url.searchParams.get("playerId"));
  if (!playerId) return fail(400, "bad_player");

  const waiting = await sql.query<{ id: string }>(
    `select ev.id from entries en
       join events ev on ev.id = en.event_id
      where en.player_id = $1 and ev.ends_at <= ${TS(2)} and ev.kind <> 'survival'
        and not exists (select 1 from event_final f where f.event_id = ev.id)
      order by ev.ends_at desc limit 25`,
    [playerId, req.now],
  );
  for (const w of waiting) {
    const e = await getEvent(sql, w.id);
    if (e) await finalizeEvent(sql, e, req.now);
  }

  const rows = await sql.query<ResultRaw>(
    `select ev.id, ev.title, ev.kind, ev.water, ev.rules, r.team, r.rank, r.entrants, r.score::float8 as score,
            r.best_weight::float8 as best, ${MS("r.ended_at")} as at,
            r.medal
       from results r join events ev on ev.id = r.event_id
      where r.player_id = $1
      order by r.ended_at desc limit 50`,
    [playerId],
  );
  return ok({
    serverNow: req.now,
    results: rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      water: Number(r.water),
      category: (typeof r.rules === "string" ? (JSON.parse(r.rules) as { category?: string }) : r.rules)?.category ?? "total",
      team: r.team,
      rank: Number(r.rank),
      entrants: Number(r.entrants),
      score: Number(r.score),
      best: Number(r.best),
      at: Number(r.at),
      medal: Number(r.medal),
    })),
  });
}
