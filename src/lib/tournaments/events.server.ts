/* Events: the schedule written to the database on demand, the open list, and private events
   (docs/architecture/06 §1.2 events.ts). */

import type { Sql } from "@/lib/db";
import { BIOMES } from "@/game/content";
import { rulesVersionOf } from "@/game/line-wear";
import {
  CODE_LETTERS,
  isCode,
  MAX_LIVE_PER_CREATOR,
  privateSpec,
  schedule,
  type EventSpec,
  type Rules,
} from "@/game/schedule";
import {
  asObject,
  cleanId,
  cleanName,
  defaultName,
  fail,
  MS,
  ok,
  readGuard,
  TS,
  writeGuard,
  type ApiReq,
  type ApiRes,
} from "./common.server.ts";

export type EventRow = {
  id: string;
  kind: EventSpec["kind"];
  title: string;
  water: number;
  rules: Rules;
  seed: number;
  startsAt: number;
  endsAt: number;
  series: string | null;
  createdBy: string | null;
};

const COLUMNS = `id, kind, title, water, rules, seed::float8 as seed, ${MS("starts_at")} as starts_ms, ${MS("ends_at")} as ends_ms, series, created_by`;

type Raw = {
  id: string;
  kind: EventSpec["kind"];
  title: string;
  water: number;
  rules: Rules | string;
  seed: number;
  starts_ms: number;
  ends_ms: number;
  series: string | null;
  created_by: string | null;
};

export function toEvent(r: Raw): EventRow {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    water: Number(r.water),
    rules: typeof r.rules === "string" ? (JSON.parse(r.rules) as Rules) : r.rules,
    seed: Number(r.seed),
    startsAt: Number(r.starts_ms),
    endsAt: Number(r.ends_ms),
    series: r.series,
    createdBy: r.created_by,
  };
}

export async function getEvent(sql: Sql, id: string): Promise<EventRow | null> {
  const rows = await sql.query<Raw>(`select ${COLUMNS} from events where id = $1`, [id]);
  return rows[0] ? toEvent(rows[0]) : null;
}

/** Insert one event if it is not there yet. True when this call created it. */
export async function insertEvent(sql: Sql, e: EventSpec, createdBy: string | null = null): Promise<boolean> {
  const rows = await sql.query<{ id: string }>(
    `insert into events (id, kind, title, water, rules, seed, starts_at, ends_at, series, created_by)
     values ($1, $2, $3, $4, $5::jsonb, $6, ${TS(7)}, ${TS(8)}, $9, $10)
     on conflict (id) do nothing returning id`,
    [e.id, e.kind, e.title, e.water, JSON.stringify(e.rules), e.seed, e.startsAt, e.endsAt, e.series, createdBy],
  );
  return rows.length > 0;
}

/** Write the calendar for `now` (idempotent: the same event is never inserted twice). */
export async function materialise(sql: Sql, now: number): Promise<void> {
  for (const e of schedule(now)) await insertEvent(sql, e);
}

export function publicEvent(e: EventRow, entrants: number, now: number) {
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    water: e.water,
    waterName: BIOMES[e.water]?.name ?? "",
    category: e.rules.category,
    castBudget: e.rules.castBudget,
    fishingSeconds: e.rules.fishingSeconds,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    series: e.series,
    entrants,
    /* WP-8: team events, the most anglers, and the four-letter code of a private event. */
    team: !!e.rules.team,
    /* WP-14: the fight/line rules this event is replayed with (an old row has none: version 1). */
    rulesVersion: rulesVersionOf(e.rules.rulesVersion),
    maxPlayers: e.rules.maxPlayers ?? null,
    code: e.kind === "private" ? e.id.slice(2) : null,
    state: now < e.startsAt ? "upcoming" : now < e.endsAt ? "live" : "ended",
  };
}

/** GET /api/events?scope=open[&playerId=…]  ·  GET /api/events?code=ABCD  ·  POST {op:"create", …} */
export async function handleEvents(sql: Sql, req: ApiReq): Promise<ApiRes> {
  if (req.method === "GET") {
    const limited = await readGuard(sql, req);
    if (limited) return limited;
    const code = req.url.searchParams.get("code");
    if (code) {
      const c = code.toUpperCase();
      if (!isCode(c)) return fail(400, "bad_code");
      const e = await getEvent(sql, `p-${c}`);
      if (!e) return fail(404, "no_such_code");
      const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from entries where event_id = $1", [e.id]);
      return ok({ serverNow: req.now, event: publicEvent(e, Number(n), req.now) });
    }
    if ((req.url.searchParams.get("scope") ?? "open") !== "open") return fail(400, "bad_scope");
    await materialise(sql, req.now);
    const playerId = cleanId(req.url.searchParams.get("playerId"));
    /* Open = not over yet, public (private events are found by code), soonest first. */
    const rows = await sql.query<Raw & { entrants: number; mine: boolean }>(
      `select ${COLUMNS},
              (select count(*)::int from entries en where en.event_id = e.id) as entrants,
              exists (select 1 from entries en where en.event_id = e.id and en.player_id = $2) as mine
         from events e
        where e.kind <> 'private' and e.ends_at > ${TS(1)}
        order by e.starts_at asc, e.id asc`,
      [req.now, playerId ?? ""],
    );
    /* Private events this player made or joined and that are not over: the lobby's Private tab. */
    const mine = playerId
      ? await sql.query<Raw & { entrants: number }>(
          `select ${COLUMNS}, (select count(*)::int from entries en where en.event_id = e.id) as entrants
             from events e
            where e.kind = 'private' and e.ends_at > ${TS(1)}
              and (e.created_by = $2 or exists (select 1 from entries en where en.event_id = e.id and en.player_id = $2))
            order by e.ends_at asc`,
          [req.now, playerId],
        )
      : [];
    return ok({
      serverNow: req.now,
      events: rows.map((r) => ({ ...publicEvent(toEvent(r), Number(r.entrants), req.now), joined: !!r.mine })),
      privates: mine.map((r) => ({ ...publicEvent(toEvent(r), Number(r.entrants), req.now), joined: true })),
    });
  }

  const limited = await writeGuard(sql, req);
  if (limited) return limited;
  const body = asObject(req.body);
  if (!body || body.op !== "create") return fail(400, "unknown_op");
  const playerId = cleanId(body.playerId);
  if (!playerId) return fail(400, "bad_player");
  const live = await sql.query<{ n: number }>(
    `select count(*)::int as n from events where created_by = $1 and kind = 'private' and ends_at > ${TS(2)}`,
    [playerId, req.now],
  );
  if (Number(live[0]?.n ?? 0) >= MAX_LIVE_PER_CREATOR) return fail(429, "too_many_events", { max: MAX_LIVE_PER_CREATOR });
  const name = cleanName(body.name, defaultName(playerId));
  await sql.query(
    `insert into players (id, name, created_at) values ($1, $2, ${TS(3)})
     on conflict (id) do update set name = excluded.name`,
    [playerId, name, req.now],
  );
  const ask = asObject(body.rules);
  for (let attempt = 0; attempt < 8; attempt++) {
    const bytes = new Uint8Array(4);
    globalThis.crypto.getRandomValues(bytes);
    const code = Array.from(bytes, (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join("");
    const spec = privateSpec(code, body.water, ask, body.minutes, req.now);
    if (await insertEvent(sql, spec, playerId)) {
      return ok({ serverNow: req.now, code, event: publicEvent({ ...spec, createdBy: playerId }, 0, req.now) });
    }
  }
  return fail(503, "no_free_code");
}
