# Inventory — server files

Every file under `src/lib/` (the database door, the game's own accounts, the tournament servers, the live-room engine, and the sandbox platform's plumbing). Files ending `.server.ts` never go to the browser.

- **accounts.server** (`src/lib/accounts/accounts.server.ts`): Answers the account route (WP-9): who am I, request a sign-in link, use it, sign out, export my data, delete my account.

- **client** (`src/lib/accounts/client.ts`): The browser's side of accounts and cloud saves (WP-9): talking to the account, profiles and save routes.

- **common.server** (`src/lib/accounts/common.server.ts`): Shared plumbing for the account API (WP-9): the request and response shape, secrets, cookies and rate limits.

- **google.server** (`src/lib/accounts/google.server.ts`): Sign in with Google (WP-9): the standard OAuth 2.0 authorization-code flow over plain fetch.

- **http.server** (`src/lib/accounts/http.server.ts`): Turns a route's Request into the account handlers' shape and their answer back into a Response (cookies and redirects included).

- **mail.server** (`src/lib/accounts/mail.server.ts`): Sending the sign-in email (WP-9): a sender is just a function, so the provider (Resend) is a one-line choice; without a key the link is printed in the server log.

- **profiles.server** (`src/lib/accounts/profiles.server.ts`): Family profiles (WP-9): up to four named profiles under one account, each with its own saves.

- **backups.server** (`src/lib/accounts/backups.server.ts`): "Clear my data": clearing one profile's cloud saves keeps them first as that profile's one backup — a newer clear replaces it — restorable for a day; restoring does not use it up, and only the profile's owner can clear, read or restore it.

- **saves.server** (`src/lib/accounts/saves.server.ts`): Cloud saves (WP-9): the browser never decides what the server stores — every upload is checked against the shared rules in src/game/cloud.ts.

- **session.server** (`src/lib/accounts/session.server.ts`): Sessions (WP-9): the browser holds a random secret in an httpOnly cookie; the database holds only its hash.

- **client.server** (`src/lib/app-data/client.server.ts`): Sandbox-platform plumbing: talks to the Grok connectors host for app data, with the gate's access token. Not the game's own server code.

- **errors** (`src/lib/app-data/errors.ts`): Sandbox-platform plumbing: classifies app-data connector call errors (login required, pending, failure).

- **index** (`src/lib/app-data/index.ts`): Sandbox-platform plumbing: the app-data folder's barrel file.

- **login** (`src/lib/app-data/login.ts`): Sandbox-platform plumbing: notices when an app-data call needs the visitor to sign in, and sends them to login.

- **readiness-schedule** (`src/lib/app-data/readiness-schedule.ts`): Sandbox-platform plumbing: the retry delays for probing whether a connector is ready.

- **readiness** (`src/lib/app-data/readiness.ts`): Sandbox-platform plumbing: the connector readiness snapshot and its getter.

- **server-only** (`src/lib/app-data/server-only.ts`): Sandbox-platform plumbing: a guard that fails loudly if server-only app-data code is imported on the client.

- **types** (`src/lib/app-data/types.ts`): Sandbox-platform plumbing: the connector token header names and the generated connector tool types.

- **use-connector-readiness** (`src/lib/app-data/use-connector-readiness.ts`): Sandbox-platform plumbing: a React hook that refetches when a connector reports ready.

- **client** (`src/lib/auth/client.ts`): The Better Auth browser client for the sandbox platform sign-in — not the game's own accounts.

- **email-password** (`src/lib/auth/email-password.ts`): Local email and password sign-in for the platform's Better Auth database. Off by default; the flag here is the only switch.

- **gate-identity.server** (`src/lib/auth/gate-identity.server.ts`): Verifies the Grok gate identity the sandbox platform sends with each request, against its published keys.

- **gate-session-marker** (`src/lib/auth/gate-session-marker.ts`): Client-readable marker for gate-materialized sessions, so the sign-out button knows a gate session will simply come back.

