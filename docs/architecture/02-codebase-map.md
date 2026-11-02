# 02 · Codebase Map

What exists, how it fits together, and where new work plugs in. Read this before editing anything.

> **As built (through WP-16).** The directory map below is the current one. The sections "State architecture", "The catch loop", "Rendering", "Multiplayer" and "Data layer" describe the original (pre-WP-1) game; their *ideas* still hold (one Zustand store plus a mutable `sim`, `frame(dt)` ticks, `getSql()`), but the fight is now the tension fight of `04` section 5, the rendering stack is the one in `03`/`09`, and the screens are the Hub menus (the "As built" logs at the end of this file). Counts such as file lengths are deliberately not repeated here; `wc -l` is the truth.

## Directory map

```
src/
  routes/
    __root.tsx          Document shell (fonts, meta, AuthProvider). Don't add og: tags here.
    index.tsx           "/" -> <Game/> from components/game/shell.tsx
    api/                One file per route (14): account, board, catch, entry, epoch, events, friends,
                        google-callback, google-start, profiles, rtc, save, survival-board, trophies.
  components/
    game/
      shell.tsx         Screen router (title / main menu / game) and the overlays. Small: layouts live in layout/.
      stage.tsx         The canvas. requestAnimationFrame loop -> engine.frame(dt) -> paint(). All water/fish/particle drawing.
      layout/           DesktopLayout, MobileLayout, CastDock, RigControl, DragButtons, Celebration, use-form.
      panels/           The older panels (Cast, Bag, Gear, Lure, Waters, Dex, Lodge, Camp, Records), now shown inside the Hub.
      hub/              The menus (WP-10, WP-12): TitleScreen, Hub, the tabs, CornerHud, Wheel, Satchel, HubKeys, settings-sections.
      account.tsx, lobby.tsx, board.tsx, tournament.tsx, trophies.tsx, trophy-room.tsx, slots.tsx, difficulty-picker.tsx,
      story-ui.tsx, achievements-ui.tsx, events.tsx, hazard-alerts.tsx, survival.tsx, trips.tsx, fun.tsx, kid.tsx ...
                        One file per feature screen. Rules are never computed here.
      portrait.tsx      <FishPortrait/>: a small canvas that draws one fish swimming in place.
    ui/button.tsx       The one shared UI primitive. (Radix is installed but mostly unused in the game.)
  game/                 THE RULES. Pure TypeScript, no React, tested beside the code (*.test.ts).
    content.ts          THE DATA. Biomes, species, rarity bands, gear ladders, lures, baits, weather, mutations, formulas (rollFish).
    engine.ts           State + actions: Save type, sanitize/migrate (SAVE_VERSION), the Zustand store, the per-frame `sim`.
    modes.ts            The mode rules table (MODES, menuTabs, MODE_LIST, mode-select cards). Nothing is shared between modes.
    rng.ts, spots.ts, presentation.ts, habits.ts, match.ts, fight.ts   Seeded random numbers and the fishing model (04).
    replay.ts, schedule.ts, scoring.ts, weather.ts, tourney.ts         The tournament rules the server also runs (06).
    line-wear.ts, lines.ts, gear-rules.ts                              Line health, crafting, gear gates (10).
    events.ts, event-data.ts, event-hooks.ts                           Long-play events and mutations (11).
    difficulty.ts, hazards.ts, story.ts, slots.ts, achievements.ts, pbroom.ts   WP-16 (12).
    survival.ts, trips.ts, kid.ts, rivals.ts, pet.ts, stickers.ts, fotd.ts, fun.ts   Mode and fun-layer rules (05).
    cloud.ts, social.ts, safe.ts, fill.ts, eventroom.ts, multiplayer.ts   Cloud-sync decisions, friends, rooms.
    hubnav.ts, hubstate.ts, leave.ts, peek.ts, spatial.ts, hubcopy.ts  Menu navigation (09 section 2.5).
    device.ts, graphics.ts (with the fps governor), probe.ts, fullscreen.ts, water.ts   Device, graphics levels, full screen.
    epoch-gate.ts       Browser half of the test-phase reset (docs/TEST-PHASE.md).
    fish-draw.ts, art.ts, audio.ts, ambience.ts   Procedural fish, painting loader (WebP only), WebAudio synth, ambient loops.
    __fixtures__/       save-v3.json ... save-v12.json, survival-v1.json: real saves that must always load.
  lib/
    db.ts, db-config.ts getSql(): Postgres when DATABASE_URL is set, else PGLite (on disk when FAC_DATA_DIR is set). Runs migrations/*.sql.
    accounts/           The game's own sign-in, profiles and cloud saves (WP-9). *.server.ts never goes to the browser.
    tournaments/        Server side of events, entries, boards, friends, trophies, rooms (WP-7, WP-8).
    multiplayer/p2p.ts  Full-mesh WebRTC room engine. Generic; keep as is.
    test-phase.ts, test-reset.server.ts   The test-phase switch and the server wipe (WP-13).
    auth/*              Better Auth wiring from the Grok sandbox template. Not the game's accounts. Leave alone.
    app-data/*, preview-*, og/   Sandbox-platform plumbing. Leave alone.
migrations/             0007 .. 0011 (the game's tables). migrations/auth/0001_auth.sql is the platform's, applied only with its sign-in on.
public/art/biomes/      15 paintings at two sizes, WebP only (<id>-1600.webp, <id>-800.webp). Originals in art-src/.
public/audio/           Five ambient OGG loops (scripts/ambience-build.mjs).
scripts/                Tooling: run-tests.mjs, docs-check.mjs, art-build.mjs, build-epoch.mjs, migrate.mjs, browser-smoke.mjs,
                        check-touch-targets.mjs and the Grok sandbox helpers. Tests are scripts/*.test.mjs.
docs/                   This documentation; docs/README.md is the index.
```

