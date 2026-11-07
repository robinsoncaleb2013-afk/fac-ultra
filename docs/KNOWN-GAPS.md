# Known gaps

Everything that was **not verified**, every open balance question, and every item the work-package reports left for later. Nothing here blocks development or a merge: a check that needs a person, a phone, a paid account or a key is recorded here as *untested* and the work moves on. When one is checked, delete its line and say what was seen in the PR that did it.

Last reviewed after WP-16 (main `0075b66`). The per-package status table is in [`architecture/README.md`](architecture/README.md).

## 1. Needs a person or a device (not testable in the agents' sandbox)

| Area | What is untested | How to check it | Came from |
|---|---|---|---|
| Real phones | Touch feel, tap sizes under a thumb, vibration on hits, the rig sheet, hold-to-reel while a thumb covers the ring, 60 fps on a mid-range Android | Play for ten minutes on a real phone in portrait and landscape; `node scripts/check-touch-targets.mjs` against a build covers tap sizes only | WP-1, WP-10, WP-12, WP-14, WP-15, WP-16 |
| iPhone full screen | iPhone Safari has no page Fullscreen API. The button shows an "Add to Home Screen" hint; nobody has opened the installed copy on an iPhone | Add to Home Screen on an iPhone and check there are no browser bars and the safe areas look right | WP-10 |
| Audio | The five ambient loops (crossfade on travel, levels against the synth), the event shimmer and mutation chime, volume slider, ducking under Kid Mode speech | Listen on speakers and headphones, travel between waters | WP-6, WP-15 |
| Painting details | Water line and sun position per painting (`WATER_LINE`, `SUN_X` in `src/game/water.ts` were eyeballed), glints and rays on all 15 | Look at each water at dawn, day, dusk and night | WP-1 |
| Gamepad hardware | The mapping (A, B, Y, LB, RB, LT, Start, d-pad, left stick) is unit tested with fake snapshots, never with a real controller | Plug in an Xbox-style pad, walk both menu levels, open the wheel and satchel | WP-10, WP-12 |
| Real email | Sign-in and friend-invite emails through Resend (`RESEND_API_KEY`, `FAC_EMAIL_FROM`); without a key the link is only printed in the server log | Set the key, ask for a link, check the inbox and spam | WP-9, WP-10 |
| Google sign-in | The whole Google door (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect address) | Register the keys, sign in, check it reaches the same account as the emailed link | WP-9 |
| Neon / real Postgres | Everything server-side was tested on embedded PGLite only: the migrations 0007 to 0011, the one-statement test-phase reset, cloud slot sync, tournaments, friends. The SQL is written for both, but Postgres has not run it | Point `DATABASE_URL` at a Neon branch, run `npm run build` (applies the migrations) and play a tournament round | WP-7, WP-8, WP-9, WP-13, WP-16 |
| Multi-device tournaments | Two real devices on different networks: peer-to-peer rooms through STUN (`06` section 4: some home routers will need a TURN server), the live board refresh, team events, results and trophies after an event ends | Two households join the same Quick event and a private team event | WP-7, WP-8 |
| Cold-start and load | `/api/catch` under a 100-player Quick event, Neon waking on the first join of the day | Load test later (k6 from a dev machine) | WP-7 |
| Tournament feel | Fixed gear (rod 6, reel 4, line 4) and rules version 2: does a normal event cast ever end by line wear? (The WP-14 report says no; it was calculated, not played over a full event.) | Fish one full Daily | WP-14 |
| Hazard feel and balance | Legend's lawsuits and tank jumps over hours of play; how often lures and rods are lost; whether Hard's 8 percent lure loss feels fair | A long Legend session and a long Hard session | WP-16 |
| Events live | A mutated fish landing in a real fight and the catch card; the banner at the moment an event starts (a fake clock covers the start; the chip and the list were played); a real one-hour wait | One honest hour of play | WP-15 |
| Kid reading | Wording of the gear-lock sentences and the difficulty blurbs on a real child's eyes | Ask a kid to read the Shop & Sell lock lines aloud | WP-14, WP-16 |
| Full gear progression | A level 1 to level 85 playthrough: pack drops are random and only the rules are unit tested | Long career session; the tables are in `gear-rules.ts` and `lines.ts` | WP-14 |

## 2. Open balance questions (numbers live in one table each)

| Question | Table | Notes |
|---|---|---|
| Is a rare fish's line wear of 3 percent per second right? Caleb did not give one; 3 is the middle of 2 and 5. | `WEAR.pct` in `src/game/line-wear.ts` | Normal fights last 5 to 15 s, so wear only bites on legendaries and bosses with a low line. Make it harsher here if wanted. |
| Are the line-pack odds and the craft recipe (3 to 10 copies) too kind or too slow? | `LINE_PACKS`, `RECIPE_DUPES`, `CRAFT_GATE` in `src/game/lines.ts` | Never playtested for pacing. |
| Do the level gates feel right (maps at level 1 to 66, boats at 1 to 62)? | `MAP_LEVEL`, `BOAT_GATE`, `PACK_LEVEL` in `src/game/gear-rules.ts` | Unit tested to be unskippable, not tuned for fun. |
| Event rarity chances and durations, the 3 minute idle rule, the 10 minute away rule, the 30 minute cooldown | `EVENT_RARITIES`, `IDLE_MS`, `AWAY_RESET_MS`, `COOLDOWN_MS` in `src/game/event-data.ts` | The hourly roll gives a Mythic a 25 percent chance at 10 hours; nobody has played 10 hours. |
| Difficulty numbers (fight, bite wait, worth, XP, line drain) | `DIFFICULTY_TABLE` in `src/game/difficulty.ts` | Legend pays 75 percent; unplayed at length. |
| Hazard odds | `HAZARD_TABLE` in `src/game/hazards.ts` | See the hazard feel row above. |
| Story chapter goals and rewards | `CHAPTERS` in `src/game/story.ts` | Derived from the Story save's own book; goals have not been timed. |
| Survival difficulty on the eight waters | `src/game/survival.ts` | The competent-player test passes (12 or more days on Pond); real players unknown. |
| Quick, Daily and Weekly budgets (40, 150 and 150 casts; 10 min, 1200 s and 1500 s) | `src/game/schedule.ts` | Chosen by the builder. |
| Rival skill curve (0.40 to 0.95) in Derby | `src/game/rivals.ts` | Unit tested to be beatable. |

