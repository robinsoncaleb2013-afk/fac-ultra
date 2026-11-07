# 07 · Data, Saves and Cloud

Work package **WP-9** (accounts + cloud saves), plus the save-migration procedure every package uses.

> **As built (WP-9 merged; extended by WP-11, 13, 14, 15, 16).** `SAVE_VERSION` is **13** (`src/game/engine.ts`; the table in section 1 lists every version). Accounts are the game's own (`src/lib/accounts/*`), not the platform's Better Auth; section 7 is the authoritative description and wins over sections 3 to 5. The sync state is **not** a `cloud` field in the `Save`. The cloud holds one row per mode **and slot** (section 2.1). Every build wipes saves while the test phase is on (end of section 7, `../TEST-PHASE.md`). Settings for running it are in the environment table in [`../README.md`](../README.md); the sign-in table below it is kept only to say what each setting means to a player. Real email, Google and Neon are unverified (`../KNOWN-GAPS.md`).

<!-- docs-check:save-version 13 -->
<!-- docs-check:fixtures 3 4 5 6 7 8 9 10 11 12 13 -->
<!-- docs-check:migrations 0001 0007 0008 0009 0010 0011 -->

## 1. The migration procedure (every package)

`src/game/engine.ts` owns `Save`, `fresh()`, `sanitize()`, `snapshot()`, `SAVE_VERSION`. When a package adds or changes a saved field:

1. Add the field to `Save` with a comment naming the package (`/* WP-2 */`).
2. Give it a default in `fresh()`.
3. Read it in `sanitize()` with bounds (`num/int/bool` helpers exist; add `str(v, max)` and `list(v, item, max)` in WP-0). **Never trust shape** — saves are user-editable JSON.
4. Include it in `snapshot()` (the persisted subset).
5. Bump `SAVE_VERSION`. If the meaning of an *existing* field changed, add a `migrate_vN_to_vN+1(raw)` step in `sanitize()` before reading, like the v1→v3 biome remap that's already there.
6. Add a fixture: `src/game/__fixtures__/save-v<N>.json` captured from a real play session *before* your change, and a test in `save-migration.test.ts` that loads every fixture through `sanitize()` and asserts the key invariants (dex count preserved, money preserved, no NaN, version = current). WP-0 creates the folder with a v3 fixture.
7. Export/import codes (`exportCode`/`importCode`) serialise `snapshot()`; they need no change but the test must round-trip a current save.

