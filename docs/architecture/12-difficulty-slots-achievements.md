# 12. Difficulty, Story, hazards, fish books, save slots, achievements, trophy room (WP-16)

> **As built (WP-16, merged; checked against `difficulty.ts`, `hazards.ts`, `slots.ts`, `story.ts` and `achievements.ts` after merge).** The numbers in sections 2 and 3 match the tables in code. Corrections to the first draft of this file: there are **50** achievements (not about 45); the hazard state in the save is `hz`; sections 6 to 10 describe the shipped slot, achievement and menu behaviour. Unplayed at length: hazard feel, Story pacing, cloud slot sync on a real database (`../KNOWN-GAPS.md`). Save fixture `save-v12.json`.

Source: Caleb's feedback 2 (fish books, difficulty, Story, hardest-mode dangers, keep/release, slots, achievements, PB room). Every number lives in one data table in `src/game/`; the table name is given in each section. All the rules are pure modules with unit tests; `engine.ts` only calls them.

## 1. Fish books

Two books per save: the main book (`dex`, `records`) and the **Kids book** (`sideDex`). `bookFor(mode, difficulty, kidLens)` in `difficulty.ts` decides where a catch is written.

| Situation | Book |
|---|---|
| Kid Mode on (any career/Relaxed/Co-op mode) | Kids book |
| Super Easy (Expedition) | Kids book |
| Recreational with Kid Mode off | Recreational's own book (it already has a separate save, WP-11) |
| Survival | its own run book (unchanged) |
| Tournament | no book |
| Everything else | main book |

Decision: the Kid lens routes catches to the Kids book in any mode, so a child never fills a grown-up's book and a parent's book never fills by accident. Records (heaviest fish) and PB plaques use the main book only. Collections (main menu) and the Lodge both show the Kids book, read-only.

## 2. Difficulty (`DIFFICULTY_TABLE`, `difficulty.ts`)

Chosen on Expedition when a slot is made and **fixed for that slot** (changing it mid-save would allow farming easy then switching). Story is always Easy. Every other mode plays at Normal whatever a save says, so Tournament replays and Recreational never move.

| Level | Fight | Bite wait | Worth | XP | Line drain* | Helping Hand | Green zone | In book | Hazards |
|---|---|---|---|---|---|---|---|---|---|
| Super Easy | 0.85 | 0.85 | 1 | 1 | 0.5 | always on | +3 | no (Kids book) | none |
| Easy | 0.93 | 0.93 | 1 | 1 | 0.75 | your setting | +1 | yes | none |
| Normal | 1 | 1 | 1 | 1 | 1 | your setting | 0 | yes | none |
| Hard | 1.10 | 1.08 | 1 | 1.05 | 1.25 | your setting | 0 | yes | taste |
| Legend | 1.20 | 1.15 | 0.75 | 1.15 | 1.50 | off | 0 | yes | full |

*Line drain multiplies WP-14's line wear (`wearMulFor` in `lines.ts`, via the engine); the Legend lure and rod losses also fire when a line wears out.

## 3. Legend hazards (`HAZARD_TABLE`, `hazards.ts`)

Each hazard is tuned alone. "Taste" is the Hard level (only lure loss, at a lower chance); "full" is Legend.

| Hazard | Trigger | Full | Taste |
|---|---|---|---|
| Lure lost | line snaps in a fight | 25% (3 lures of the pack; a signature lure goes first) | 8% |
| Rod lost | snap against rarity 3+ or a boss | 6% (first rod is never lost) | 0 |
| Boat sinks | cast in a storm with a boat too weak for the water | 12% (first boat never sinks; salvage costs 35% of its price) | 0 |
| Wallet drop | start of a cast, money 200+ | 1.5% chance, lose 12% of money (rounded down) | 0 |
| Fish jumps out | tank check every 5 min | 25%; put it back within 30 s or it is lost and cannot come back for 30 min | 0 |
| Lawsuit | tank check every 5 min while the tank does not meet expectations; 8 min grace to fix it; 20 min cooldown | 35%; takes half the money (money 500+), the **larger half to the plaintiff when odd** | 0 |

Rules: hazards run only in Expedition, only with the Kid lens off, so they are off in Tournament, Recreational, Kid Mode, Survival, Co-op and Story. They are deterministic and seeded on their **own** stream, `makeRng(seedFrom("hazard", seed, n))`, where `seed` is fixed when the slot is made and the draw counter `n` is saved. The fishing `rng()` and the tournament replay are never touched. Alerts appear in a notice strip (`hazard-alerts.tsx`) with a Put back button for a jumper.

## 4. Story mode (`story.ts`)

