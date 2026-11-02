> ## TEST PHASE: every new build resets all progress and saves
>
> While FAC Ultra is being tested, **each update (new build) wipes everyone's progress**: fish, records, cloud saves, tournament results and trophies. Testers always start fresh, and old test data can never break a new build. Accounts, family profiles, friends and device settings (picture quality, sound, Kid Mode, colour-blind colours, full screen) are kept.
>
> **To turn this off:** set `FAC_TEST_RESET=0` where the game's server starts (or set `TEST_PHASE_RESET` to `false` in `src/lib/test-phase.ts`). Do this, and finish the short "before real launch" checklist, before real players arrive.
>
> Details, what is wiped and kept, and the checklist: **[`docs/TEST-PHASE.md`](docs/TEST-PHASE.md)**.

# FAC Ultra

Painted fishing game. Fifteen waters, 375 species, a live fight on the water, gear, boss lairs, an aquarium that earns while you sleep, contracts and rebirth — plus recreational, co-op, derby and boss-rush modes, with survival fishing and server-scored tournaments on the way.

Stack: React 19, TypeScript, TanStack Start, Zustand, Tailwind v4, Vite. Hosted on Vercel; Neon Postgres for the online pieces.

## Run it

```bash
npm install
npm run dev          # http://localhost:8080
```

Best played in a desktop browser (Chrome, Edge, Firefox) at 1280 px or wider; it also works on a phone. Progress saves in the browser (`localStorage`), one slot per mode; export a save code from Lodge → Settings to carry it elsewhere.

## Check it

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # game tests + portable tooling tests (sandbox-only tests skip outside Grok)
npm run build        # production build (Vercel shape)
```

Add a game test by creating a `*.test.ts` next to the code under `src/`; the runner finds it. CI runs all four on every pull request.

## Build on it

Design decisions and the build order live in **[`docs/architecture/`](docs/architecture/README.md)** — vision, codebase map, the fishing model, game modes, multiplayer tournaments, saves, and numbered work packages with acceptance criteria. Implementing agents start at [`docs/architecture/08-work-packages.md`](docs/architecture/08-work-packages.md).

`docs/EXPANSION-DESIGN.md` is the historical design for the 2026-11-01 expansion; the architecture folder supersedes it where they differ.

Biome paintings live in `public/art/biomes` (WebP); the full-size originals are in `art-src/`. See `public/art/README.md`.