## State architecture

Two kinds of state, deliberately separate:

```
                 ┌──────────────────────────────┐
  React UI ◄─────┤  useGame (Zustand)           │  Save fields + UI fields + actions.
  (re-renders)   │  persisted subset = Save     │  Changes a few times a second at most.
                 └──────────────┬───────────────┘
                                │ frame(dt) reads/writes
                 ┌──────────────▼───────────────┐
  Canvas paint ◄─┤  sim (plain mutable object)  │  Cursor position, bobber, particles, swimmers,
  (60 fps)       │  never persisted             │  timers. Changes every frame. No React.
                 └──────────────────────────────┘
```

- `frame(dt)` in `engine.ts` is the simulation tick. `stage.tsx` calls it once per animation frame, then paints. **Add per-frame logic to `frame()` or functions it calls; never put timers in components.**
- When the simulation needs to tell React something (a catch landed, the phase changed), it calls `useGame.setState(...)`. Keep those calls to state that actually changed; the HUD bar is driven by direct DOM writes (`hud.track/zone/cursor`) precisely to avoid 60 React renders a second. WP-1 moves that HUD onto the canvas and removes the DOM refs.
- Persistence: `persistSoon()` debounces a `localStorage` write of `snapshot(state)` under the active slot's key (`slotKey` in `slots.ts`). `hydrate(mode)` → `loadSlot()` → `sanitize(raw)` → `setState`. Offline aquarium income is settled in `loadSlot` via `settleTank`.

## The catch loop (the original game; replaced by the tension fight of `04` section 5)

```
idle ──act()──► startCast()  wait 1.2–4 s × factors (reel speed, boat, lure, weather, bait, sig)
                   │
                   ▼ waitLeft hits 0
               beginBite()   rollFish(biome, luck, {stage, sig, bait, boss}) → sim.fish
                   │          biteMax = 1.3 s + rod.zone·8 ms; miss it → fail("slip")
                   ▼ act()
               hook()        perfect if within 0.4 s. need = 2 + rarity (boss: 6+). zone = rod.zone (+calm sig). hold = line.hold
                   │
                   ▼ act() repeatedly
               reelTap()     cursor sim.cp sweeps 0–100 at speed (70 + 28·rarity + 1.5·species)/(1+0.07·reelSpeed)
                             in band → hits++, placeZone(); out of band → tz += strain; tz ≥ hold → fail("snap")
                   │
                   ▼ hits ≥ need
               succeed()     withCatch(): inventory, dex, xp, contracts, derby score, rush progress; leap animation
```