Its own slot type (`story`, key `fac-ultra-story[-sN]`), a row in `MODES`, a card in mode select (after Expedition), a tab list that includes the Lodge (Story room with the tracker). 15 chapters, one per water, each with: a title, an intro line, an outro line, 3 to 4 objectives (catch N fish there, find N kinds, catch a rare, beat the boss) and a reward (coins that grow with the chapter, the next water opening, Boss Chum for the next boss, and a 10-lure pack on every third chapter). Progress is **derived from the Story save's own book**, so there are no counters to drift and an old save can never be stuck. Finishing a chapter's objectives opens the next chapter and pays its reward once. Story is fixed to Easy, no hazards.

## 5. Keep or release

The player has infinite time. While a caught fish is waiting for a choice, casting is blocked and the notice `PENDING_FISH` ("You haven't chosen what to do with this fish yet.") shows. It works with Helping Hand, Kid Mode, every auto-keep setting (auto-keep is off while a choice is pending; Survival and Tournament keep their auto-keep rules), the phone layout and the keyboard shortcuts (any cast key shows the notice instead of casting).

## 6. Save slots (`slots.ts`)

`MAX_SLOTS = 3`, one constant; there is no upsell UI. Only Expedition and Story have slots; Recreational, Survival, Co-op and Tournament have 1.

- Local key: slot 0 is the old key (`fac-ultra`), slots 1 and 2 are `fac-ultra-s1`, `-s2` (and `fac-ultra-story-s1`...). Old saves stay as slot 0, so no migration is needed.
- Cloud: the saves table `mode` column is a sync id (`expedition`, `expedition-s1`, `story-s2`). No database migration. The server's sanitize runs on every slot id (`modeOfSyncId`) and the upload accepts `op:"delete"` so deleting a slot removes only that cloud row. Each slot syncs on its own, so a copy on another device only ever touches the same slot (copy-safe).
- Picker (`slots.tsx`): three cards (name, level, difficulty, fish found), Continue/Open, New (opens the difficulty picker), Rename, Delete (asks to confirm and shows the slot name). The last open slot per mode is remembered in `fac-ultra-slots`; Continue on the title screen goes straight to it.
- Names: up to 20 characters, run through `safeName`; empty gives "Adventure N" / "Story N".

## 7. Achievements (`achievements.ts`)

50 data rows in `ACHIEVEMENTS` (id, name, plain-English hint, a test over `AchStats`; seven categories: fishing, collection, gear, money, bosses, events, modes). `checkAchievements` runs after catches, sales, level ups and other events, shows a toast once per unlock, and stores `ach: { got, counters }` in the save. The Lodge Achievements room shows a grid; hover (PC) or tap (phone) opens the detail. `registerAchievements(rows)` and the `fac:achievement` window event are the generic hook for WP-15 (events and mutations) to add rows. Not tracked in Survival.

## 8. PB trophy room (`pbroom.ts`)

One plaque per species from the WP-3 records (heaviest weight; length is estimated from weight, labelled "about"). Sorted by water. A Wall of Fame shows the top few. Read-only.

## 9. Menus (WP-12 integration)

Mode select has six cards (Story is the second: `MODE_SELECT_IDS`). Expedition and Story open the slot picker first. The Lodge tab holds the Trophy room, Achievements, the Kids book and (Story only) the Story room. Collections reads every used slot and the Kids book inside it (`collectionEntries` in `peek.ts`).

## 10. Save fields (SAVE_VERSION 12)

New: `slotName`, `created`, `difficulty`, `sideDex`, `story`, `ach`, `hz` (hazards) and `autoKeep` (plus the other additive fields listed in `engine.ts` `Save`). Migration from v11 fills all with defaults. Fixture `__fixtures__/save-v12.json` (the v10 and v11 fixtures also migrate). Test-phase reset wipes every slot key and the new `fac-ultra-slots`, since it wipes by prefix (test in `slots.test.ts`).

## 11. Tests

`difficulty.test.ts`, `hazards.test.ts`, `story.test.ts`, `achievements.test.ts`, `slots.test.ts`, `pbroom.test.ts`, `wp16-flow.test.ts` (engine flows: keep/release block, books, worth, Legend snap, slots, story, hazards off outside Expedition), `menu-levels.test.ts` (Story card, Collections rows), plus the v12 fixture, v10 migration and hostile-data tests in `save-migration.test.ts`.

## 12. Merge notes

WP-15 took save v10 (`events`) and WP-14 v11 (`lineGear`), so WP-16 is v12. Achievements listen to WP-15 through `event-hooks.ts` (`onMutatedCatch`, `onEventStarted`).
