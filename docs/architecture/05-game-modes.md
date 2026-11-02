# 05 · Game Modes

Work packages **WP-4** (mode framework + Recreational + Kid Mode), **WP-5** (Survival Fishing), **WP-6** (Rivals, pets, stickers, ambience — the "fun layer"). Tournaments are in `06`.

## 1. The mode framework (WP-4)

Today a mode is a save key and a few `if (currentMode === "sandbox")` branches. Replace that with a **rules table** so a new mode is data, not scattered conditionals.

```ts
// src/game/modes.ts
export type ModeId = "expedition" | "recreational" | "survival" | "coop" | "tournament";
export type ModeRules = {
  id: ModeId;
  title: string;            // "Expedition"
  blurb: string;            // one line for the menu card
  saveKey: string;          // localStorage key
  economy: boolean;         // money, selling, shops
  contracts: boolean;
  bosses: boolean;
  rebirth: boolean;
  aquarium: boolean;
  allUnlocked: boolean;     // waters + gear + lures
  assistAllowed: boolean;   // Helping Hand may be on
  fightSpeed: number;       // multiplier on fish pull (Recreational 0.75, Survival 1.15)
  biteSpeed: number;        // multiplier on wait time (Recreational 0.8)
  keepRelease: "both" | "keepOnly" | "releaseOnly" | "eat";
  dexShared: "own" | "career";   // Recreational writes to the career dex (it's still you fishing); Survival has its own
  hud: ("money" | "level" | "weather" | "window" | "hunger" | "warmth" | "day" | "timer")[];
};
export const MODES: Record<ModeId, ModeRules>;
export function rules(): ModeRules;    // current mode's rules
```

Migration: `career → expedition`, `sandbox → recreational` (same save key `fac-ultra-sandbox`, new title), `coop` unchanged. Replace every `currentMode === …` check in `engine.ts` with a `rules().x` lookup. Mode cards on the menu come from `MODES`.

