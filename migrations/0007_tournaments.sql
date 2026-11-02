-- WP-7: server-verified tournaments (docs/architecture/06 §1.1) and the Neon-backed signaling relay.
-- Postgres + PGLite compatible. Lives at the top of migrations/ because neither applier descends
-- into sub-folders (scripts/migration-plan.mjs). Idempotent: safe to run twice.

create table if not exists events (
  id text primary key,                 -- "q-2026110213", "d-2026-11-02", "w-2026-11-02-5", "s-2026-11-02-3", "p-ABCD"
  kind text not null,                  -- quick | daily | weekly | private | survival
  title text not null,
  water int not null,
  rules jsonb not null,                -- {category, castBudget, fishingSeconds, assist:false, gear:"fixed", maxPlayers?}
  seed bigint not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  series text,                         -- events that add up together (the weekly's three waters)
  created_by text,                     -- player id, private events only
  created_at timestamptz not null default now()
);
create index if not exists events_window on events (ends_at, starts_at);
create index if not exists events_series on events (series);
create index if not exists events_creator on events (created_by, ends_at);

create table if not exists players (
  id text primary key,                 -- anonymous device id now; the account id after WP-9 (same column)
  name text not null,
  created_at timestamptz not null default now(),
  banned_until timestamptz
);

create table if not exists entries (
  event_id text not null references events(id),
  player_id text not null references players(id),
  joined_at timestamptz not null default now(),
  casts_used int not null default 0,
  seconds_used numeric not null default 0,
  score numeric not null default 0,    -- server-computed from verified catches (scoring.ts)
  tiebreak numeric not null default 0,
  best_weight numeric not null default 0,
  species int not null default 0,
  fish int not null default 0,
  strikes int not null default 0,      -- rate and mismatch violations; three bans the player for an hour
  last_ms bigint not null default 0,   -- when the last envelope was accepted, server ms
  primary key (event_id, player_id)
);
create index if not exists entries_board on entries (event_id, score desc, tiebreak desc);

create table if not exists catches (
  id bigserial primary key,
  event_id text not null,
  player_id text not null,
  cast_index int not null,
  envelope jsonb not null,             -- what the client sent
  verdict text not null,               -- ok | mismatch | budget | stale   (rate is answered, never stored)
  result jsonb,                        -- the server's own replay
  created_at timestamptz not null default now(),
  unique (event_id, player_id, cast_index)
);

-- Daily Survival board (06 §1.2 survival-board): one verified run per player per daily seed.
create table if not exists survival_runs (
  event_id text not null,
  player_id text not null,
  days int not null,
  fish_eaten int not null,
  biggest numeric not null,
  log jsonb not null,
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
create index if not exists survival_board on survival_runs (event_id, days desc, fish_eaten desc);

-- Per-key request counters for rate limiting (one row per key per minute).
create table if not exists rate_hits (
  key text not null,
  bucket bigint not null,
  n int not null default 0,
  primary key (key, bucket)
);
create index if not exists rate_hits_bucket on rate_hits (bucket);

-- The WebRTC signaling relay (api/rtc.ts), moved off the in-memory Map so it works across instances.
create table if not exists rooms (
  room text not null,
  peer text not null,
  name text not null default '',
  last_seen timestamptz not null default now(),
  primary key (room, peer)
);
create table if not exists signals (
  id bigserial primary key,
  room text not null,
  "from" text not null,
  "to" text not null,
  kind text not null,
  payload jsonb,
  at timestamptz not null default now()
);
create index if not exists signals_inbox on signals (room, "to", id);