Boss fights add three phases by `hits/need` (fast → reversals/fake-outs → "the run" with 1.6× strain).

**What the new fishing model keeps:** `rollFish`'s species/mutation weighting, `withCatch`'s bookkeeping, all the content tables. **What it replaces:** the 1-D cursor bar becomes a tension-and-position fight on the water (`04-fishing-model.md`), and `startCast` gains a target spot and a presentation.

## Rendering (the original game; the effects stack of `03` and `09` now sits between the painting and the fish)

`stage.tsx → paint()` each frame, in order: dark fill → painting (`drawCover`, slow "breathe" zoom) → weather tint → fog/aurora → 4 surface wave lines → bottom shade → background swimmers (`drawFish`) → plankton → guest boats → boss shadow → hooked/leaping fish → rod and line (color = strain) → bobber + ripples → particles → flashes → frenzy frame.

It is simple and already respects `motion` (reduced-motion) and `flash` settings. WP-1 layers the water effects *between* the painting and the fish, and draws the fight ring around the bobber.

## Multiplayer (as it was before WP-7; the relay now lives in the `rooms` and `signals` tables)

- `lib/multiplayer/p2p.ts` — generic WebRTC mesh. Peers register with `GET /api/rtc?room&peer&name&since` (also the poll), post `offer/answer/ice` envelopes with `POST /api/rtc {op:"signal"}`, leave with `{op:"leave"}`. Two data channels per pair: `state` (unreliable) and `reliable`.
- `game/multiplayer.ts` — co-op glue over it: 4-letter room codes, presence (biome + name), host broadcasts weather, catch feed. **Client-authoritative; fine for co-op, unacceptable for ranked tournaments.** WP-7 adds a server-scored path beside it, not instead of it.
- Relay storage is a `Map` on `globalThis` → works on one Vercel instance at a time. WP-7 moves rooms/signals to Neon tables so it survives multiple instances and cold starts.

## Data layer

`lib/db.ts` exposes `getSql()` returning a tagged-template SQL function that works on Neon (`pg`) or PGLite identically, runs pending `migrations/**/*.sql` on first use, and normalises bigint/date. **Use it; don't add another client.** Server code goes in TanStack **server functions** or `src/routes/api/*` route handlers — never import `db.ts` from client components.

## Extension points (use these, don't invent parallel ones)

| Want to… | Do this |
|---|---|
| Add a per-frame visual | Add state to `sim`, tick it in `frame()` (or a `tickX(dt)` helper called from it), draw it in `paint()`. |
| Add a game rule | Pure function in `content.ts` (data/formula) or `engine.ts` (state change), with a `*.test.ts` beside it. |
| Add a store action | Add to the `Store` type and the `create<Store>` body in `engine.ts`. Call `persistSoon()` if it changes saved fields. |
| Add a saved field | `Save` type → `fresh()` → `sanitize()` (with bounds) → `snapshot()` → bump `SAVE_VERSION` → new fixture + migration note in `07` → update the `docs-check:save-version` and `docs-check:fixtures` markers in `docs/README.md`. |
| Add a menu tab | Add its id to `MenuTabId` and to the `menuTabs` list of each mode that shows it in `modes.ts`, give it a label in `HUB_TABS` (`hubnav.ts`), and render it in `hub/Hub.tsx`. Selling and buying belong in the `shop` tab only (a test pins that). |
| Add a sound | New method on `audio` in `audio.ts`, synthesized. The only audio files are the five ambient loops in `public/audio/` (WP-6, `scripts/ambience-build.mjs`); keep them under 1.25 MB in all. |
| Add a mode | `Mode` union, a row in `MODES` (with its `menuTabs`), `MODE_LIST`, `MODE_KEYS` in `modes.ts`; a card in `MENU_CARDS` and `MODE_SELECT_IDS` if it is in mode select; a sync id in `slots.ts` if the cloud should hold it. `modeRules()` in `engine.ts` reads the table. Update the `docs-check:modes` marker in `docs/README.md`. |
| Add server logic | Route handler in `src/routes/api/<name>.ts` with `createFileRoute(...).server.handlers`, SQL via `getSql()`. |

## Known debt (history: every item here is done; kept for the record)

