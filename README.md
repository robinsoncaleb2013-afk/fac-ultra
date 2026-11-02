> ## TEST PHASE: every new build resets all progress and saves
>
> While FAC Ultra is being tested, **each update (new build) wipes everyone's progress**: fish, records, cloud saves, tournament results and trophies. Testers always start fresh, and old test data can never break a new build. Accounts, family profiles, friends and device settings (picture quality, sound, Kid Mode, colour-blind colours, full screen) are kept.
>
> **To turn this off:** set `FAC_TEST_RESET=0` where the game's server starts (or set `TEST_PHASE_RESET` to `false` in `src/lib/test-phase.ts`). Do this, and finish the short "before real launch" checklist, before real players arrive.
>
> Details, what is wiped and kept, and the checklist: **[`docs/TEST-PHASE.md`](docs/TEST-PHASE.md)**.

# FAC Ultra

Painted fishing game. Fifteen waters, 375 species, a live fight on the water, gear, boss lairs, an aquarium that earns while you sleep, contracts and rebirth. Six ways to play: Expedition (the career, with five difficulty levels and three save slots), Story (fifteen guided chapters), Recreational (relaxed, everything unlocked, kept apart from your career), Survival (hand line, hunger and cold), Local Co-op, and server-checked Tournaments. Rare long-play events mutate fish, and lines wear out and are crafted. Optional sign-in with cloud saves and friends.

Stack: React 19, TypeScript, TanStack Start, Zustand, Tailwind v4, Vite. It builds for Vercel with Neon Postgres, and also runs as a plain Node server on your own PC (embedded database, no accounts needed to play); see [`docs/README.md`](docs/README.md).

## Run it

```bash
npm install --no-audit --no-fund   # install, not ci: the committed lockfile is stale
npm run dev                        # http://localhost:8080
```

Best played in a desktop browser (Chrome, Edge, Firefox) at 1280 px or wider; it also works on a phone. Progress saves in the browser (`localStorage`), one slot per mode; open the menu, then Settings, then Your saves, to make a save code and carry it elsewhere. While the test phase is on (the banner above) every new build starts everyone fresh.

## Check it

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # game tests, portable tooling tests and the docs check (sandbox-only tests skip outside Grok)
npm run build        # production build (Vercel shape)
```

Add a game test by creating a `*.test.ts` next to the code under `src/`; the runner finds it. CI runs these four, after `npm install`, on every pull request. The docs check (`scripts/docs-check.mjs`) fails the build if a document names a file, setting, save version, migration, mode or route that the code no longer has.

## Self-host it

Build a copy with the Nitro preset switched to `node-server`, then `FAC_DATA_DIR=/some/folder node .output/server/index.mjs`. The exact steps, and every environment variable (`DATABASE_URL`, `FAC_DATA_DIR`, `FAC_PUBLIC_URL`, `RESEND_API_KEY`, `FAC_EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FAC_TEST_RESET`, `FAC_TEST_RESET_EPOCH`), are in [`docs/README.md`](docs/README.md).

## Build on it

Start at **[`docs/README.md`](docs/README.md)**: a one-line description of every document, how to run, test, build and self-host, and the environment table. Design decisions and the build order live in **[`docs/architecture/`](docs/architecture/README.md)**, whose first page has the status of every work package. What was built differently from the plan is [`docs/CHANGES-FROM-PLAN.md`](docs/CHANGES-FROM-PLAN.md); what nobody has been able to check yet is [`docs/KNOWN-GAPS.md`](docs/KNOWN-GAPS.md). Implementing agents start at [`docs/architecture/08-work-packages.md`](docs/architecture/08-work-packages.md).

`docs/EXPANSION-DESIGN.md` is the historical design for the 2026-11-01 expansion; the architecture folder supersedes it where they differ.

Biome paintings live in `public/art/biomes` (WebP only); the full-size originals are in `art-src/`. See `public/art/README.md`.
