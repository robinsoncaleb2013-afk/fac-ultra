# FAC Ultra — Architecture & Build Specs

This folder is the **implementation contract** for FAC Ultra's next chapter: an immersive fishing game for fishing enthusiasts (and the kids who play beside them) with recreational, survival and multiplayer-tournament play.

It is written so that an implementing agent — any model, any tool — can pick up one work package, build it, verify it, and open a PR without having to redesign anything. Design decisions are made here. Implementers execute them.

## How to use these documents

| Read this | When |
|---|---|
| [`01-vision-and-pillars.md`](01-vision-and-pillars.md) | Before anything. Who the game is for and the five rules every feature must obey. |
| [`02-codebase-map.md`](02-codebase-map.md) | Before touching code. What each file does, how state flows, where to extend, what not to touch. |
| [`03-presentation-big-water.md`](03-presentation-big-water.md) | Building the desktop presentation layer (WP-1). |
| [`09-mobile.md`](09-mobile.md) | The phone/tablet presentation and graphics tiers — same site, chosen automatically (WP-1). |
| [`04-fishing-model.md`](04-fishing-model.md) | Building the enthusiast fishing simulation: spots, presentations, the fight (WP-2, WP-3). |
| [`05-game-modes.md`](05-game-modes.md) | Building Recreational, Survival, Kid Mode and the mode framework (WP-4, WP-5, WP-6). |
| [`06-multiplayer-tournaments.md`](06-multiplayer-tournaments.md) | Building server-scored tournaments and the lobby (WP-7, WP-8). |
| [`07-data-saves-cloud.md`](07-data-saves-cloud.md) | Save schema v4, migrations, accounts and cloud saves (WP-9). |
| [`08-work-packages.md`](08-work-packages.md) | **The build order.** Each package: scope, files, acceptance criteria, how to verify. Start here when asked "what should I build next?" |

The older `docs/EXPANSION-DESIGN.md` describes the game as shipped on 2026-11-01 (15 biomes, 375 fish, bosses, Aquarium, co-op, derby). It stays as history. Where the two disagree, **this folder wins**.

## Rules for implementing agents

These are not suggestions. A PR that breaks one of them is not done.

1. **One work package per PR, the whole package.** Don't split a package into slivers. Don't bundle two packages. The package's "Done when" list is the PR's definition of done.
2. **Run the gates before opening the PR**, in the repo root:
   ```bash
   npm install --no-audit --no-fund
   npm run typecheck        # must be clean
   npm run lint             # must be clean
   npm test                 # must be green (see WP-0 for how .grok tests are skipped)
   npm run build            # must succeed
   node scripts/browser-smoke.mjs   # if present: no console errors, visible content
   ```
   Then play the feature in a real browser (Playwright is installed; Chromium may live at `/opt/pw-browsers/`). Screenshots go in `screenshots/`. A PR description must say what you played and what you saw.
3. **One site, every device.** The same URL serves phones, tablets and PCs; `device.ts` picks the layout and graphics tier automatically (`09-mobile.md`). Every presentation change is verified at 390×844 (phone portrait), 844×390 (phone landscape) and 1440×900 (desktop), and the per-tier table in `09` §1.2 decides what each device draws.
4. **No new rendering engine and no heavy dependencies.** Canvas 2D, CSS and the existing libraries. `three`, Phaser, PixiJS and similar are **not** allowed. If a spec calls for an effect, it is achievable in Canvas 2D; see `03-presentation-big-water.md`.
5. **Never break saves.** Every change to the `Save` type goes through `sanitize()` with a version bump and a migration; old saves must load. `07-data-saves-cloud.md` has the procedure. Test it with the fixtures in `src/game/__fixtures__/` (created in WP-0).
6. **Don't touch the platform plumbing** unless a package says to: `public/__grok/`, `server/`, `scripts/grok-pwa-*`, `scripts/with-app-env.mjs`, `src/lib/auth/*`, `src/lib/app-data/*`, `src/lib/preview-*`. They came from the original sandbox and keep the Vercel build working.
7. **Game rules live in `src/game/`, never in components.** A component reads state and calls an action. If you find yourself computing a payout or a bite chance in a `.tsx` file, move it.
8. **Deterministic where it matters.** Anything a tournament scores must be reproducible from a seed (`04-fishing-model.md` §Seeded RNG). Use `rng()` from `src/game/rng.ts`, never `Math.random()`, inside the fishing model.
9. **Plain-English player text.** Kids read this. Short sentences, no jargon in the UI. Internal names (`sim.tz`, "zone") never appear on screen.
10. **Record what you couldn't verify.** If a check needs a paid service, a second real device, or a human (e.g. "two browsers on two home networks connect through NAT"), write it under **Unverified** in the PR description. It is not a blocker.

## Repo facts you need

- Stack: React 19, TypeScript, TanStack Start/Router, Zustand, Tailwind v4, Vite 8. Node 22. Deployed on Vercel. Database: Neon Postgres via `src/lib/db.ts` (falls back to embedded PGLite locally when `DATABASE_URL` is unset).
- Dev server: `npm run dev` → http://localhost:8080. Production preview: `npm run build && npm run preview`.
- Tests: Node's built-in test runner (`node --test`). Game tests live beside the code as `*.test.ts` and run with `--experimental-strip-types`. Add new tests to the `test` script in `package.json` (WP-0 moves this to a glob).
- All game state is one Zustand store (`useGame` in `src/game/engine.ts`) plus a mutable per-frame `sim` object for things that change 60× a second. Persistence is `localStorage`, one key per mode (`fac-ultra`, `fac-ultra-sandbox`, `fac-ultra-coop`).

## Glossary

| Term | Meaning |
|---|---|
| **Water / biome** | One of the 15 fishing locations (Pond … Astral Sea). `BIOMES[i]`. |
| **Species** | One of 25 fish per water. Slot 24 is that water's boss. Key `"b-i"`. |
| **Stage** | Progress tier inside a water (Shallows → Open Water → Deep Run → Boss Lair), from dex count. |
| **Spot** | New in WP-2: a named cast target on the painting (lily pads, the drop-off, under the dock) with its own species weights. |
| **Presentation** | New in WP-2: the combination of bait/lure type, depth and retrieve the player chose. Species prefer certain presentations. |
| **Dex** | The species collection. `dex["b-i"] = {c: count, w: best weight, m: best mutation}`. |
| **Mode** | A save slot with its own rules: Expedition (career), Recreational, Survival, Co-op, Tournament. |
| **Helping Hand** | Kid-mode difficulty assist (WP-1). |
| **Form / tier** | `form` = phone / tablet / desktop (how the page is laid out); `gfx` tier = full / lite / mobile (what the water draws). Both chosen by `device.ts` at load. |
| **Event / Tournament** | A server-scheduled competition with a seed, rules and a server-verified leaderboard (WP-7). |
