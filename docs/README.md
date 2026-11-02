# FAC Ultra docs

Start here. This page says what each document is for, how to run, test, build and self-host the game, and keeps the one authoritative list of settings (environment variables). Everything on this page was run for real on `main` after WP-16 (Node 22).

The architecture documents are the design contract; where a document and the code disagree, the code is right and the document is a bug (tell someone, or fix it). A small test (`scripts/docs-check.mjs`, part of `npm test`) fails when a file path, setting, save version, migration, mode or route named in these docs stops matching the code.

## What is where

| Document | What it is |
|---|---|
| [`../README.md`](../README.md) | The front door: what the game is, the test-phase banner, the short run and check commands. |
| [`architecture/README.md`](architecture/README.md) | The design contract's index, the rules for agents, **the status table (every work package, its PR, its state, its known gaps)** and the glossary. |
| [`architecture/01-vision-and-pillars.md`](architecture/01-vision-and-pillars.md) | Who the game is for and the five pillars every feature must obey. |
| [`architecture/02-codebase-map.md`](architecture/02-codebase-map.md) | Where things live, how state flows, where to extend; ends with an "as built" log per package. |
| [`architecture/03-presentation-big-water.md`](architecture/03-presentation-big-water.md) | The water, living effects, the fight ring, the catch card, Helping Hand, art loading. |
| [`architecture/04-fishing-model.md`](architecture/04-fishing-model.md) | Seeded random numbers, spots, rigs, habits, the match score, the tension fight, keep or release, records. |
| [`architecture/05-game-modes.md`](architecture/05-game-modes.md) | The mode table, Recreational (separate), Kid Mode, Survival, the fun layer, the two-level menu. |
| [`architecture/06-multiplayer-tournaments.md`](architecture/06-multiplayer-tournaments.md) | Server-checked tournaments, the schedule, the lobby, friends and trophies. |
| [`architecture/07-data-saves-cloud.md`](architecture/07-data-saves-cloud.md) | Save versions and the migration procedure, slots, accounts, cloud saves, the test-phase reset. |
| [`architecture/08-work-packages.md`](architecture/08-work-packages.md) | The build order and the PR template. |
| [`architecture/09-mobile.md`](architecture/09-mobile.md) | Phones and tablets, the five graphics levels, the menus (Hub), touch, full screen. |
| [`architecture/10-gear-progression-and-line.md`](architecture/10-gear-progression-and-line.md) | Line health and crafting, gear gates, tournament rules versions. |
| [`architecture/11-events-and-mutations.md`](architecture/11-events-and-mutations.md) | The rare long-play events and the fish mutations. |
| [`architecture/12-difficulty-slots-achievements.md`](architecture/12-difficulty-slots-achievements.md) | Five difficulty levels, Legend dangers, Story, the Kids book, save slots, achievements, trophy room. |
| [`CHANGES-FROM-PLAN.md`](CHANGES-FROM-PLAN.md) | For Caleb, in plain English: what was built and where it differs from the plan. |
| [`TEST-PHASE.md`](TEST-PHASE.md) | The test-phase reset (every build wipes progress), the one switch, the checklist before real launch. |
| [`KNOWN-GAPS.md`](KNOWN-GAPS.md) | Everything not verified, open balance questions, and things left for later. |
| [`HOSTING-PLAN.md`](HOSTING-PLAN.md) | The self-hosting plan and runbook for the family hub PC. Owned by the hosting side; this folder does not edit it (see `KNOWN-GAPS.md` for where it has fallen behind the code). |
| [`EXPANSION-DESIGN.md`](EXPANSION-DESIGN.md) | History: the 2026-11-01 expansion design (and its PDF). The architecture folder wins where they differ. |
| [`project-page.md`](project-page.md) | The website record for the project (kept honest: only what the build does). |
| [`website/`](website/README.md) | How Caleb's website pages are kept current (agent playbook, templates). Not about the game's code. |
| [`../public/art/README.md`](../public/art/README.md) | The biome paintings: WebP sizes, where the originals are, how to rebuild. |
| [`../AGENTS.md`](../AGENTS.md) | The Grok sandbox's own contract. Only meaningful inside that sandbox. |

## Run it, test it, build it

Needs Node 22 and npm. All of these were run on `main`.

