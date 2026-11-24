# Server and accounts

Everything that runs on the server: the database, the game's own
accounts and cloud saves, the tournament servers, and the live
rooms. Every server file has its own entry in
[inventory/server.md](inventory/server.md), and every route in
[inventory/api.md](inventory/api.md).

## The database

`src/lib/db.ts` is the only door: `getSql()` returns the same
tagged-template SQL function whether the database is a real
Postgres (`DATABASE_URL` set) or the embedded PGLite (kept on disk
where `FAC_DATA_DIR` points, its location rules in
`src/lib/db-config.ts`). On first use it runs the migrations that
have not applied yet; the two appliers (this one and the deploy
script `scripts/migrate.mjs`) share their bookkeeping in
`scripts/migration-plan.mjs`, keyed by file name so a migration
applies exactly once wherever it lives.

## The game's own accounts (`src/lib/accounts/`)

Built for the game in WP-9; these are the players' accounts, and
they are not the platform's sign-in below.

- **Sign-in is by email link or Google.** `accounts.server.ts`
  answers who am I, send me a link, use it, sign out, export my
  data and delete my account. `mail.server.ts` sends the link (the
  provider is a one-line choice — see
  [external-connections.md](external-connections.md));
  `google.server.ts` runs the standard Google OAuth flow, entered
  through the `google-start` and `google-callback` routes.
- **Sessions** are a random secret in the browser's httpOnly cookie
  and only its hash in the database (`session.server.ts`).
- **Family profiles**: up to four named profiles under one account,
  each with its own saves (`profiles.server.ts`).
- **Cloud saves** (`saves.server.ts`): the browser never decides
  what the server stores — every upload is checked against the
  rules in `src/game/cloud.ts`, and a clash between devices is
  settled by those rules, not by whichever copy arrived last.
- The browser's half is `src/lib/accounts/client.ts`; the shared
  request plumbing is `common.server.ts` and `http.server.ts`.

## Tournaments (`src/lib/tournaments/`)

The server half of the tournament world: the event schedule
written to the database on demand (`events.server.ts`), joining
and submitting casts (`entries.server.ts` — every cast is replayed
and scored again on the server from the shared rules in
`src/game/`), the leaderboards and the daily Survival board
(`board.server.ts`), friends, presence and invites
(`friends.server.ts`), and what an event leaves behind
(`awards.server.ts`). Tests get a throwaway in-memory database
from `testing.server.ts`, the real migrations applied.

## Live rooms

Two kinds, deliberately different:

- **Ranked play goes through the server** (above). **Co-op and
  fight rooms are browsers talking to each other**: the full-mesh
  WebRTC engine in `src/lib/multiplayer/p2p.ts`, glued to the game
  by `src/game/multiplayer.ts` and `src/game/eventroom.ts`. The
  server only relays the introductions — the signaling lives in
  database tables (`src/lib/tournaments/rtc.server.ts`), behind
  the `rtc` route, so it survives restarts and more than one
  server process.
- The fish-fight rooms (Update Three) run on the same mesh: the
  pure queue, match and chat machine is `src/game/fightroom.ts`,
  its live layer is `src/game/fightroom-live.ts`, and room chat is
  filtered by the kid-safe rules in `src/game/safe.ts`. Kids Mode
  is refused in the room code itself.

## The platform's sign-in and plumbing (not the game's)

`src/lib/auth/` is Better Auth wiring from the Grok sandbox
template (its schema is `migrations/auth/0001_auth.sql`), and
`src/lib/app-data/` is the sandbox platform's connector plumbing.
The design contract's verdict stands: leave both alone — the
game's accounts are the ones above.
