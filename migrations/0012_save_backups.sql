-- Clear-my-data backups: when a player clears one profile's saves, the cloud copies are first kept
-- here — one row per profile, only ever the newest clear — and can be restored for 24 hours.
-- Postgres + PGLite compatible. Idempotent. Numbered after 0011_test_phase.sql.
create table if not exists save_backups (
  profile_id text primary key,
  data jsonb not null,        -- { v: 1, saves: [{ mode, rev, data }] } — every cloud save the profile had
  created_ms bigint not null  -- when the clear happened (epoch ms); the restore window is counted from here
);