```bash
npm install --no-audit --no-fund   # the committed package-lock.json is stale, so use install, not ci
npm run dev                        # http://localhost:8080 (hot reload; the database is in memory)
npm run typecheck                  # TypeScript, no output files
npm run lint                       # ESLint (a few warnings are normal; errors fail)
npm test                           # game tests + portable tooling tests + the docs check (about 850 tests)
npm run build                      # production build, Vercel shape, in about 6 seconds
```

CI (`.github/workflows/ci.yml`) runs exactly `npm install`, `typecheck`, `lint`, `test` and `build` on every pull request and every push to `main`, with `DATABASE_URL` empty. Nothing else is a gate.

Things that are not gates:

- `npm run check:auth` checks the Grok sandbox's sign-in wiring. Outside that sandbox it cannot read the dev server's answer and exits **2** ("indeterminate"). That is expected, not a failure.
- `node scripts/browser-smoke.mjs` (open the built game in a headless browser, fail on console errors) and `node scripts/check-touch-targets.mjs` (every button is at least 44 px) need Playwright's Chromium and a running build. They are run by hand before a UI change merges.
- Five tooling tests only run inside the Grok sandbox (`.grok/` exists); `npm test` says how many it skipped.

A new game test is a `*.test.ts` file next to the code under `src/`; a new tooling test is `scripts/<name>.test.mjs`. The runner (`scripts/run-tests.mjs`) finds both, nothing to register.

## Self-host it (your own PC, no Vercel, no Neon)

The repo builds for Vercel by default (`vite.config.ts` says `preset: "vercel"`). To run it as a plain Node server, build a **copy** with the preset switched. This is what the hosting plan does inside its image build, and what was run for this page:

```bash
cp -r fac-ultra fac-ultra-node && cd fac-ultra-node           # a copy, so the repo keeps its Vercel setting
sed -i 's/preset: "vercel"/preset: "node-server"/' vite.config.ts
npm install --no-audit --no-fund
npm run build                                                  # also copies PGLite's wasm next to the server bundle
FAC_DATA_DIR=/var/lib/fac-ultra PORT=3000 HOST=0.0.0.0 \
  node .output/server/index.mjs                                # "Listening on: http://0.0.0.0:3000"
```

- With **no** `DATABASE_URL` and **no** `FAC_DATA_DIR` the database is embedded PGLite **in memory**: accounts, cloud saves, tournaments and friends vanish when the server restarts. Set `FAC_DATA_DIR` to a folder (the database is kept there on disk) or `DATABASE_URL` to a real Postgres.
- The first request after a start creates the tables (it applies every file in `migrations/` once). With `DATABASE_URL` set, `npm run build` also applies them (`scripts/migrate.mjs`).
- **Test phase:** while `TEST_PHASE_RESET` is on, every new build wipes cloud saves, tournaments and trophies on its first start (accounts, profiles and friends stay). A server log line `[test-phase] New build ...` says so. See [`TEST-PHASE.md`](TEST-PHASE.md).
- Sign-in links are printed in the server console until `RESEND_API_KEY` is set. Put the public address in `FAC_PUBLIC_URL` so those links point at the right place.
- Quick check that it is alive: `curl http://127.0.0.1:3000/api/epoch` answers `{"epoch":"...","reset":true}`.

## Environment variables

