# FAC Ultra — Architecture & Build Specs

This folder is the **implementation contract** for FAC Ultra's next chapter: an immersive fishing game for fishing enthusiasts (and the kids who play beside them) with recreational, survival and multiplayer-tournament play.

It is written so that an implementing agent — any model, any tool — can pick up one work package, build it, verify it, and open a PR without having to redesign anything. Design decisions are made here. Implementers execute them.

## Status: what is built (as of WP-16, main `0075b66`)

Every package below is merged into `main`. Packages 1 to 9 were built as a stack of pull requests that were closed one by one; their work reached `main` together in **#15** (merged 2026-11-02), so their own PR numbers show "closed", not "merged". Real-device, real-service and real-player checks are collected in [`../KNOWN-GAPS.md`](../KNOWN-GAPS.md); nothing below is blocked on them.

| WP | What | PR | State | Known gaps (details in KNOWN-GAPS) |
|---|---|---|---|---|
| 0 | Honest gates outside the Grok sandbox, CI, fixtures | #1 (merged) | Built | `package-lock.json` is stale, so CI uses `npm install` |
| (spec) | Mobile spec: device and graphics tiers | #2 (merged) | Built in WP-1, amended in WP-10 | |
| 1 | Big Water presentation and mobile layouts | #3, in #15 | Built; desktop rail and drawer later replaced by the Hub (WP-10) | Real phone feel; manifest says `standalone` |
| 2 | Spots, rigs, habits, seeded RNG | #4, in #15 | Built (75 spots) | Balance not tuned |
| 3 | Fight v2, keep or release, records | #5, in #15 | Built | Balance not tuned |
| 4 | Mode table, Recreational, Kid Mode | #6, in #15 | Built | |
| 5 | Survival | #8, in #15 | Built (own save, 8 waters, rescue on day 15) | Real-player difficulty |
| 6 | Fun layer: rivals, pet, stickers, Fish of the Day, ambience | #11, in #15 | Built | Audio never listened to |
| 7 | Server-checked tournaments | #9, in #15 | Built; rules versioned from WP-14 | Neon, load, two real networks |
| 8 | Lobby, boards, friends, teams, trophies | #12, in #15 | Built | TURN fallback, multi-device |
| 9 | Accounts, cloud saves, asset cleanup | #13, in #15 | Built (own accounts, not the platform's) | Real email, Google, Neon |
| 10 | Hub menus, five graphics levels, full screen | #15 (merged) | Built; menu structure replaced by WP-12 | Gamepad hardware, iPhone |
| 11 | Recreational fully separate | #18 (merged) | Built | Early-build data merged into old career saves stays |
| 13 | Test-phase reset on every build | #19 (merged) | Built; **switch is ON** | Checklist before launch in `TEST-PHASE.md` |
| 12 | Two-level menu (main menu outside the game, a menu per mode) | #20 (merged) | Built | Gamepad hardware, phone feel |
| 15 | Rare long-play events and mutations | #21 (merged) | Built (save v10) | Live landing and banner; balance |
| 14 | Line health, crafting, gear rules, rules version 2 | #22 (merged) | Built (save v11) | Pacing never played end to end |
| 16 | Difficulty, Story, Legend dangers, Kids book, slots, achievements, trophy room | #23 (merged) | Built (save v12) | Hazard feel, Neon slot sync |
| 17 | This documentation audit, `docs/README.md`, `KNOWN-GAPS.md`, the docs check | this PR | Docs only | |

WP-12, 13, 14 and 15 are numbered by the order Caleb's feedback arrived, not by merge order. Packages 14, 15 and 16 took save versions 11, 10 and 12 in that merge order. Save versions, fixtures, migrations and routes are pinned to the code by `scripts/docs-check.mjs` (see [`../README.md`](../README.md)).

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
| [`07-data-saves-cloud.md`](07-data-saves-cloud.md) | Save versions and the migration procedure, slots, accounts, cloud saves, the test-phase reset (WP-9, WP-13). |
| [`09-mobile.md`](09-mobile.md) §1.0, §2.4, §6.1 | Graphics levels (Ultra to Potato), the pause menu (Hub) and full screen, as built in WP-10. |
| [`10-gear-progression-and-line.md`](10-gear-progression-and-line.md) | Line health, packs, crafting, and the gear progression gates (WP-14). |
| [`11-events-and-mutations.md`](11-events-and-mutations.md) | Building or tuning the rare long-play events, their mutations and the Events list (WP-15). |
| [`12-difficulty-slots-achievements.md`](12-difficulty-slots-achievements.md) | Building or tuning difficulty levels, Story, Legend hazards, the Kids book, save slots, achievements and the trophy room (WP-16). |
| [`08-work-packages.md`](08-work-packages.md) | **The build order.** Each package: scope, files, acceptance criteria, how to verify. Start here when asked "what should I build next?" |