- ~~`panels.tsx` is 1,400 lines; WP-1 splits it per tab.~~ Done.
- ~~`art.ts` downloads all 15 paintings on first load (~11 MB); WP-1.~~ Done.
- ~~`Math.random()` everywhere in the fishing model; WP-2 introduces seeded `rng`.~~ Done.
- ~~The 14 tests that need `.grok/` fail outside the sandbox; WP-0.~~ Done.
- ~~`src/lib/app-data/client.server.ts:281` empty catch block fails lint; WP-0 (one-line fix, leave the rest).~~ Done.
- ~~Relay is single-instance; WP-7.~~ Done.
- ~~Derby rivals are random-walk numbers~~ Done in WP-6: the twelve Regulars (`rivals.ts`).
- Still open: `package-lock.json` is stale, and the open items are collected in [`../KNOWN-GAPS.md`](../KNOWN-GAPS.md).

## WP-7 additions
- `src/game/{weather,scoring,schedule,replay,tourney}.ts` (pure/shared), `src/components/game/tournament.tsx` (lobby, ticker, panel, results), `src/lib/tournaments/*.server.ts` (never import from client code), `src/routes/api/{events,entry,catch,board,survival-board,rtc}.ts`, `migrations/0007_tournaments.sql`.

## WP-6 additions
- `src/game/{rivals,pet,stickers,fotd,rarity,ambience,fun}.ts` (pure), `components/game/{fun.tsx,fun-hooks.ts,rarity-mark.tsx,pet-fx.ts}`, the sticker-book `panels/DexPanel.tsx`, `public/audio/*.ogg`, `scripts/ambience-build.mjs`. Save v8. `audio.ts` gained the lazy ambience player (`audio.ambient`, `audio.duck`).
- This branch also carries WP-7 (tournaments) merged in: `Mode` is `expedition | recreational | survival | coop | tournament`, `tabsFor(mode)` in `tabs.ts` returns the tabs for all of them, the menu has nine cards.

## WP-8 additions
- `src/game/{safe,social,fill}.ts` (pure), `src/game/eventroom.ts` (P2P room store), `src/components/game/{lobby,lobby-text,board,board-state,event-social,trophies,use-tick}`, `src/lib/tournaments/{friends,awards}.server.ts` (never import from client code), `src/routes/api/{friends,trophies}.ts`, `migrations/0008_social.sql`, `src/game/__fixtures__/save-v8.json`.
- `tournament.tsx` now holds the ticker, panel and results; the lobby moved to `lobby.tsx`.

