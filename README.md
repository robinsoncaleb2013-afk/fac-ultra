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

Biome paintings live in `public/art/biomes`.