The one authoritative list. Set them in the environment of the server process (Vercel's project settings, a Docker `environment:` list, or the shell). All are optional. The docs check keeps this table and the code in step.

| Variable | Read by | What it does | Default |
|---|---|---|---|
| `DATABASE_URL` | `src/lib/db.ts`, `scripts/migrate.mjs` | A Postgres connection string (Neon or your own). Beats `FAC_DATA_DIR`. `npm run build` applies the migrations to it. | none: embedded PGLite |
| `FAC_DATA_DIR` | `src/lib/db-config.ts` | A folder where the embedded PGLite database is kept on disk (self-hosting). Ignored when `DATABASE_URL` is set. | none: in memory, wiped on restart |
| `FAC_PUBLIC_URL` | `src/lib/accounts/*`, `src/lib/tournaments/friends.server.ts` | The game's public address, such as `https://fac-ultra.example`. Used inside sign-in links and friend-invite links. Strongly recommended behind a proxy or tunnel. | the address the browser used |
| `RESEND_API_KEY` | `src/lib/accounts/mail.server.ts` | An API key from resend.com. Turns on real sign-in and invite emails. | none: the link is written to the server console |
| `FAC_EMAIL_FROM` | `src/lib/accounts/mail.server.ts` | The From line, such as `FAC Ultra <login@yourdomain>`. Must be an address Resend has verified. | `FAC Ultra <onboarding@resend.dev>` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `src/lib/accounts/google.server.ts` | Both set turns on "Sign in with Google". Register `<FAC_PUBLIC_URL>/api/google-callback` as the redirect address. | none: the Google button is hidden |
| `FAC_TEST_RESET` | `src/lib/test-phase.ts`, `scripts/build-epoch.mjs` | `0`/`off` turns the test-phase wipe off, `1`/`on` turns it on. Beats the `TEST_PHASE_RESET` constant. Read on the server at run time, and also stamped at build time. | the constant (on) |
| `FAC_TEST_RESET_EPOCH` | `src/lib/test-phase.ts`, `scripts/build-epoch.mjs` | Forces the build label. At build time it names the stamped build; on a dev server it changes the server only. For testing the reset. | commit + build time (`dev` on dev servers) |
| `FAC_COMMIT` | `scripts/build-epoch.mjs` | A commit label for the build epoch, used only when `VERCEL_GIT_COMMIT_SHA` and `GITHUB_SHA` are not set (a plain `docker build` has neither). | none: the epoch is just the build time |
| `VITE_STUN_URLS` | `src/lib/multiplayer/p2p.ts` | Comma-separated STUN servers for the peer-to-peer rooms. Read at build time. | Google's public STUN |
| `VITE_AUTH_ENABLED` | `src/lib/auth/*`, `scripts/with-app-env.mjs` | The Grok sandbox's own sign-in switch. The game's accounts do not use it. Leave alone. | set by the sandbox |

Set by the server runtime, not by game code: `PORT` and `HOST` tell the self-hosted node-server bundle where to listen (Nitro's defaults are port 3000, all addresses).

Developer tooling only (not for running the game): `PREVIEW_READY_TIMEOUT_MS`, `PREVIEW_THUMBNAIL_TIMEOUT_MS` (`scripts/preview.mjs`, `scripts/preview-thumbnail.mjs`), `BROWSER_SMOKE_TIMEOUT_MS`, `BROWSER_ALLOW_EXTERNAL_HOST` (`scripts/browser-*.mjs`), `CHROME_PATH` (`scripts/check-touch-targets.mjs`). The `GROK_*` and `BETTER_AUTH_*` variables belong to the Grok platform plumbing (`src/lib/auth/*`, `src/lib/app-data/*`) and are not part of the game.

## Facts the docs check keeps true

These markers are compared with the code by `npm test`. If you change the thing, change the number here and in the doc that explains it.

<!-- docs-check:save-version 12 -->
<!-- docs-check:rules-version 2 -->
<!-- docs-check:migrations 0001 0007 0008 0009 0010 0011 -->
<!-- docs-check:fixtures 3 4 5 6 7 8 9 10 11 12 -->
<!-- docs-check:modes expedition recreational survival coop tournament story -->
<!-- docs-check:routes account board catch entry epoch events friends google-callback google-start profiles rtc save survival-board trophies -->

- Career save version **12** (`SAVE_VERSION` in `src/game/engine.ts`); detail in [`architecture/07-data-saves-cloud.md`](architecture/07-data-saves-cloud.md).
- Tournament rules version **2** (`RULES_VERSION` in `src/game/line-wear.ts`); detail in [`architecture/10-gear-progression-and-line.md`](architecture/10-gear-progression-and-line.md).
- Server migrations `0007` to `0011` in `migrations/`, plus `0001` (the platform's sign-in tables, in `migrations/auth/`, applied only when that sign-in is on). `0002` to `0006` do not exist: the game's numbers start high to stay clear of the platform's.
- Save fixtures `save-v3.json` to `save-v12.json` (there is no v1 or v2 file) plus `survival-v1.json`.
- Six modes: expedition, recreational, survival, coop, tournament, story.
- Fourteen API routes in `src/routes/api/`.
