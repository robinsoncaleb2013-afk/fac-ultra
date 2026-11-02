# 04 · The Fishing Model

Work packages **WP-2** (spots, presentations, species habits, seeded RNG) and **WP-3** (the fight v2, keep/release, records). This is what makes an enthusiast nod. It layers on top of today's `rollFish` and `withCatch`; it does not replace the content tables.

## 0. Design in one paragraph

Every water has a handful of **spots** you can cast to. Every species has **habits**: where it holds, when it feeds, what presentation it wants, how it fights. The player chooses a spot and a **presentation** (what's on the line, how deep, how fast). The game turns *how well that choice matches the fish that are there right now* into a **match score**, and the match score drives bite time, which species bite, and how big they are. Then the fight is a **tension game**: hold to reel, ease off when the fish runs, keep the line in the green. Knowledge and feel win; luck still seasons it.

## 1. Seeded RNG (WP-2, first)

File: `src/game/rng.ts`.

```ts
export type Rng = () => number;                       // [0,1)
export function makeRng(seed: number): Rng;           // mulberry32 — 10 lines, no deps
export function seedFrom(...parts: (string | number)[]): number;  // FNV-1a over the joined string
export let rng: Rng;                                   // the active stream
export function setRng(r: Rng): void;
export function pick<T>(arr: T[], r: Rng = rng): T;
export function weighted(weights: number[], r: Rng = rng): number;  // replaces pickWeighted
export function range(min: number, max: number, r: Rng = rng): number;
```

- Default stream: `makeRng(Date.now() ^ (Math.random()*2**32))` at module load — casual play stays unpredictable.
- Tournament/Survival sessions call `setRng(makeRng(seedFrom(eventId, playerId, castIndex)))` per cast (see `06`). Inside `src/game/**`, **`Math.random()` is banned** (add an ESLint `no-restricted-properties` rule scoped to that folder in WP-2). Visual-only randomness (particles) may use `Math.random()` in `stage.tsx` only.

## 2. Spots (WP-2)

### 2.1 Data
`src/game/spots.ts`:

```ts
export type Structure = "weeds" | "dock" | "dropoff" | "rocks" | "current" | "open" | "shade" | "timber" | "reef" | "wreck" | "ice" | "vent" | "cloud" | "void";
export type Spot = {
  id: string;            // "pond-pads"
  name: string;          // "The Lily Pads"
  x: number; y: number;  // normalised cast target on the painting (0–1), must lie below WATER_LINE[b]
  r: number;             // tap radius, normalised to width (0.06–0.10)
  structure: Structure;
  depth: 0 | 1 | 2;      // shallow / mid / deep
  tip: string;           // one line for the dex & hover: "Bass and bluegill hold in the shade here after noon."
};
export const SPOTS: Spot[][] = [ /* 15 biomes × 4–6 spots */ ];
```

Author all 15 waters (≈ 75 spots). Each biome has at least one of each depth and at least 3 structures. Place `x,y` by opening the painting at 1600 px and reading coordinates — the dock in Pond is at about `(0.80, 0.70)`, the lily pads `(0.52, 0.76)`, open water `(0.30, 0.66)`. Astral/Sky/Void waters use the fantasy structures (`cloud`, `void`, `vent`).

### 2.2 Choosing a spot
- Desktop: hovering the water highlights the nearest spot within `r` (soft ring + name label); clicking casts **to it**. Clicking open water with no spot in range casts to the **default spot** (first with `structure:"open"`).
- Phone: a "Spot" chip row above the cast button (tap to pick); tapping the painting still casts to the current spot.
- The bobber lands at the spot: `sim.bnx/bny = spot.x/y` (replaces the fixed `0.46/0.73`), with a 0.5 s arc animation from the rod tip and a splash burst. `sim.spot` holds the id. Saved: `lastSpot: Record<number, string>` (biome → spot id) so you come back to where you were.

## 3. Presentations (WP-2)

### 3.1 Data
`src/game/presentation.ts`:

```ts
export type LureFamily = "worm" | "insect" | "minnow" | "crank" | "spoon" | "jig" | "fly" | "topwater" | "cut" | "dough" | "squid" | "glow";
export type Retrieve = "still" | "slow" | "medium" | "fast";
export type Presentation = { family: LureFamily; depth: 0 | 1 | 2; retrieve: Retrieve };
```

- Every existing lure (`LURES`, 50 procedural) and bait (`BAITS`) gets a `family` field. Procedural lures: assign by `i % 12`. Signature lures keep their effects **and** get a family. Baits: Dough Ball → `dough`, Glow Worm → `glow`, Chum Bucket → `cut`, Boss Chum → `cut`.
- Depth and retrieve are player choices, saved per biome alongside `lastSpot`: `rig: Record<number, {depth, retrieve}>`.
- UI: the **Rig** control — on desktop a small cluster at the bottom-left of the water: three depth pips and four retrieve pips; on phone two chip rows in the Cast panel. Changing the rig while `idle` is free; during a cast it's locked.

### 3.2 Species habits
`src/game/habits.ts`:

```ts
export type Habit = {
  structures: Structure[];      // where it holds (1–3)
  depth: 0 | 1 | 2;             // preferred depth
  feeds: ("dawn" | "day" | "dusk" | "night")[];   // active windows (see §3.4)
  likes: LureFamily[];          // 2–3 presentations it hits
  retrieve: Retrieve[];         // 1–2 retrieves it wants
  weather: number[];            // weather ids (0–4) it bites better in; [] = indifferent
  fight: "runner" | "diver" | "jumper" | "bulldog" | "thrasher";   // see §5
  stamina: number;              // 0.6–1.8; scales the fight length
};
export function habitOf(b: number, i: number): Habit;
```

Author habits **by rule, then hand-tune the named fish an angler knows.** The rule, so 375 entries don't need hand-writing:

- Archetype → fight: `fish` runner/jumper, `eel` thrasher, `round` bulldog, `ray` diver, `shark` runner, `whale` bulldog, `turtle` bulldog, `squid` diver, `seahorse` thrasher, `angler` diver, `crab` bulldog, `jelly` thrasher.
- Rarity → stamina: common 0.7, uncommon 0.9, rare 1.1, epic 1.4, boss 1.8.
- Species index `i` → depth `i % 3`, structures = two picked by `(i*7) % structures.length` from the biome's spot structures, feeds by `i % 4` plus `day` for commons, likes = two families by `(i*5) % 12`, retrieve by `i % 4`.
- **Then override** at least these with real-world truth (a table at the bottom of `habits.ts`, keyed by name): Bluegill, Largemouth, Smallmouth, Crappie, Walleye, Catfish, Rainbow/Brown/Brook Trout, Steelhead, Salmon, Pike, Muskie, Lake Trout, Striper, Tarpon, Snook, Redfish, Flounder, Mahi Mahi, Tuna, Marlin, Halibut, Cod, Mackerel. (Example: Largemouth — structures `weeds, dock, timber`, depth 1, feeds `dawn, dusk`, likes `worm, crank, topwater`, retrieve `slow, medium`, weather `[1, 2]` (rain/storm front), fight `jumper`, stamina 1.1.) Write these in the dex as sentences: "Likes: plastic worms and topwater at dawn and dusk, around weeds and docks."

### 3.3 Match score
Pure function, `src/game/match.ts`:

```ts
export function matchScore(h: Habit, spot: Spot, p: Presentation, weather: number, window: Window): number {
  let s = 0;
  if (h.structures.includes(spot.structure)) s += 2;
  if (h.depth === p.depth) s += 2; else if (Math.abs(h.depth - p.depth) === 1) s += 0.5;
  if (h.likes.includes(p.family)) s += 2;
  if (h.retrieve.includes(p.retrieve)) s += 1;
  if (h.feeds.includes(window)) s += 1.5;
  if (h.weather.includes(weather)) s += 1;
  return s;                       // 0 … 9.5
}
```

### 3.4 Time windows
`window(hour)`: 05–08 `dawn`, 08–17 `day`, 17–20 `dusk`, else `night`. Weather `night` (id 4) forces `night`. Shown in the HUD chip row ("Dusk").

### 3.5 Wiring into the cast
In `startCast()` (engine):
1. Resolve `spot`, `presentation`, `window`, `weather`.
2. Compute, for every species `n` in the biome, `ms[n] = matchScore(habitOf(b,n), spot, p, weather, window)`.
3. **Bite time**: `avgMs = mean of ms weighted by today's rollFish weights`; `waitLeft *= clamp(1.35 - avgMs * 0.09, 0.45, 1.35)`. A great rig at the right spot bites in a third of the time.
4. **Which fish**: pass `ms` into `rollFish` as `opts.match`; inside, `w *= 1 + ms[n] * 0.55` (so a 9-point match is ~6× more likely than a 0-point one; rarity base weights still dominate for commons vs. epics).
5. **Size**: `opts.sizeBias = clamp((ms[i] - 3) * 0.06, -0.1, 0.35)` → weight roll becomes `(0.5 + sizeBias) + rng()*1.1`. Fishing a spot well produces bigger fish; that's the record-hunting loop.
6. Store `sim.cast = { spotId, p, window, weather, ms: number[] }` for the fight and the post-catch message ("That one wanted a slower retrieve" when the caught fish's retrieve ≠ p.retrieve).

### 3.6 What the player sees
- Hovering a spot: name + the **two most common species hinted** as silhouettes (only species already in the dex show names; others say "something lives here").
- After a cast with no bite for 8 s: the message pill offers a hint drawn from the **best-matching uncaught species at that spot**: "Try a slower retrieve", "Fish deeper here", "This spot wakes up at dusk." One hint per cast, never the species name.
- Dex entry: habits as sentences; a "Where to find" row listing the waters' spots whose structure matches.

## 4. Luck stays, but smaller

`luckTotal` keeps working (rod, boat, lures, weather, level, rebirth, dex, mastered). Its weight in `rollFish` is unchanged; the match multiplier sits beside it. Tuning target (unit-test it): at luck 0 and a perfect match on a common's preferred spot, the common bites ≥ 55 % of casts; at luck 0 and a zero-point match, an epic bites < 1 % of casts; at luck 40 and a perfect epic match, the epic bites ≥ 12 %.

## 5. The fight v2 (WP-3)

Replace the sweeping-cursor tap game with a **tension fight**. Keep the ring from WP-1 as the display.

### 5.1 State (`sim.fight`)
```ts
type Fight = {
  tension: number;   // 0–1, current line load
  dist: number;      // 1 → 0, fish distance; 0 = landed
  stamina: number;   // 1 → 0, fish energy
  run: number;       // >0 while the fish is running (seconds left)
  style: Habit["fight"];
  reeling: boolean;  // input held
  drag: 0 | 1 | 2;   // player's drag setting (Settings → or the [ ] keys); 0 loose, 2 tight
};
```

### 5.2 Input
- **Hold** Space / mouse button / touch = reel. **Release** = give line. Tap-tap still works (a tap is a 120 ms hold) so the kid loop survives.
- `[` / `]` adjust drag during a fight (desktop). Drag loosens how fast tension builds; tight drag lands faster but snaps easier.

### 5.3 Tick (in `frame()`, `phase === "reel"`)
```ts
const F = sim.fight; const fish = sim.fish;
const pull = (0.35 + 0.25 * fish.t) * (0.5 + F.stamina) * styleMod(F, t);   // fish pulling away, 0.35–1.6
const reelIn = F.reeling ? 0.55 * (1 + REELS[reel].speed * 0.04) : 0;
// tension
const dragK = [0.6, 1.0, 1.4][F.drag];
F.tension += dt * ((F.reeling ? pull + 0.6 : pull - 0.9) * dragK);
F.tension = clamp(F.tension, 0, 1);
// distance
F.dist += dt * (pull * 0.12 - reelIn * 0.18 * (F.tension > 0.25 ? 1 : 0.4));   // you only gain line with some tension on
F.dist = clamp(F.dist, 0, 1.3);
// stamina: fish tires when it pulls against tension
F.stamina -= dt * (0.04 + F.tension * 0.1) / fish.habit.stamina;
// line
if (F.tension > 0.92) sim.tz += dt * 3;               // red zone strains the line (reuse tz/hold)
if (sim.tz >= sim.hold) fail("snap");
if (F.dist <= 0) succeed();
if (F.dist >= 1.3) fail("slip");                        // gave too much line, it threw the hook
```

### 5.4 Styles (`styleMod`)
Each style has a signature the player learns to read:

| Style | Behaviour |
|---|---|
| runner | Every 4–7 s, a run: `pull × 2.2` for 1.5 s. The ring shows a brass arrow outward 0.4 s before. Give line or snap. |
| diver | Steady, heavy pull `× 1.3`; no runs; stamina drains 20 % slower. Patience fight. |
| jumper | Every 5–8 s a jump: `pull × 0` for 0.8 s and tension drops to 0; if the player *keeps reeling* through the jump the fish "throws the hook" 35 % of the time (`fail("slip")`). The fish actually leaps (reuse `sim.leap` with a smaller arc). Ease off when it jumps. |
| bulldog | Low pull `× 0.9`, huge stamina `× 1.5`, holds near `dist 0.3` with `pull × 1.8` for the last stretch. |
| thrasher | Pull oscillates `× (1 + 0.8·sin(t·9))` — tension wobbles; keep the average, don't chase the needle. |

Boss fights: style sequence `runner → thrasher → bulldog` by `dist` thirds, each with `pull × 1.3`, plus the signature trick from `EXPANSION-DESIGN.md` §2 applied as a modifier (Frost Dragon: tension needle freezes for 0.6 s; Marble Emperor: `pull 0` for 2 s then `× 3`).

### 5.5 Display mapping (into the WP-1 ring)
- Band = the **green zone of tension**: `[0.35, 0.78]`; cursor = `tension` mapped to the arc. Kid-readable: "keep the needle in the green."
- Tension ring (inner) now shows `dist` filling as you gain line; hits ticks are replaced by a small fish icon moving along the inner ring toward the bobber.
- `stamina` shows as the fish's dart amplitude on the water (tired fish stop darting) — already partly there via `fight` amplitude in `stage.tsx`.
- Message pill: style-specific coaching the first 3 fights per style ("It's running — let go!"), then silence.

### 5.6 Helping Hand in v2
`assist` widens the green band to `[0.28, 0.85]`, halves red-zone strain, and makes runs telegraph 0.8 s instead of 0.4 s, using the same miss/hit streak logic as WP-1 §5.

### 5.7 Tests
`src/game/fight.test.ts`: simulate 2,000 fights per style with a scripted "decent player" (reel when tension < 0.6, release when > 0.8, release during telegraphed runs) and a "button masher" (always reel). Assert: decent player lands ≥ 85 % of commons and ≥ 55 % of epics; masher lands ≥ 60 % of commons (kids must still succeed) and ≤ 25 % of epics; median fight length 6–14 s for commons, 18–40 s for bosses.

## 6. Keep or release (WP-3)

After `succeed()`, the celebration card offers **Keep** / **Release** (desktop: K / R; auto-Keep after 6 s so nothing stalls).

- **Keep**: today's behaviour (inventory, sellable).
- **Release**: no inventory item, no sale; the dex still records count/best weight; XP × 1.2; `released` counter; releasing a species 5 times grants a **Steward** tag in its dex entry; a water where you've released 25+ fish gets a permanent +5 % size bias (the enthusiast's conservation loop). Contracts of kind `bank`/`count` count releases for `count`, not for `bank`.
- Survival mode (see `05`) hides Release and adds **Eat / Smoke**.

## 7. Records (WP-3)

`records: Record<string, { w: number; at: number; spot: string; p: Presentation; weather: number; window: Window }>` keyed by species. On a new best weight, store the whole context — the dex shows "Your best: 6.4 lb · The Lily Pads · worm, slow, shallow · dusk, rain". This is the single most enthusiast-pleasing feature in the plan and it is cheap. Records also feed the tournament "Big Fish" category (`06`).

## 8. Done when
- **WP-2**: spots on all 15 waters with hover/click casting; rig control; `habitOf` with the ≥ 25 real-fish overrides; `matchScore` wired to bite time, species weights and size; hints after 8 s; dex habit sentences; `rng.ts` in place and lint rule banning `Math.random` in `src/game`; tuning tests in §4 pass; saves migrate (`lastSpot`, `rig`); phone chips work.
- **WP-3**: tension fight with 5 styles + boss sequence; hold/release input and drag keys; ring mapping; coaching lines; Helping Hand variant; keep/release; records with context; `fight.test.ts` thresholds pass; co-op assist (J) still contributes (P2's hold adds `+0.2` reelIn).
