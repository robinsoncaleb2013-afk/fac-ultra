-- WP-8: friends, invites, presence, teams and the results that feed trophies (docs/architecture/06 §3).
-- Postgres + PGLite compatible. Lives at the top of migrations/ (neither applier descends into sub-folders).
-- Idempotent: safe to run twice. Numbered after 0007_tournaments.sql.

-- A player's public handle is `friend_code`; the player id itself is a secret that never leaves the server's
-- rows (anyone holding it could post catches as that player). WP-9 links an account by moving the id,
-- and the friends/invites/results rows below follow it because they are keyed by that same column.
alter table players add column if not exists friend_code text;
alter table players add column if not exists last_seen timestamptz;
alter table players add column if not exists at_event text;       -- the event this player is fishing right now
create unique index if not exists players_friend_code on players (friend_code);

-- Team events (06 §3.4): the preset team an angler picked when joining.
alter table entries add column if not exists team text;
create index if not exists entries_team on entries (event_id, team);

-- Friendship is stored both ways so "my friends" is one indexed lookup.
create table if not exists friends (
  player_id text not null,
  friend_id text not null,
  created_at timestamptz not null default now(),
  primary key (player_id, friend_id)
);
create index if not exists friends_friend on friends (friend_id);

-- "Come fish with me": a friend asks a friend to an event. Short-lived; gone when the event ends.
create table if not exists invites (
  id bigserial primary key,
  from_id text not null,
  to_id text not null,
  event_id text not null,
  created_at timestamptz not null default now(),
  unique (from_id, to_id, event_id)
);
create index if not exists invites_to on invites (to_id, created_at);

-- What happened to each angler when an event finished (written once, on first look after the end).
-- Trophies, titles and the Lodge's Tournament history are read from here.
create table if not exists results (
  event_id text not null,
  player_id text not null,
  rank int not null,
  entrants int not null,               -- anglers on the board, Regulars included
  humans int not null,
  score numeric not null default 0,
  best_weight numeric not null default 0,
  medal int not null default 0,        -- 0 none, 1 gold, 2 silver, 3 bronze
  team text,
  team_rank int,
  ended_at timestamptz not null,
  primary key (event_id, player_id)
);
create index if not exists results_player on results (player_id, ended_at desc);

create table if not exists event_final (
  event_id text primary key,
  finalized_at timestamptz not null default now()
);
