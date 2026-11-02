-- WP-10: friend requests, blocking, player-name handles and email invites (docs/architecture/06 §3.3).
-- Postgres + PGLite compatible. Idempotent. Numbered after 0009_accounts.sql.
-- Adding a friend by code stays instant (people sitting together). Adding by name or by email is a request the other
-- player accepts. Nothing here stores an email address: an invite keeps only a hash, to cap how often one address is mailed.

-- The short number after a name ("RiverRat#4821"). Unique per (lower(name), tag); handed out by the server.
alter table players add column if not exists tag int;
create index if not exists players_name_tag on players (lower(name), tag);

create table if not exists friend_requests (
  from_id text not null,
  to_id text not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
create index if not exists friend_requests_to on friend_requests (to_id, created_at);

-- Block: the blocked player disappears from lists and search, cannot send requests or invites, and their emotes are hidden.
create table if not exists blocks (
  player_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (player_id, blocked_id)
);
create index if not exists blocks_blocked on blocks (blocked_id);

-- An invite link sent by email. Only hashes are kept: the link's secret, and the address (for the per-address daily cap).
create table if not exists friend_invites (
  token_hash text primary key,
  from_id text not null,
  email_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists friend_invites_from on friend_invites (from_id, created_at);
create index if not exists friend_invites_email on friend_invites (email_hash, created_at);