## WP-9 additions
- `src/game/cloud.ts` (pure: sync modes, `decideSync`, `summarize`, fingerprints; shared by server and browser), `src/lib/accounts/*.server.ts` (accounts, sessions, profiles, saves, Google, mail; never import from client code), `src/lib/accounts/client.ts` (the browser's sign-in and sync engine, no React), `src/components/game/account.tsx` (menu chip, sign-in sheet, profile picker, conflict chooser, Settings section), `src/routes/api/{account,profiles,save,google-start,google-callback}.ts`, `migrations/0009_accounts.sql`, `src/game/__fixtures__/save-v9.json`.
- `engine.ts` gained three small exports for the cloud layer: `onPersisted(fn)`, `flushSave()` and `reloadActiveSlot()`. The save format is unchanged (version 9). Sync state lives in `localStorage["fac-cloud"]`, not in the `Save`.
- `src/lib/auth/*` and `src/lib/app-data/*` are untouched. The game's accounts are separate from the platform's Better Auth.
- The original biome JPGs live in `art-src/`; `public/art/biomes/` holds only the WebP set.

## As built in WP-10 (menu, graphics levels, full screen)
- **Removed:** `components/game/menu.tsx` (old main menu), `tabs.ts`, `layout/Rail.tsx`, `Drawer.tsx`, `MenuSheet.tsx`, `HudBar.tsx`. `tabsFor(mode)` is now `tabsForMode(mode)` in `src/game/hubnav.ts` and returns Hub tabs.
- **Hub** (`src/components/game/hub/`): `TitleScreen`, `Hub` (frame, tab strip, hint bar), `PlayTab`, `TackleTab`, `LodgeTab`, `WatersTab`, `PlayersTab`, `SettingsTab` + `settings-sections`, `CornerHud`, `Wheel`, `Satchel`, `HubKeys` (keyboard + gamepad), `parts` (list/detail layout), `panel-shell` (wraps older dark panels), `art` (paintings and placeholder art), `icons` (original SVG icons), `actions`, `friends-data`. Small separate store: `src/game/hubstate.ts` (`useHubUi`: open, tab, item, detail, wheel, satchel). Pure helpers with tests: `hubnav.ts`, `hubcopy.ts`, `spatial.ts`.
- **Graphics levels:** `device.ts` (`Level`, `LEVEL_TIER`, `resolveLevel`, `autoCeiling`), `graphics.ts` (`tierSpec`, `LEVEL_INFO`, governor), `probe.ts` (start-up speed test). See `09` §1.0.
- **Full screen:** `fullscreen.ts` (pure), `components/game/fullscreen.tsx`.
- **Layouts:** `DesktopLayout` and `MobileLayout` now show only the water, the corner HUD, the cast dock and (portrait phones) the inline cast panel.
- **Self-hosting fix:** `scripts/copy-pglite-assets.mjs` runs at the end of `npm run build` and copies PGLite's `pglite.data`, `pglite.wasm` and `initdb.wasm` next to a node-server bundle (`.output/server/_libs/`); it does nothing on the Vercel build. Without it a `node-server` build with no `DATABASE_URL` answered every database route with 500.
- **Touch-target check:** `node scripts/check-touch-targets.mjs [url]` (needs `playwright` installed and a running build).

## As built in WP-12 (two-level menu)
- **New:** `src/game/leave.ts` (when to ask before leaving, and the words), `src/game/peek.ts` (read-only look at a mode's saved collection), `hub/LeaveDialog.tsx`, `hub/CollectionsTab.tsx` (main menu), `hub/SurvivalTabs.tsx` (Camp, Larder, Event), tests `menu-levels.test.ts` and `menu-flow.test.ts`.
- **Changed:** `modes.ts` (`menuTabs`, `hasShop`, `MODE_SELECT_IDS`), `hubnav.ts` (`MAIN_TABS`, `tabsFor(screen, mode)`, `resolveHubTarget`), `Hub.tsx` (two levels, Resume and Leave), `PlayTab` (mode select), `TackleTab` (Tackle and Shop & Sell views), `LodgeTab` (Lodge, Log, Collection, Logbook), `PlayersTab` (Friends on the main menu, compact Players in game), `SettingsTab` (+ Account tab), engine `leaveToMenu` and `currentLeaveFacts`.

## As built in WP-11 to WP-16 (the later packages)
- **WP-11 (Recreational separate):** `modes.ts` lost the career merge (`sharesCareerDex`, `mergeDex` and friends) and gained `stagesOpen`/`stageIn()`. Detail: `05` section 11.
- **WP-13 (test phase):** `src/lib/test-phase.ts` (the switch and keep/wipe lists), `src/lib/test-reset.server.ts` (one SQL statement on the first `getSql()`), `src/game/epoch-gate.ts` (browser), `scripts/build-epoch.mjs` (stamps `src/lib/build-epoch.generated.ts` during `npm run build`), `src/routes/api/epoch.ts`, `src/components/game/test-phase.tsx`, `migrations/0011_test_phase.sql`. Detail: `docs/TEST-PHASE.md`.
- **WP-14 (line and gear):** `src/game/{line-wear,lines,gear-rules}.ts`; hooks in `fight.ts` (wear in `stepFight`), `replay.ts` (`rulesVersion`), the Tackle tab (Line workshop, Line packs). Detail: `10`.
- **WP-15 (events):** `src/game/{events,event-data,event-hooks}.ts`, `components/game/{events,use-mutation}.tsx|ts`. No server change. Detail: `11`.
- **WP-16:** `src/game/{difficulty,hazards,story,slots,achievements,pbroom}.ts`, `components/game/{slots,difficulty-picker,story-ui,achievements-ui,trophy-room,hazard-alerts}.tsx`; cloud slot ids in `src/game/cloud.ts`/`slots.ts`. No server migration. Detail: `12`.
