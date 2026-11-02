# 02 · Codebase Map

What exists today, how it fits together, and where the new work plugs in. Read this before editing anything.

## Directory map

```
src/
  routes/
    __root.tsx          Document shell (fonts, meta, AuthProvider). Don't add og: tags here.
    index.tsx           "/" → <Game/> from components/game/shell.tsx
    api/rtc.ts          WebRTC signaling relay (in-memory). Extended in WP-7.
  components/
    game/
      shell.tsx         Screen router: MainMenu | game layout (Header, Stage, ActionBand, Panel, Nav), Toasts, WelcomeBack
      stage.tsx         The canvas. requestAnimationFrame loop → engine.frame(dt) → paint(). All water/fish/particle drawing.
      panels.tsx        Every tab's UI: Cast, Bag, Gear, Lures, Waters, Dex, Lodge (Record/Aquarium/Derby/Crew/Settings). 1,400 lines; split in WP-1.
      portrait.tsx      <FishPortrait/>: a small canvas that draws one fish swimming in place.
    ui/button.tsx       The one shared UI primitive. (Radix is installed but mostly unused in the game.)
  game/
    content.ts          THE DATA. Biomes, species names, rarity bands, gear ladders, lures, signature lures, baits, weather, tank tiers, formulas (luck, value, weight, rollFish).
    modes.ts            The mode rules table (Expedition, Recreational, Co-op …), menu cards, stage rule. Pure. No mode shares data with another.
    trips.ts            Recreational trips, creel and logbook helpers, photo caption. Pure.
    kid.ts              Kid Mode helpers (confirmations, hints, number words). Pure.
    engine.ts           THE RULES + STATE. Save type, sanitize/migrate, Zustand store + actions, the per-frame `sim`, cast → wait → bite → reel → catch, contracts, derby, rush, persistence.
    fish-draw.ts        Procedural fish artist: 12 archetypes × pattern layer. drawFish(ctx, x, y, len, dir, look).
    art.ts              Loads the 15 biome paintings (eagerly — fixed in WP-1), fitCanvas() for DPR-correct canvases.
    audio.ts            WebAudio synth cues: cast, bite, hook, tick, miss, land(rarity), fail, frenzy, perfect. No files.
    multiplayer.ts      Online co-op glue: room code, presence, weather sync, catch feed, peerBoats() for drawing guests.
  lib/
    multiplayer/p2p.ts  Full-mesh WebRTC room engine (perfect negotiation, two data channels). Generic; keep as is.
    db.ts               getSql(): Neon when DATABASE_URL set, else embedded PGLite. Runs migrations/*.sql.
    auth/*              Better Auth wiring from the sandbox template. Currently gated off. Turned on in WP-9.
    app-data/*, preview-*, og/   Sandbox-platform plumbing. Leave alone.
migrations/auth/0001_auth.sql   Better Auth tables (users, sessions …).
public/art/biomes/*.jpg         15 paintings, 0.5–1 MB each (converted to WebP + sizes in WP-1).
scripts/                        Sandbox tooling. browser-smoke.mjs is useful; the *.test.mjs files that need .grok/ are skipped by WP-0.
docs/EXPANSION-DESIGN.md        Historical design doc for the 2026-11-01 expansion.
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
- Persistence: `persistSoon()` debounces a `localStorage` write of `snapshot(state)` under `modeKey()`. `hydrate(mode)` → `loadSlot()` → `sanitize(raw)` → `setState`. Offline aquarium income is settled in `loadSlot` via `settleTank`.

## The catch loop (today)

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

## Rendering (today)

`stage.tsx → paint()` each frame, in order: dark fill → painting (`drawCover`, slow "breathe" zoom) → weather tint → fog/aurora → 4 surface wave lines → bottom shade → background swimmers (`drawFish`) → plankton → guest boats → boss shadow → hooked/leaping fish → rod and line (color = strain) → bobber + ripples → particles → flashes → frenzy frame.

It is simple and already respects `motion` (reduced-motion) and `flash` settings. WP-1 layers the water effects *between* the painting and the fish, and draws the fight ring around the bobber.

## Multiplayer (today)

- `lib/multiplayer/p2p.ts` — generic WebRTC mesh. Peers register with `GET /api/rtc?room&peer&name&since` (also the poll), post `offer/answer/ice` envelopes with `POST /api/rtc {op:"signal"}`, leave with `{op:"leave"}`. Two data channels per pair: `state` (unreliable) and `reliable`.
- `game/multiplayer.ts` — co-op glue over it: 4-letter room codes, presence (biome + name), host broadcasts weather, catch feed. **Client-authoritative; fine for co-op, unacceptable for ranked tournaments.** WP-7 adds a server-scored path beside it, not instead of it.
- Relay storage is a `Map` on `globalThis` → works on one Vercel instance at a time. WP-7 moves rooms/signals to Neon tables so it survives multiple instances and cold starts.

## Data layer (today)

`lib/db.ts` exposes `getSql()` returning a tagged-template SQL function that works on Neon (`pg`) or PGLite identically, runs pending `migrations/**/*.sql` on first use, and normalises bigint/date. **Use it; don't add another client.** Server code goes in TanStack **server functions** or `src/routes/api/*` route handlers — never import `db.ts` from client components.

## Extension points (use these, don't invent parallel ones)

| Want to… | Do this |
|---|---|
| Add a per-frame visual | Add state to `sim`, tick it in `frame()` (or a `tickX(dt)` helper called from it), draw it in `paint()`. |
| Add a game rule | Pure function in `content.ts` (data/formula) or `engine.ts` (state change), with a `*.test.ts` beside it. |
| Add a store action | Add to the `Store` type and the `create<Store>` body in `engine.ts`. Call `persistSoon()` if it changes saved fields. |
| Add a saved field | `Save` type → `fresh()` → `sanitize()` (with bounds) → `snapshot()` → bump `SAVE_VERSION` → migration note in `07`. |
| Add a UI tab/panel | New file under `components/game/panels/` (WP-1 creates the folder), register in `Tab` and `TABS`. |
| Add a sound | New method on `audio` in `audio.ts`, synthesized. The only audio files are the five ambient loops in `public/audio/` (WP-6, `scripts/ambience-build.mjs`); keep them under 1.25 MB in all. |
| Add a mode | `Mode` union + `MODE_KEYS` + mode rules table in `05-game-modes.md` → `modeRules()` in `engine.ts` (WP-4 creates it). |
| Add server logic | Route handler in `src/routes/api/<name>.ts` with `createFileRoute(...).server.handlers`, SQL via `getSql()`. |

## Known debt (fix only inside the package that owns it)

- `panels.tsx` is 1,400 lines; WP-1 splits it per tab.
- `art.ts` downloads all 15 paintings on first load (~11 MB); WP-1.
- `Math.random()` everywhere in the fishing model; WP-2 introduces seeded `rng`.
- The 14 tests that need `.grok/` fail outside the sandbox; WP-0.
- `src/lib/app-data/client.server.ts:281` empty catch block fails lint; WP-0 (one-line fix, leave the rest).
- Relay is single-instance; WP-7.
- ~~Derby rivals are random-walk numbers~~ Done in WP-6: the twelve Regulars (`rivals.ts`).

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