- **gate-session.server** (`src/lib/auth/gate-session.server.ts`): Mints zero-click sessions from a verified gate identity (the platform's Sign in with Grok sessions).

- **gates** (`src/lib/auth/gates.tsx`): The platform sign-in gate screens from the sandbox template: sign-in, sign-out and the redirects between them.

- **isolation.server** (`src/lib/auth/isolation.server.ts`): Rejects cross-site requests to the platform auth endpoints.

- **middleware** (`src/lib/auth/middleware.ts`): The platform auth middleware that runs ahead of the app in the sandbox template.

- **pglite-dialect** (`src/lib/auth/pglite-dialect.ts`): Kysely dialect for the platform's Better Auth over the app's embedded PGLite instance; resolves the client lazily so migrations finish first.

- **popup.server** (`src/lib/auth/popup.server.ts`): The live-preview sign-in popup document (server-only): OAuth in a top-level popup, because the sandbox preview runs in a partitioned iframe.

- **preview** (`src/lib/auth/preview.ts`): The shared live-preview OAuth client (server-only): one registered client for the sandbox's dynamic preview addresses.

- **provider** (`src/lib/auth/provider.tsx`): The platform AuthProvider the root route mounts around the app.

- **providers** (`src/lib/auth/providers.ts`): The upstream identity providers the platform sign-in offers; the source of truth for both the server wiring and the sign-in buttons.

- **server** (`src/lib/auth/server.ts`): Self-hosted Better Auth for this app (server-only), from the sandbox template: the platform's sign-in at /api/auth/* when a database is set. Not the game's accounts.

- **sign-in-gate** (`src/lib/auth/sign-in-gate.ts`): Pure rules for the sign-in gate: what the gate shows for each combination of inputs.

- **use-current-user** (`src/lib/auth/use-current-user.ts`): A React hook giving the signed-in platform user, with a dev user when the sandbox runs unauthenticated.

- **verify.server** (`src/lib/auth/verify.server.ts`): Server-side session checks for the platform auth: the session's user, or an error when there is none.

- **build-epoch.generated** (`src/lib/build-epoch.generated.ts`): GENERATED by scripts/build-epoch.mjs during the build: the build epoch the epoch route and the device's reset gate compare against. Never edit by hand.

- **cn** (`src/lib/cn.ts`): The cn() class-name joiner used across the UI.

- **db-config** (`src/lib/db-config.ts`): Where the embedded PGLite database lives: DATABASE_URL means a real Postgres instead; FAC_DATA_DIR persists PGLite to a folder. Kept apart from db.ts so it can be unit-tested.

- **db** (`src/lib/db.ts`): The one database door: getSql() — Postgres when DATABASE_URL is set, else PGLite — running the pending migrations on first use.

- **env.server** (`src/lib/env.server.ts`): The server's typed view of the environment variables the app reads, plus the workspace-preview check.

- **error-component** (`src/lib/error-component.tsx`): The router's default error screen, set in src/router.tsx.

- **index** (`src/lib/multiplayer/index.ts`): Barrel file for the multiplayer folder: the WebRTC mesh in p2p.ts.

- **p2p** (`src/lib/multiplayer/p2p.ts`): Full-mesh WebRTC rooms: one connection per remote peer, signaled through the rtc route, game data flowing browser to browser afterwards. Client-authoritative by construction.

- **preview-embedder-origin** (`src/lib/preview-embedder-origin.ts`): Works out whether the page is framed by an allowlisted Grok embedder, and which origin that is.

- **preview-host-bridge** (`src/lib/preview-host-bridge.ts`): Guest side of the Grok preview postMessage bridge; active only when framed by an allowlisted embedder, a no-op everywhere else.

- **preview-path-prefix** (`src/lib/preview-path-prefix.ts`): The preview path-prefix rewriting the router uses inside the sandbox preview.

- **test-phase** (`src/lib/test-phase.ts`): TEST PHASE: the one master switch for the old build wipe — OFF by default now, so updates keep player data and clearing is the player's own choice (backups.server.ts). Also holds the two 'what is kept' lists (docs/TEST-PHASE.md).

- **test-reset.server** (`src/lib/test-reset.server.ts`): TEST PHASE (server): when a new build starts, wipe progress once, server-side (docs/TEST-PHASE.md).

- **awards.server** (`src/lib/tournaments/awards.server.ts`): What an event leaves behind: the final standings written once, and the trophies and medals that follow the board.

- **board.server** (`src/lib/tournaments/board.server.ts`): Leaderboards and the daily Survival board: the standings every board screen reads.

- **common.server** (`src/lib/tournaments/common.server.ts`): Shared plumbing for the tournament API: the request and response shape, and the helpers every handler uses.

- **entries.server** (`src/lib/tournaments/entries.server.ts`): Joining an event and submitting casts: each cast is replayed and scored again on the server before it counts.

- **events.server** (`src/lib/tournaments/events.server.ts`): Events: the schedule written to the database on demand, the open list, and private events.

- **fightqueue.server** (`src/lib/tournaments/fightqueue.server.ts`): The fish-fight matchmaker: the one server-side queue every device agrees on — joins, standing polls and leaves, pairing the two longest-waiting anglers with fightroom.ts's own seed and room rules, and Kids Mode joins refused before they are written.

- **friends.server** (`src/lib/tournaments/friends.server.ts`): Friends, presence and invites for the tournament world.

- **http.server** (`src/lib/tournaments/http.server.ts`): The thin layer between a route's Request and the framework-free handlers: reads the body with a size cap and writes the answer.

- **rtc.server** (`src/lib/tournaments/rtc.server.ts`): The WebRTC signaling relay, kept in database tables instead of memory, so rooms survive restarts and more than one server process.

- **testing.server** (`src/lib/tournaments/testing.server.ts`): A throwaway in-memory database for tests: PGLite with the real migrations applied, behind the same shape as the live one.