The older `docs/EXPANSION-DESIGN.md` describes the game as shipped on 2026-11-01 (15 biomes, 375 fish, bosses, Aquarium, co-op, derby). It stays as history. Where the two disagree, **this folder wins**. Where this folder and the code disagree, **the code wins** and the document is a bug. The map of every document is [`../README.md`](../README.md); what was built differently from the plan is [`../CHANGES-FROM-PLAN.md`](../CHANGES-FROM-PLAN.md).

**Reading the numbered documents:** each begins with an "As built" line saying what became of its package. The spec text keeps its original voice; sections marked *As built*, *Amended* or *Superseded* beat the spec text around them.

## Rules for implementing agents

These are not suggestions. A PR that breaks one of them is not done.

1. **One work package per PR, the whole package.** Don't split a package into slivers. Don't bundle two packages. The package's "Done when" list is the PR's definition of done.
2. **Run the gates before opening the PR**, in the repo root:
   ```bash
   npm install --no-audit --no-fund   # install, not ci: the committed lockfile is stale
   npm run typecheck        # must be clean
   npm run lint             # must be clean (warnings are normal, errors are not)
   npm test                 # must be green; includes the docs check (scripts/docs-check.mjs); .grok-only tests skip outside the sandbox
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
10. **Record what you couldn't verify.** If a check needs a paid service, a second real device, or a human (e.g. "two browsers on two home networks connect through NAT"), write it under **Unverified** in the PR description. It is not a blocker. Add it to [`../KNOWN-GAPS.md`](../KNOWN-GAPS.md) too.

## Repo facts you need

- Stack: React 19, TypeScript, TanStack Start/Router, Zustand, Tailwind v4, Vite 8. Node 22. Builds for Vercel by default and also runs as a plain Node server on a home PC (`../README.md`, self-hosting). Database: `src/lib/db.ts` uses Postgres/Neon when `DATABASE_URL` is set, otherwise embedded PGLite, kept on disk when `FAC_DATA_DIR` is set (the full list of settings is in `../README.md`).
- Dev server: `npm run dev` → http://localhost:8080. Production preview: `npm run build && npm run preview`.
- Tests: Node's built-in test runner (`node --test`). Game tests live beside the code as `*.test.ts` and run with `--experimental-strip-types`. `scripts/run-tests.mjs` finds every `*.test.ts` under `src/` and every portable `scripts/*.test.mjs`; there is nothing to register.
- All game state is one Zustand store (`useGame` in `src/game/engine.ts`) plus a mutable per-frame `sim` object for things that change 60× a second. Persistence is `localStorage`, one key per mode (`fac-ultra`, `fac-ultra-sandbox` for Recreational, `fac-ultra-survival`, `fac-ultra-coop`, `fac-ultra-tourney`, `fac-ultra-story`), with `-s1` and `-s2` extra slots for Expedition and Story, plus the shared device-settings key `fac-ultra-device` (`07` section 2).

## Glossary

| Term | Meaning |
|---|---|
| **Water / biome** | One of the 15 fishing locations (Pond … Astral Sea). `BIOMES[i]`. |
| **Species** | One of 25 fish per water. Slot 24 is that water's boss. Key `"b-i"`. |
| **Stage** | Progress tier inside a water (Shallows → Open Water → Deep Run → Boss Lair), from dex count. |
| **Spot** | New in WP-2: a named cast target on the painting (lily pads, the drop-off, under the dock) with its own species weights. |
| **Presentation** | New in WP-2: the combination of bait/lure type, depth and retrieve the player chose. Species prefer certain presentations. |
| **Dex** | The species collection (the fish book). `dex["b-i"] = {c: count, w: best weight, m: best mutation}`. Each mode keeps its own; Kid Mode and Super Easy catches go to a separate Kids book (`sideDex`, `12`). |
| **Mode** | A save slot with its own rules (the `MODES` table in `src/game/modes.ts`): Expedition (career), Recreational, Survival, Co-op, Tournament and Story. Nothing is shared between modes. |
| **Helping Hand** | Kid-mode difficulty assist (WP-1). |
| **Hub** | The menu system (WP-10, made two-level in WP-12): a main menu outside any game (Play, Collections, Friends, Account, Settings) and an in-game menu per mode (`menuTabs`), with a list and detail panel, quick wheel and satchel. `src/components/game/hub/`. |
| **Graphics level** | What players pick: Auto, Ultra, High, Medium, Low, Potato. Maps onto the three tiers (`09` §1.0). Not the same thing as the device form. |
| **Form / tier** | `form` = phone / tablet / desktop (how the page is laid out); `gfx` tier = full / lite / mobile (what the water draws). Both chosen by `device.ts` at load. |
| **Tournament event** | A server-scheduled competition with a seed, rules (and a `rulesVersion`) and a server-verified leaderboard (WP-7). Not the same as a long-play **event** (WP-15, `11`), which is a rare in-game happening that mutates fish. |