## 3. Left for later, from the work-package reports

- **`package-lock.json` is stale** and cannot be pushed through the GitHub connector (its upload tool refuses lockfiles). `npm ci` refuses it, so CI and the hosting recipe use `npm install`. To fix: on a normal machine run `npm install`, commit the new lockfile, then switch `.github/workflows/ci.yml` back to `npm ci`. (CI files are not edited by documentation work.)
- **`npm run check:auth` exits 2** ("indeterminate") anywhere but the Grok sandbox, because it needs the sandbox's dev server to say what `VITE_AUTH_ENABLED` resolved to. It is not part of CI and no auth file was touched by any package.
- **Vercel manifest says `standalone`, not `fullscreen`.** The web app manifest is written by the sandbox plugin (`scripts/grok-pwa-*`, `public/__grok/`) with `display: standalone`. A `fullscreen` display mode would need that plumbing changed, so an installed copy keeps a status bar on Android. In-browser full screen (the F key and the buttons) works.
- **`vite.config.ts` hardcodes `preset: "vercel"`.** Self-hosting rewrites it inside the image build (see [`README.md`](README.md)). The tidy fix, `preset: process.env.NITRO_PRESET ?? "vercel"`, is the repo owner's call.
- **Fish already merged into a career save by early builds stay there.** When Recreational was made separate (WP-11), species, records, stickers and Regulars scores that an earlier build had copied into a career save cannot be told apart from career catches. The test-phase reset wipes them on the next build anyway.
- **Test-phase reset is on.** Every build wipes progress until `FAC_TEST_RESET=0` is set and the checklist in [`TEST-PHASE.md`](TEST-PHASE.md) is done. A brand-new server database also wipes once (there is no stored epoch to compare), so the first start of a fresh install logs a `[test-phase] New build` line.
- **Auto-fishing gets mutations at its usual 40 percent payout** and Co-op player 2 shares the event (`11` section 9). Decided, not tuned.
- **Records are not split by mutation** (best weight only), by design (`11` section 6).
- **Achievements are not tracked in Survival or Tournament** (`achievementsOn` in `src/game/achievements.ts`).
- **`TOURNAMENT_TABS` in `src/game/modes.ts`** (`cast`, `dex`, `lodge`) is the old WP-7 tab filter that `setTab` in the engine still consults; the real in-game menu for a tournament is `menuTabs` (`event`, `lodge`, `players`, `settings`). Harmless, but two lists say what a tournament shows.
- **Online co-op, Derby, Aquarium and Boss Rush are Expedition-only** (they live in Expedition's Lodge with shortcuts on mode select). Recreational and Story do not offer them.
- **No typed chat, no parent-approval flow, no service worker.** All three were left out on purpose (`01`, `06`, `09`).

## 4. Suspected code oddities found while auditing the docs (not changed here)

- The achievements count in the WP-16 pull request said about 47; the table has 50 rows. Docs now say 50 and the test is not pinned to a number.
- `lineDrain` in the difficulty table had a comment saying nothing read it yet; the engine has read it since WP-16. The comment was fixed.
- `src/game/modes.ts` still has the `sandbox` and `career` names in `legacyMode` (old links and saves). That is correct, just worth knowing when grepping for "sandbox".

## 5. Update Three (2026-11-07) — known limits

- **The five new waters have no painted artwork yet.** Their stage and hub views use the extended fallback gradients and waterlines (`stage-paint.ts`, `water.ts`); the fishing-spot positions for the new waters are placed by eye to the same spacing rules and should be re-placed when real paintings land in `public/art/biomes/`.
- **Night fishing settles at the summary level.** Away catches credit gold and XP directly and fill the book, but do not roll mutations, records, stickers, contracts or achievements (`src/game/night.ts` says so in its header). In Kid Mode a night catch lands in the main book, not the Kids book.
- **New-water balance is unplayed.** Prices run to 2.3 billion gold and fish values scale with the existing `2.1 ** biome` formula; the curve is inherited, not tuned.
- **The Lodge Events list has no Holidays section yet.** A live holiday shows its chip on the water (name + "50x luck, worth and XP") and its fish carry the holiday name; the list view is a later nicety.
- **Recreational's all-unlocked sandbox includes the final water without Prestige**, as it includes every water; the Prestige gate guards the career buy path (`travel` + `checkMap`).
- **Holiday mutation names are not recorded in the book.** The caught fish's display name carries the prefix ("jolly Perch"); the book entry keeps the species name, like event mutations' bookkeeping.
