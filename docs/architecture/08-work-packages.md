# 08 · Work Packages — the build order

One package = one PR = one whole outcome. Build them in order; each one makes the next cheaper. Every package ends with the gates in `README.md` §Rules and a PR description that lists **Played** (what you did in the browser) and **Unverified** (what you couldn't check).

Branch naming: `wp-<n>-<slug>` off `main`. Open the PR against `main`.

| # | Package | Spec | Size | Depends on |
|---|---|---|---|---|
| 0 | Green outside the sandbox | below | S | — |
| 1 | Big Water presentation + mobile version | `03`, `09` | L | 0 |
| 2 | Spots, rigs, habits, seeded RNG | `04` §1–4 | L | 1 |
| 3 | Fight v2, keep/release, records | `04` §5–7 | M | 2 |
| 4 | Mode framework, Recreational, Kid Mode | `05` §1–4 | M | 3 |
| 5 | Survival Fishing | `05` §5 | L | 4 |
| 6 | Fun layer: rivals, pet, stickers, FotD, ambience, CB | `05` §6 | M | 4 |
| 7 | Server-verified tournaments | `06` §1–2 | L | 3 (needs fixed-step fight) + 4 |
| 8 | Lobby, live board, friends, teams, trophies | `06` §3 | M | 7 |
| 9 | Accounts, cloud saves, asset cleanup | `07` | M | 7 |

Packages 5, 6 and 7 are independent of each other and can run in parallel on separate branches once 4 is merged. 8 and 9 both follow 7.

---

## WP-0 · Green outside the sandbox

**Why:** the repo was built inside Grok's sandbox. Fourteen tests and one lint rule only pass there. Nothing else can be trusted until the gates are honest.

**Scope**
1. `package.json` `test` script → `node scripts/run-tests.mjs`: finds every `src/**/*.test.ts` plus the portable `scripts/*.test.mjs`, and registers `scripts/alias-loader.mjs` so tests can import game code that uses the `@/` path alias. One command.
2. The five `scripts/*.test.mjs` files that need the Grok sandbox (`.grok/skills`, the baked `site.json`): the runner includes them **only when `.grok/` exists**. Don't delete them; Caleb may still build in Grok.
3. Lint: `src/lib/app-data/client.server.ts:281` → add `/* ignore */` inside the empty catch (one line). Nothing else in that file.
4. Add `.github/workflows/ci.yml`: on `pull_request` and `push` to `main`, Node 22, `npm ci`, typecheck, lint, test, build. Cache `~/.npm`. ≈ 2 minutes.
5. Create `src/game/__fixtures__/save-v3.json` (play five minutes in dev, export from Settings, commit) and `src/game/save-migration.test.ts` that runs it through `sanitize()` (`07` §1 step 6).
6. Add `str()` and `list()` sanitize helpers (`07` §1 step 3) with tests.
7. `README.md` (repo root): replace the two-line Run section with: run, test, build, how to play on PC, where the specs live (`docs/architecture/`).

**Done when:** `npm test` prints 0 failures outside the sandbox and still runs the Grok tests inside it; CI workflow is green on the PR; fixture + migration test exist; lint clean.

---

## WP-1 · Big Water presentation + mobile version
Spec: `03` (desktop, effects, fight ring, celebration, Helping Hand, assets) and `09` (device/graphics tiers, phone and tablet layouts, touch controls, phone loading budget). **Done when:** `03` §9 items 1–9 **and** `09` §8 items 10–16. This package bumps `SAVE_VERSION` to 4 (`gfx`, `assist`, `followClock`).

Suggested order inside the package (each a commit, one PR): `device.ts` tiers → split `panels.tsx` → desktop layout shells (rail, drawer, HUD bar, cast dock) → **mobile layout** (sticky water block, peek strip, pinned cast, bottom tabs, `☰` sheet) → ring fight display + remove DOM bar (touch hold on mobile) → offscreen buffer + ripples + glints + rays + clock tint + rain rings, driven by the tier table → art pipeline (two sizes) + lazy loading per tier → celebration (card on desktop, bottom sheet on mobile) → Helping Hand → keys + fullscreen + photo-hide → fps governor + background pause → tap-target audit script → tests + screenshots at all three viewports.

---

## WP-2 · Spots, rigs, habits, seeded RNG
Spec: `04` §1–4 and §8. **Done when:** `04` §8 WP-2 list. Author all 75 spots and the ≥ 25 real-fish habit overrides; that content is the package, not an afterthought.

---

## WP-3 · Fight v2, keep/release, records
Spec: `04` §5–7. **Done when:** `04` §8 WP-3 list. Implement the fight tick as a pure `stepFight(F, held, 0.05)` driven by an accumulator so WP-7 can replay it (`06` §1.4).

---

## WP-4 · Mode framework, Recreational, Kid Mode
Spec: `05` §1–4. **Done when:** `05` §8 WP-4 list.

---

## WP-5 · Survival Fishing
Spec: `05` §5. **Done when:** `05` §8 WP-5 list. Survival has its own save key `fac-ultra-survival` and its own dex.

---

## WP-6 · Fun layer
Spec: `05` §6. **Done when:** `05` §8 WP-6 list. Ambient audio files must total < 1.25 MB and load lazily after first interaction.

---

## WP-7 · Server-verified tournaments
Spec: `06` §1–2, §5. **Done when:** `06` §6 WP-7 list. Everything must run on PGLite locally with no Neon credentials; set `DATABASE_URL` only to smoke-test against Neon (record as Unverified if you can't).

---

## WP-8 · Lobby, live board, friends, teams, trophies
Spec: `06` §3. **Done when:** `06` §6 WP-8 list.

---

## WP-9 · Accounts, cloud saves, asset cleanup
Spec: `07`. **Done when:** `07` §6.

---

## WP-10 · High-end menu system, graphics levels, full screen
Spec: `09-mobile.md` §1.0 (five graphics levels), §2.3 and §6 ("as built" notes), `02` (the Hub files), `06` §3.3 (friend requests, block). **Done when:** a title screen and a single-row pause menu (Play, Tackle, Lodge, Waters, Players, Settings) reach every old feature on a PC, phone and landscape phone; the quick wheel and satchel open on hold; Auto/Ultra/High/Medium/Low/Potato work with a governor that steps down fast and up slowly; full screen works from the HUD, Settings and the F key; friends can be added by name, email or code, removed and blocked; touch targets are at least 44 px (`scripts/check-touch-targets.mjs`).

---

## PR description template

```
## WP-<n> · <title>

Spec: docs/architecture/<file>.md §…

### What changed
- …

### Played
- At 1440×900: …
- At 390×844: …
- Screenshots: screenshots/wp<n>-*.png

### Gates
typecheck ✅ · lint ✅ · test ✅ (<n> tests) · build ✅ · fps <n> on Pond idle

### Unverified
- … (why, and what would verify it)

### Save migration
version <a> → <b>; fixtures loaded: save-v3.json, save-v<a>.json
```
