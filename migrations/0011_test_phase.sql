-- WP-13: test-phase auto-reset (docs/TEST-PHASE.md). A tiny key-value table. The row 'build_epoch' remembers
-- which build last wiped progress, so each new build wipes exactly once. Postgres + PGLite compatible. Idempotent.
create table if not exists app_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
