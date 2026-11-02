-- WP-9: optional accounts, family profiles and cloud saves (docs/architecture/07 §3-4).
-- Postgres + PGLite compatible. Idempotent. Numbered after 0008_social.sql.
-- These are the game's own account tables. They are separate from the platform's Better Auth schema
-- (migrations/auth/), which stays untouched.

-- One row per grown-up who signed in. Email is needed to send the sign-in link; it is deleted with the account.
create table if not exists accounts (
  id text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  last_login timestamptz
);
create unique index if not exists accounts_email on accounts (lower(email));

-- Sign-in links. Only a hash of the secret is stored; a link works once, for 15 minutes.
create table if not exists magic_links (
  token_hash text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists magic_links_email on magic_links (lower(email), created_at);

-- Logged-in browsers. The cookie holds the secret; the database holds only its hash.
create table if not exists sessions (
  token_hash text primary key,
  account_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen timestamptz not null default now()
);
create index if not exists sessions_account on sessions (account_id);

-- Family profiles: up to four per account (slot 0-3). `kid` profiles never have an email of their own.
-- `player_id` is the tournament/friends identity (players.id) this profile fishes as, on every device.
create table if not exists profiles (
  id text primary key,
  account_id text not null,
  slot int not null check (slot between 0 and 3),
  name text not null,
  kid boolean not null default false,
  player_id text,
  created_at timestamptz not null default now(),
  unique (account_id, slot)
);
create unique index if not exists profiles_player on profiles (player_id) where player_id is not null;

-- Cloud saves: one row per profile and mode, with a revision that only the server moves.
create table if not exists saves (
  profile_id text not null,
  mode text not null,
  rev int not null,
  data jsonb not null,
  device text,
  updated_at timestamptz not null default now(),
  primary key (profile_id, mode)
);

-- "Sign in with Google" in flight: the state we sent and the nonce we expect back. Single use, 10 minutes.
create table if not exists oauth_states (
  state_hash text primary key,
  nonce text not null,
  expires_at timestamptz not null
);

-- Counters for sign-in rate limits that last longer than a minute (per hour, per address and per email).
create table if not exists acct_hits (
  key text not null,
  bucket bigint not null,
  n int not null default 0,
  until bigint not null default 0,      -- epoch ms after which the row can be deleted
  primary key (key, bucket)
);