Field inventory planned by this chapter (so names don't collide):

| Field | Package | Type |
|---|---|---|
| `gfx`, `assist`, `followClock`, `kid` | WP-1 / WP-4 | settings |
| `lastSpot`, `rig` | WP-2 | `Record<number, string>`, `Record<number, {depth, retrieve}>` |
| `records`, `released`, `stewards` | WP-3 | see `04` §6–7 |
| `trips` | WP-4 | `Trip[]` (last 50) |
| `survival` | WP-5 | `SurvivalRun \| null` (own save key) |
| `pet`, `stickers`, `shiny`, `fotdClaimed`, `rivalRecord` (+ device `volume`, `cb`) | WP-6 | save v8, see `05` §6 and §10 |
| `trophies`, `titles`, `bobberSkin`, `tourneyHistory` | WP-8 | arrays |
| `events` | WP-15 | save v10: streak clock, running event, seen events, mutated-fish counts; see `11` §8 |
| `slotName`, `difficulty`, `sideDex`, `story`, `ach`, `hz`, `autoKeep`, `created` | WP-16 | save v12: slot name, difficulty, Kids book, Story chapter, achievements, hazard state; see `12` |
| `cloud` | WP-9 | **Not built** as a save field: sync state lives in `localStorage["fac-cloud"]` (section 7) |
| `lineGear` | WP-14 | save v11: lines owned, unopened packs, last pull; see `10` section 1.7 |
| `promo`, `prestige`, `tutored`, `night` | Update Three | save v13: claimed promo codes, Prestige count, guided-tutorial flag, night-fishing state |

### Save version history

Each package that changed the shape bumped once. Every version has a fixture in `src/game/__fixtures__/` (there is no v1 or v2 file; they predate the folder) and loads through `sanitize()`.

| Version | Package | What it added |
|---|---|---|
| 1, 2 | the original game | Ten waters; v1 to v3 remapped biome ids when five waters were inserted |
| 3 | expansion | 15 waters, bosses, aquarium, mutations (fixture `save-v3.json`) |
| 4 | WP-1 | `gfx`, `assist`, `followClock` |
| 5 | WP-2 | `lastSpot`, `rig` |
| 6 | WP-3 | `records`, `released`, `stewards`, `coached`, `drag` |
| 7 | WP-4 | `kid`, `trips`, `trip` |
| 8 | WP-6 | `pet`, `stickers`, `shiny`, `fotdClaimed`, `rivalRecord` (+ device `volume`, `cb`) |
| 9 | WP-8 | `trophies`, `titles`, `bobberSkin`, `tourneyHistory` |
| 10 | WP-15 | `events` (long-play events and mutations) |
| 11 | WP-14 | `lineGear` |
| 12 | WP-16 | `slotName`, `created`, `difficulty`, `sideDex`, `story`, `ach`, `hz`, `autoKeep` |
| 13 | Update Three | `promo`, `prestige`, `tutored`, `night` |

Survival has its own save shape (`sanitizeSurvival`, fixture `survival-v1.json`) and its own version. WP-5, WP-10, WP-11, WP-12 and WP-13 changed no save field. The numbers 10, 11, 12 follow merge order, not package number.

> WP-14 note: it took v11 (WP-15 took v10); old saves get one copy of each line up to the one they used. See `10-gear-progression-and-line.md` section 1.7.

## 2. Save slots

One `localStorage` key per mode (`modes.ts` `saveKey`): `fac-ultra` (Expedition), `fac-ultra-sandbox` (Recreational; the key keeps the old Sandbox name so old saves carried over), `fac-ultra-survival`, `fac-ultra-coop`, `fac-ultra-tourney` and `fac-ultra-story` (Story). **Slots never share data** (WP-11): a mode reads and writes only its own key, including its dex, records, stickers, shinies, Fish of the Day claim, pet and Regulars record. Settings that are about the *device* (gfx, sound, motion, flash, kid, followClock) are **also** mirrored to a shared key `fac-ultra-device` so they apply across modes; `hydrate()` overlays them.

### 2.1 Slots and cloud ids (WP-16)

Expedition and Story have up to three slots (`MAX_SLOTS` in `slots.ts`): slot 0 keeps the old key, slots 1 and 2 add `-s1` / `-s2`. The cloud `mode` column is a sync id (`expedition`, `expedition-s1`, `story-s2`); no database change. The server sanitize and delete cover every slot id. Save v12 adds `slotName`, `created`, `difficulty`, `sideDex` (Kids book), `story`, `ach`, `hz` (hazard state) and `autoKeep`. Full design: `12-difficulty-slots-achievements.md`.

## 3. Accounts (WP-9)

*(Plan only; superseded by section 7: the game uses its own accounts and leaves the platform's Better Auth alone.)* Better Auth is installed and migrated (`migrations/auth/0001_auth.sql`, `src/lib/auth/*`) but gated by the sandbox's `VITE_AUTH_ENABLED` flag. The plan was to turn it on **optionally**:

- Sign-in is never required to play. The menu gets a quiet "Save to the cloud" button (and the tournament lobby suggests it for ranked history). Providers: email magic link + Google. Kids' flow: a parent signs in once; profiles are **local nicknames inside the account** (`profiles` table: account → up to 4 named profiles, each with its own saves), so a family shares one login. No profile may be created without the account holder present (the create button sits behind the sign-in).
- `src/lib/auth/gates.tsx` and friends are the template's gate UI; reuse the server pieces (`server.ts`, `middleware.ts`, `verify.server.ts`), replace the gate UI with a 2-screen flow styled like the game. Keep `VITE_AUTH_ENABLED` honoured so the sandbox build still works.

## 4. Cloud saves (WP-9)

### 4.1 Table
```sql
create table saves (
  profile_id text not null,
  mode text not null,                 -- a sync id: expedition, expedition-s1, story-s2, recreational ... (slots.ts)
  rev int not null,                   -- monotonic per (profile, mode)
  data jsonb not null,                -- snapshot()
  device text,                        -- last writer
  updated_at timestamptz default now(),
  primary key (profile_id, mode)
);
```

### 4.2 Sync rules (simple, predictable, kid-proof)
- **Local is the source of truth while playing.** Every `persistNow()` also schedules a cloud push (debounced 10 s, plus on `visibilitychange: hidden`).
- Push: `POST /api/save {mode, rev: local.rev, data}`. Server accepts if `rev == stored.rev + 1`, else returns `conflict` with the stored save.
- On load (`hydrate`) with an account: fetch the cloud save; if `cloud.rev > local.rev` **and** the cloud save's `caught` or `tot` is higher, use the cloud copy; otherwise keep local and push. Never silently lose progress: if both have progress the other lacks (`caught` higher locally, `tot` higher in cloud), show a one-screen chooser with both summaries ("This computer: 212 fish, $48K · Cloud: 198 fish, $51K") and keep the other as a backup code in Settings for 7 days.
- Offline: queue the push; retry on reconnect. The game never waits on the network.

### 4.3 Server
`src/routes/api/save.ts` GET/POST behind the auth middleware; body ≤ 256 KB; `data` is passed through `sanitize()` **on the server too** before storage (the game code is isomorphic) so a hand-edited save can't poison the cloud.

## 5. Asset cleanup (WP-9)
*(Done in WP-9.)* Delete the original `public/art/biomes/*.jpg` once every reference uses the WebP set from WP-1. Add `public/art/README.md` describing the sizes and how `scripts/art-build.mjs` regenerates them from the `art-src/` originals (move the JPGs there, gitignored or LFS — decision for Caleb; default: keep in repo under `art-src/`, they're 11 MB).

## 6. Done when (WP-9)
- Optional sign-in with magic link + Google; family profiles (≤ 4) under one account; game fully playable signed out.
- Cloud push/pull with the rules in §4.2; conflict chooser; offline queue; server-side sanitize.
- Tournament `players.id` linked to the account (`entries` history visible across devices).
- Migration tests cover v3 → current with every fixture; export/import round-trips.
- Original JPGs moved out of `public/`; first-screen transfer still < 1.2 MB.
- **Unverified** (record in PR): magic-link email delivery in production (needs the Vercel env + email provider keys — Chris's checklist item).


---

## 7. As built (WP-9)

Decisions the spec left open, and what shipped. Where this section and §3-5 differ, this section wins.

**Accounts are the game's own** (`src/lib/accounts/*`, `src/routes/api/{account,profiles,save,google-start,google-callback}.ts`, `migrations/0009_accounts.sql`). The platform's Better Auth (`src/lib/auth/*`) and `VITE_AUTH_ENABLED` are untouched and `npm run check:auth` still passes. Sign-in is an emailed link (15 minutes, one use). "Sign in with Google" is an optional second door, hidden unless both Google keys are set. Both reach the same account by verified email. Sessions are a random secret in an httpOnly, SameSite=Lax cookie (Secure over https); only its SHA-256 is stored; 30 days sliding; at most 10 browsers per account. Limits: 10 links/hour per address, 5/hour per email, 30 link tries/hour per address, 60 profile/save writes/minute per account. The sign-in response never says whether an email already has an account, and never contains the link.

**Profiles.** Up to 4 per account (`profiles`, slot 0-3). A profile is a nickname (run through `safeName`) and a kid flag. No email, no birthday. Only a signed-in grown-up can add one. Picking a kid's profile turns Kid Mode on for that screen and a grown-up's turns it off. With Kid Mode on, the account screens show no email box, no Google button and no sign-out/delete/add/remove controls. This is a fence for a family, not a lock.

**Cloud saves.** `saves(profile_id, mode, rev, data, device, updated_at)` for `expedition`, `story`, `recreational`, `survival` and `coop` (and the extra slots of Expedition and Story, `-s1`, `-s2`), each its own row and revision (Recreational is never folded into Expedition). `allSyncIds()` in `src/game/slots.ts` is the list. Tournament saves stay on the tournament server. Differences from §4.2, on purpose:
- The browser sends `baseRev` (the revision it last saw) and the server makes it `baseRev + 1` if that is still the stored revision. The browser does not invent revisions. A stale `baseRev` gets `409 conflict` with the stored save. `force: true` is only sent after the player chose "keep this device".
- Sync state is **not** in the `Save` (the planned `cloud` field would have synced itself and bumped `SAVE_VERSION` for nothing). It lives in `localStorage["fac-cloud"]` beside a 7-day backup list in `fac-cloud-backups`. The save version was not touched by this package.
- "Changed since last sync" is a fingerprint of the save without the Aquarium clock (`changeKey`), not a flag, so nothing can forget to set it. A push happens 10 s after a change, when the page is hidden, when the connection returns and every 60 s while offline.
- The decision table is `decideSync` in `src/game/cloud.ts` (pure, tested). Both sides changed and each has something the other lacks -> the chooser ("Keep this device's fish" / "Keep the cloud's fish" / "Keep the newer one"). The copy that loses is kept for 7 days in Lodge -> Settings -> Cloud save, restorable or copyable as a save code.
- Every upload is parsed by the same `sanitize()` / `sanitizeSurvival()` the game loads with, on the server, then stored. Bodies over 256 KB are refused.
- Profile switching on a shared device swaps the saves in the local slots (the previous profile's copy is pushed first and stashed as a backup).

**Tournament identity.** Each profile can hold one `players.id` (unique). The first profile to sign in on a device keeps that device's anonymous id, so its history (`entries`, `results`, friends, trophies) carries over. On any other device the profile's own id replaces the device's (unless a tournament is running, then it applies next load). A second profile on the same device gets a fresh id. The old anonymous history of a device that adopts another id stays under the old id; it is not merged.

**Account data.** "Download everything we hold" returns one JSON file (profiles, saves, tournament results, friend count). "Delete my account" (type DELETE) removes the account, profiles, saves, sessions and sign-in links, removes the linked players' friends, invites and results, and renames the players row to "Former angler" with no friend code. Scores already on other people's boards stay, with nothing pointing back to a person.

**Running it on your own PC.** Everything works with no setting at all: the sign-in link is written to the server's console, and the database is in memory (set `FAC_DATA_DIR` or `DATABASE_URL` to keep accounts and cloud saves across a restart). To make sign-in real, set these where the game's process starts (the complete list of settings is the environment table in [`../README.md`](../README.md); this table says what these four mean):

| Variable | What it does |
|---|---|
| `FAC_PUBLIC_URL` | The game's public address, e.g. `https://fac-ultra.tail41d4fa.ts.net`. Put it in the sign-in link. Strongly recommended. |
| `RESEND_API_KEY` | An API key from resend.com. Turns on real emails. |
| `FAC_EMAIL_FROM` | The From line, e.g. `FAC Ultra <login@yourdomain>`. Must be an address Resend has verified. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Turn on "Sign in with Google". Register `<FAC_PUBLIC_URL>/api/google-callback` as the authorised redirect URI. |

**Assets.** The 15 original JPGs moved from `public/art/biomes/` to `art-src/` (not served). `scripts/art-build.mjs` rebuilds the WebP set from there; `public/art/README.md` says how. The loader and the thumbnails no longer try a JPG: a painting that fails to load is simply not drawn.

**Test-phase auto-reset (WP-13, as built).** While the game is in testing, each new build wipes progress, behind one switch (`TEST_PHASE_RESET` in `src/lib/test-phase.ts`, overridden by `FAC_TEST_RESET=0|1`). Full description: `docs/TEST-PHASE.md`. How it touches saves:
- `scripts/build-epoch.mjs` stamps a new build epoch (`<commit>-<UTC time>`) into `src/lib/build-epoch.generated.ts` during `npm run build` and puts `"dev"` back afterwards. Dev servers and tests always use `"dev"`.
- **Server:** the first `getSql()` after a boot runs one SQL statement (`src/lib/test-reset.server.ts`) that moves `app_state.build_epoch` to the new epoch and, only if it moved, deletes every table in `WIPE_TABLES` (this includes all `saves` rows, so cloud revisions restart at 1). Accounts, sessions, profiles, `players` (its ban, last-seen and current-event columns are cleared), `friends` and `blocks` stay. Because it is one statement, two requests at boot cannot both wipe, and a half-wipe cannot happen. Switch off: nothing runs and the stored epoch is not touched.
- **Browser:** before `hydrate()` the page compares `localStorage["fac-ultra-epoch"]` with its build. A different build with the switch on removes every game key (all mode slots and their `-bak` copies, `fac-cloud`, `fac-cloud-backups`, tournament queues) except the keep list (`fac-ultra-device`, full-screen preference, blocked names, the anonymous player id and name), so no old save is ever sanitised or migrated into the new build, and the sync notes go with the saves (nothing is pushed or pulled from before the reset). A first visit stores the epoch silently.
- `GET /api/epoch` returns the server's epoch and switch, so an old cached tab reloads once, and `POST /api/save` refuses an upload that names an older build (`412 old_build`), so a stale tab cannot push an old save back.
