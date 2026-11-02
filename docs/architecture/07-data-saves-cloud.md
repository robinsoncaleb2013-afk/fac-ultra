# 07 · Data, Saves and Cloud

Work package **WP-9** (accounts + cloud saves), plus the save-migration procedure every package uses.

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
| `cloud` | WP-9 | `{ userId, lastSync, rev }` |

Save v4 is the version that ships with WP-1; each later package bumps once.

## 2. Save slots

One `localStorage` key per mode (`modes.ts` `saveKey`). Settings that are about the *device* (gfx, sound, motion, flash, kid, followClock) are **also** mirrored to a shared key `fac-ultra-device` so they apply across modes; `hydrate()` overlays them.

## 3. Accounts (WP-9)

Better Auth is already installed and migrated (`migrations/auth/0001_auth.sql`, `src/lib/auth/*`) but gated off by the sandbox's `VITE_AUTH_ENABLED` flag. Turn it on **optionally**:

- Sign-in is never required to play. The menu gets a quiet "Save to the cloud" button (and the tournament lobby suggests it for ranked history). Providers: email magic link + Google. Kids' flow: a parent signs in once; profiles are **local nicknames inside the account** (`profiles` table: account → up to 4 named profiles, each with its own saves), so a family shares one login. No profile may be created without the account holder present (the create button sits behind the sign-in).
- `src/lib/auth/gates.tsx` and friends are the template's gate UI; reuse the server pieces (`server.ts`, `middleware.ts`, `verify.server.ts`), replace the gate UI with a 2-screen flow styled like the game. Keep `VITE_AUTH_ENABLED` honoured so the sandbox build still works.

## 4. Cloud saves (WP-9)

### 4.1 Table
```sql
create table saves (
  profile_id text not null,
  mode text not null,                 -- saveKey
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
Delete the original `public/art/biomes/*.jpg` once every reference uses the WebP set from WP-1. Add `public/art/README.md` describing the sizes and how `scripts/art-build.mjs` regenerates them from the `art-src/` originals (move the JPGs there, gitignored or LFS — decision for Caleb; default: keep in repo under `art-src/`, they're 11 MB).

## 6. Done when (WP-9)
- Optional sign-in with magic link + Google; family profiles (≤ 4) under one account; game fully playable signed out.
- Cloud push/pull with the rules in §4.2; conflict chooser; offline queue; server-side sanitize.
- Tournament `players.id` linked to the account (`entries` history visible across devices).
- Migration tests cover v3 → current with every fixture; export/import round-trips.
- Original JPGs moved out of `public/`; first-screen transfer still < 1.2 MB.
- **Unverified** (record in PR): magic-link email delivery in production (needs the Vercel env + email provider keys — Chris's checklist item).