> **As built (WP-4).** `src/game/modes.ts` holds the rules table (`MODES`, `MODE_KEYS`, `rulesOf`), the seven menu cards (`MENU_CARDS`) and the career-collection merge; `modeRules()` in `engine.ts` is the single lookup every mode branch reads. The union is `Mode = "expedition" | "recreational" | "coop"` (the spec's `ModeId` names); WP-5 and WP-7 add `survival` and `tournament` to the union and the table. Beyond the table in this section the rules also carry `trips`, `photo` and `twoPlayer`. Trips live in `src/game/trips.ts`, Kid Mode helpers in `src/game/kid.ts`. Save v7 adds `kid`, `trips` and `trip` (the trip in progress); `kid` is mirrored to `fac-ultra-device`.

## 2. Expedition (exists; renamed in copy only)
The career. Everything on. Unchanged by WP-4 apart from the rules refactor.

## 3. Recreational (WP-4; replaces "Sandbox — Zen Waters")

For the enthusiast who wants to *fish*, not grind, and for a parent and kid sharing a screen.

- `economy:false, contracts:false, bosses:true` (bosses still fishable once their dex gate is met in **career** — Recreational reads the career dex for gates but never changes career money), `allUnlocked:true`, `fightSpeed 0.75`, `biteSpeed 0.8`, `keepRelease:"both"` but Keep goes to a **creel** (today's inventory, no selling; empties when you leave the water, with a "Creel today: 7 fish, 22.4 lb" summary).
- **Trip log**: each session is a *trip*. Start → choose water, time of day (real clock or pick dawn/day/dusk/night), weather (real or pick). End → a trip card: fish, biggest, species new to you, records. Trips save to `trips: Trip[]` (last 50) and the Lodge gets a **Logbook** view listing them. This is the recreational loop: "went to the River at dawn in the rain, caught 9, two browns over 3 lb."
- **Photo mode**: `H` hides chrome (WP-1); here add `P` → renders the current canvas frame + a caption strip (water, species if a fish is up, date) to a PNG and downloads it. Kid feature and enthusiast feature at once.
- Dex writes go to the **career dex** (`dexShared:"career"`) so recreational fishing still fills the collection. Records too.

## 4. Kid Mode (WP-4) — a lens, not a mode

Kid Mode is a **settings profile** applied on top of any mode where `assistAllowed`:

| Setting | Kid Mode value |
|---|---|
| `assist` (Helping Hand) | on, and the glow/hint always shows |
| Text size | +1 step (Tailwind `text-base` → `text-lg` via a root `data-kid` attribute) |
| Confirmations | selling a rare+ fish and rebirth ask "Are you sure?" |
| Hints | spot hints after 5 s instead of 8; coaching lines never stop |
| Reading | every long message gets a 🔊 button: `speechSynthesis.speak()` with the system voice, rate 0.95 |
| Numbers | money shown as `$1.2K` already; add the word form in tooltips |

Toggle: Settings → "Kid Mode", also offered on first launch ("Who's fishing today? Kid / Grown-up / Both"). Tournaments ignore it (fairness), and say so.

## 5. Survival Fishing (WP-5) — a new mode with its own save

You're dropped on a water with a hand line and nothing else. Fish to eat, eat to keep fishing, stay warm, make it through as many days as you can. **Own dex, own save, own leaderboard category (longest run) in `06`.**

### 5.1 Loop
```
Day (6 game-minutes = 1 game-hour; a day is 18 h awake, 6 h camp)
  ├─ fish (any spot; time advances as you fish — each cast costs 10–25 game-minutes)
  ├─ eat (cook at camp or eat raw at a hunger-risk; fish → calories by weight)
  ├─ craft (bone hooks, gut line, a smoker, a shelter — from fish parts + driftwood gathered at camp)
  └─ camp (nightfall → sleep; hunger & warmth tick; the day counter advances)
Run ends when hunger or warmth hits 0. Score = days survived, with fish count and biggest fish as tiebreakers.
```

### 5.2 Meters (saved per run)
```ts
type SurvivalRun = {
  day: number; hour: number;      // 6..24 awake
  hunger: number; warmth: number; // 0–100
  camp: { shelter: 0|1|2; fire: boolean; smoker: boolean; driftwood: number; bone: number; gut: number };
  gear: { hook: 0|1|2; line: 0|1|2 };     // hand line → bone hook → carved hook; gut → braided gut → sinew
  larder: { name: string; cal: number; smoked: boolean; expiresDay: number }[];
  water: number;                  // biome; Survival is available on Pond, River, Lake, Swamp, Coast, Arctic, Mangrove, Kelp (8 waters)
  seed: number;                   // the run's seed; every roll derives from it (fair daily challenge)
  log: string[];                  // last 40 events, shown in the camp screen
};
```
- Hunger drops 4/h awake, 1.5/h asleep; warmth drops by weather × shelter: Sunny 0, Rain 2/h, Storm 4/h, Fog 1/h, Night +2/h; Arctic ×2.5; fire −3/h while lit (burns 1 driftwood/h); shelter tiers cut loss 40 % / 75 %.
- Eating: raw `cal = 60 × weight(lb)`, 15 % chance of "bad fish" (hunger −10, next 2 h fishing slower); cooked (fire) `cal = 90 × weight`, no risk; smoked keeps 4 days (`expiresDay`), raw 1 day.
- Gear: hand line (hook 0, line 0) — `zone` tight, `hold` low, **cannot land epic+** (they snap it; message says so). Bone hook (3 bone) = `zone +4`; carved hook (6 bone, 2 driftwood) = `zone +8`, epics possible. Braided gut (4 gut) = `hold ×1.6`; sinew (8 gut, needs smoker) = `hold ×2.4`. Fish yield: bone `1 + rarity`, gut `1` per fish kept.
- Driftwood: 2–5 gathered each dawn at camp; storms wash up double.
- Time: a cast costs `12 + waitLeft·4` game-minutes; a fight costs its real seconds × 3 as game-minutes. At hour 24 the game forces camp.
- **Daily challenge**: the run seed defaults to `seedFrom("survival", YYYY-MM-DD, water)` so everyone who plays today's Pond gets the same fish, same weather sequence. "Free run" uses a random seed and does not post to the board.

### 5.3 UI
- HUD: `hunger`, `warmth`, `day`, time-of-day instead of money/level. Both meters are icons with a radial fill (no numbers unless Kid Mode is off and hover).
- Camp screen (a drawer): eat / craft / sleep, the larder, the log. Night-time paintings use the WP-1 night tint plus a campfire glow (additive radial gradient, bottom-left) when fire is lit.
- Death screen: days survived, fish eaten, biggest, a one-line cause ("The cold got you on day 6 — a storm, no fire."), **Try again (same day)** and **New run**.

### 5.4 Weather in Survival
Weather is rolled from the run seed per game-hour with persistence (70 % chance it stays), and announced the evening before with 70 % accuracy ("The sky says rain tomorrow" — sometimes wrong). Enthusiasts plan; kids learn to gather wood before a storm.

### 5.5 Tests
`survival.test.ts`: a scripted competent player (fish dawn/dusk at the best-matching spot, cook everything, build shelter by day 2, smoker by day 4) survives ≥ 12 days on Pond with the 2026-01-01 seed; a do-nothing player dies on day 2; eating only raw fish yields at least one bad-fish event in 20 fish on average.

## 6. The fun layer (WP-6)

All modes except Tournament. Small systems that give kids reasons to come back and enthusiasts things to collect.

### 6.1 Rivals with faces
Replace Derby's random-walk numbers (`engine.ts` derby tick) with **12 named anglers** in `src/game/rivals.ts`: name, a 3-line personality, an emoji portrait, a skill curve (0.4–0.95), favourite water, a catchphrase for winning/losing. Their scores accumulate from *simulated casts using the real fishing model* (seeded), so they're beatable by fishing well, not by luck. They appear in the Lodge as a "Regulars" board with lifetime head-to-head records. Tournaments (`06`) use them to fill empty slots.

### 6.2 Pet companion
Unlocked at level 5: choose an otter, a heron or a dog. The pet sits on the dock/boat (drawn in `paint()` as a 3-frame sprite from `fish-draw`-style procedural shapes), reacts to catches (otter claps, heron tilts, dog wags), and once per real hour "brings you something": a random lure of a family that matches the current spot's best uncaught fish (teaching the match system). Pets are cosmetic + one hint; no power.

### 6.3 Sticker dex
The dex becomes **pages per water**: a 5×5 grid, each cell the species' silhouette in grey until caught, then the full painted portrait with a sticker-peel animation on first fill (300 ms, CSS). Mutations add a foil edge (`conic-gradient` border). Completing a page drops a **page sticker** (the boss art) and plays `audio.fanfare()`. A **Shiny** variant: a 2 % roll on any catch (not a mutation; cosmetic sparkle on the portrait and a star on the cell) so a finished page still has a chase.

### 6.4 Daily cast
One free "Fish of the Day" per real day: a species chosen by `seedFrom("fotd", date)` from your unlocked waters; catching it today gives double XP and a sticker-frame cosmetic. Shows on the menu card and the HUD bar.

### 6.5 Ambience
First audio *files*: one 30-second ambient loop per biome group (pond/river, lake/swamp/mangrove, coast/reef/kelp, arctic/deep/sunken, volcano/sky/astral) — 5 OGG files ≤ 250 KB each, generated with the WebAudio synth offline or sourced CC0, placed in `public/audio/`. Loop with a 2 s crossfade on travel. Weather adds rain/wind from the existing synth. Volume slider in Settings; default 35 %. Muted until first interaction (browser policy).

### 6.6 Colour-blind rarity
Rarity colours gain a **shape**: common dot, uncommon diamond, rare star, epic hexagon, legendary crown, used wherever a rarity colour appears (badge, dex cell corner, celebration). Add a Settings toggle for a deuteranopia-safe palette (`r1 #2a9d8f, r2 #4a7bd0, r3 #d08a2e, r4 #e8c547`).

## 7. Menu card order (after WP-5)
Expedition · Recreational · Survival · Tournaments · Co-op (local + online) · The Aquarium · Boss Rush. Derby is folded into Tournaments.

## 8. Done when
- **WP-4**: `modes.ts` rules table drives every mode branch; Recreational with creel, trip log, Logbook view, photo mode; Kid Mode profile with every row in §4; menu cards from `MODES`; migration from `sandbox` keeps old sandbox saves; tests for `rules()` and trip summaries.
- **WP-5**: Survival on 8 waters with meters, camp, crafting, larder, seeded weather forecast, daily seed vs free run, death screen; `survival.test.ts` thresholds; phone layout works.
- **WP-6**: 12 rivals replacing derby numbers; pet with hourly gift; sticker dex pages with peel/foil/shiny; Fish of the Day; 5 ambient loops with crossfade and volume; rarity shapes + CB palette; all gated by `motion`/`sound` settings.

## 9. As built: WP-5 Survival

- Rules live in `src/game/survival.ts` (pure, seeded, no Math.random). The store hooks are small and additive in `engine.ts`.
- Own save slot `fac-ultra-survival` with its own dex and run history. Career `SAVE_VERSION` is unchanged. Survival save has its own `sanitizeSurvival` / `migrateSurvival` (fixture: `src/game/__fixtures__/survival-v1.json`).
- Waters: Pond, Creek, Lake, River, Reservoir, Arctic, Bayou, Delta (ids 0,1,2,3,5,9,4,8). Rescue arrives on day 15.
- Tests: `survival.test.ts` (thresholds: competent player lasts 12+ days on Pond with the 2026-01-01 seed, do-nothing dies on day 2, raw-only eating gives 1+ bad fish per 20) and `survival-flow.test.ts` (real store, slot separation, reload).

## 10. As built: WP-6 fun layer

Rules are pure and seeded in `src/game/` (`rivals.ts`, `pet.ts`, `stickers.ts`, `fotd.ts`, `rarity.ts`, `ambience.ts`, `fun.ts`); the screens are `components/game/fun.tsx` (+ `fun-hooks.ts`, `rarity-mark.tsx`, `pet-fx.ts`) and the sticker-book `DexPanel`. Career `SAVE_VERSION` is **8**.

- **Where it runs.** Expedition, Recreational and local co-op (`funModeOn()` in `fun.ts`). **Tournaments** are scored on the server from a seed, so the whole layer is off there (no shiny, Fish of the Day, pet, stickers; ambience is muted). **Survival** keeps its own slot and shape, so the layer is off there too, except ambience (camp and water sounds are welcome).
- **Replay safety.** Rival casts run on their own `makeRng(seedFrom("rival", id, derbySeed, k))` and put the live `rng()` back afterwards. Shiny rolls use `loose()`. Neither ever draws from the stream a tournament replays (tests assert the live stream is untouched).
- **Rivals (§6.1).** Twelve Regulars (Tilly 0.40 up to Pike Queen 0.95). A Derby holds the seed, the water, your luck, stage, sky and window when it began; each rival makes one simulated cast every 14 to 26 s (skill decides), with a skill-based miss chance, a few tries at picking spot, lure family, depth and pace (they keep the best match), then `rollFish` with the real match vector. A rival's favourite water makes them three times as likely to be picked. Derby results are filed in `rivalRecord`. A v7 Derby (names and scores only) is converted on load and keeps its scores. Tournaments will use `rivalCast` to fill empty Quick boards in WP-8.
- **Pet (§6.2).** Opens at level 5. Gift: five lures of a family a not-yet-caught fish at your last spot likes (only families that exist as lures), at most one per real hour, first one ready on adoption. Cosmetic: otter claps, heron tilts, dog wags (3-frame canvas sprite).
- **Sticker dex (§6.3).** One page per water: 5 by 5 cells, silhouette until caught, 300 ms peel on first fill, foil edge for mutations, star on shiny cells, page sticker on completing all 25 (boss included) with the fanfare. Shiny: 2 % of any caught fish, listed once per species.
- **Fish of the Day (§6.4).** `seedFrom("fotd", date)` over your open waters, species slots 0 to 15 only (always rollable). First catch of the day: double XP and a gold frame sticker. Shown on the menu, the water chips and the Cast tab. Claims are shared by Expedition and Recreational, so the day is claimed once.
- **Ambience (§6.5).** Five 30-second OGG loops in `public/audio/` (about 770 KB in all, none over 250 KB), built by `node scripts/ambience-build.mjs` (synthesized offline, reproducible). Fetched lazily after the first tap, only the loop for the water you are in, 2 s crossfade on travel. Rain and wind come from the WebAudio synth. Volume slider in Settings (default 35 %), Sound off mutes everything, Kid Mode speech ducks it. The spec lists no canyon group; canyon plays the fire/sky loop.
- **Colour-blind rarity (§6.6).** `RarityMark` shows dot, diamond, star, hexagon, crown beside every rarity colour (celebration, last catch, bag, dex cells). Settings toggle swaps r1 to r4 for the deuteranopia-safe palette.
- **Save v8.** `pet`, `stickers`, `shiny`, `fotdClaimed`, `rivalRecord`, plus the device settings `volume` and `cb` (mirrored to `fac-ultra-device`). Fixture `save-v7.json` is a real v7 session with a Derby running.
