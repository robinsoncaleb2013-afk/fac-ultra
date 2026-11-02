# 10 · Gear progression rules, line health and crafting (WP-14)

Built from the owner's feedback (Caleb, 2026-11-02). Two parts: **line health, wear and crafting** (section 1) and **gear progression rules** (section 2). Code: `src/game/line-wear.ts`, `lines.ts`, `gear-rules.ts`; hooks in `fight.ts`, `replay.ts`, `engine.ts`; UI in the Tackle tab (`hub/TackleTab.tsx`) and the Waters tab. Every number below lives in one commented table in those files.

## 1. Line health, wear and crafting

### 1.1 Wear in a fight
A hooked fish wears the line down at a fixed tick: **1 second = 20 fight steps** (`WEAR.tickSteps`). The tick counts whole steps, so a replay is exact. Each tick takes a percent of a 100-point pool (`WEAR.pointsPer100`):

| Fish | Percent per tick |
|---|---|
| Common | 1 |
| Uncommon | 2 |
| Rare | 3 (Caleb did not say; the middle of 2 and 5) |
| Epic | 5 |
| Legendary | 10 |
| Bosses, and anything above legendary | 15 |

A line has **health in points** (`LINE_HEALTH`, 12 tiers, 100 for Mono 6lb up to 820 for Starweave Eternal). A better line has more health, so it lasts longer against the same fish. Health at 0 means the line wears out: the fight ends as a snap (`Fight.worn = true`), the fish escapes, and the pill says "The line wore out."

### 1.2 How reeling interacts
The tick takes less when you fish well (`wearFactor`):
- Holding the reel with the needle in the green: **half** the wear (`reelingInGreen` 0.5). Skill beats the clock.
- A tired fish (stamina under 0.25): **0.6** of the wear.
- A fish in the air (jump) or a statue-still Marble Emperor: **no** wear.
- Not reeling, or reeling in the red: full wear.

So sitting and doing nothing cannot last for hours: the line runs out, and a fish that is not tired keeps wearing it. The HUD "Line N%" shows the lower of the strain left and the health left.

### 1.3 Lines are not sold
The shop no longer sells lines (`buyGear("line")` does nothing). Lines come from **packs** and are **crafted** from duplicates of the same line.

### 1.4 Packs and crafting
Four pack kinds, three lines each (`LINE_PACKS`): Bronze (tiers 0 to 2), Silver (0 to 4), Gold (2 to 6), Platinum (4 to 9). Tiers 10 and 11 never drop: craft only. Packs come from (Expedition and Co-op only): every level-up (Bronze; every 5th level Silver, 10th Gold, 25th Platinum), the first time a boss falls (Gold), claiming a contract (Silver), and lucky catches (2% common up to 10% legendary; the pack grows with rarity). Open them in **Tackle, Line packs**.

**Recipe** (`RECIPE_DUPES`): 3, 3, 3, 4, 4, 5, 5, 6, 6, 8, 10 copies of tier t make one tier t+1. **Cap** (`CRAFT_GATE`): to craft a tier you need its player level AND that many different bosses beaten; the hard max is the top tier (level 85, 14 bosses). Tier 0 is the worn hand line: you can always fall back on it.

The **Line workshop** (Tackle tab) lists every tier. The detail panel shows health, how many seconds it lasts against a common and a legendary fish, the recipe, copies owned, and the level and boss gate, with buttons to use it or craft it.

### 1.5 Modes
| Mode | Line rules |
|---|---|
| Expedition, Co-op | Full rules. |
| Recreational | The line never wears out (`recreationalMul` 0). All lines owned. |
| Kid Mode | Wear x0.25 (`kidMul`). Helping Hand takes up to half off more, scaled by its strength. |
| Survival | Same rules on its hand line (health of tier 0 times the camp gear bonus). No packs. |
| Tournament | The fixed event line (tier 4, 250 health), rules version 2. No packs. |
| Hardest difficulty (WP-16) | Hook: `difficulty.wear` in `lines.ts` multiplies wear (default 1). `setLossHooks({ loseLure, loseRod })` is called when a line wears out; nothing is lost in WP-14. |

### 1.6 Rules versions (tournaments)
Wear changes how a replayed cast ends, so fight/line rules are versioned (`RULES_VERSION` in `line-wear.ts`): **1** is the original fight, **2** adds wear. New events store `rules.rulesVersion` (2). An event row with none means version 1. The server replays every cast with its event's version; the client stamps `rv` on the envelope when the version is above 1, and the server refuses a cast whose stamp is not the event's version (`rules_version`). Tests prove an old-version cast still verifies and a new one verifies. The daily Survival board stays on version 1. To change the fight again: bump `RULES_VERSION` and add the case.

### 1.7 Saves
`SAVE_VERSION` 10 adds `lineGear { lines[12], packs[4], last[] }`. `line` is the tier in use. An old save owned every line up to `line`: it gets one copy of each. Rebirth keeps your lines.

## 2. Gear progression rules

Client rules in `gear-rules.ts`; one table, pure functions, used by the engine (as a refusal with a plain toast) and the UI (greyed items with the missing requirement as one sentence, on the hover detail and the phone tap-to-detail).

- **No skipping.** To buy a rod, reel or boat you must own the one before it. Lines use crafting instead.
- **Level gates.** Every rod, reel, boat, lure pack and map needs a level. Lure packs: Basic 1, Pro 10, Elite 30.
- **Maps.** A water needs its level (`MAP_LEVEL`: 1, 3, 6, 9, 12, 15, 19, 23, 27, 31, 36, 42, 49, 57, 66) AND the boss of the water before it beaten.
- **Bundles.** Each water brings rods (`ROD_BUNDLE`) and reels (`REEL_BUNDLE`). An item in a bundle needs that water unlocked, and the water's level plus one per later item in the bundle.
- **Boats.** No map. They need a level, the boat before, and a number of different bosses beaten (`BOAT_GATE`: 0, 1, 2, 3, 5, 7, 9, 11, 13).
- **Existing saves.** Anything already owned stays owned, even out of order. The rules judge only what you buy next.
- **Off in** Recreational (everything unlocked), Kid Mode, Survival (own gear, no shop) and Tournament (fixed loadouts).

Sentences look like "Reach level 12, unlock the Coast map and buy the Tracker Combo first." and "Reach level 3 and beat the Pond boss."

## 3. Tests
`lines.test.ts` (wear, determinism, crafting, packs, saves), `gear-rules.test.ts` (each rule, a full progression walk, no skipping), `replay-versions.test.ts` and `api.test.ts` (rules versions end to end), `save-migration.test.ts` (v10 fixture).
