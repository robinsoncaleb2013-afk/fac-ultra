-- Update Three P6, server half: the fish-fight matchmaker (docs/architecture/06 §1.2).
-- Postgres + PGLite compatible. Idempotent: safe to run twice.

-- Anglers waiting to be paired, one row per angler. The status poll is the heartbeat,
-- so the handler prunes a row nobody refreshes (fightqueue.server.ts).
create table if not exists fight_queue (
  player_id text primary key,
  name text not null,
  fish jsonb not null,                 -- fightroom.ts's WireFish, always one of the ready-made FIGHT_FISH
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists fight_queue_order on fight_queue (joined_at, player_id);

-- A pair the server has made, held until both anglers have picked it up (or it goes stale).
-- The fight itself rides the peer room (rooms/signals); this row is only the rendezvous.
create table if not exists fight_matches (
  room text primary key,               -- fightroom.ts's roomNameFor(a, b)
  a_id text not null unique,
  b_id text not null unique,
  a_name text not null,
  b_name text not null,
  a_fish jsonb not null,
  b_fish jsonb not null,
  a_at bigint not null,                -- both anglers' queue join times (ms), so each device
  b_at bigint not null,                --   builds its local room in the same join order
  seed bigint not null,                -- fightroom.ts's matchSeedFor(a, b)
  a_seen boolean not null default false,
  b_seen boolean not null default false,
  created_at timestamptz not null default now()
);
