# 03 · Presentation: "Big Water"

Work package **WP-1**. The water fills the screen on PC, the fight happens on the water, the paintings come alive, and the game loads fast. No rule changes.

## 1. Layout

### 1.1 Breakpoints
- `< 1024 px` (phone/tablet): **today's layout, unchanged.** Header, stage strip, action band, scrolling panel, bottom nav.
- `≥ 1024 px` (desktop, `lg:`): the **Big Water** layout below.

Implement as one component tree with Tailwind `lg:` variants where cheap, and a `useDesktop()` hook (`matchMedia("(min-width: 1024px)")`) where the trees genuinely differ (the stage is full-bleed vs. a strip; the panel is a drawer vs. inline).

### 1.2 Desktop layout

```
┌────────────────────────────────────────────────────────────────────┐
│ ┌──────┐  Sunny · Pond · The Shallows             $1,240  Lv 7 ▮▮▯ │ ← HUD top bar: floating, 56 px, gradient-to-transparent, no border
│ │ rail │                                                            │
│ │ Cast │                 THE PAINTING (canvas, 100% × 100%)         │
│ │ Bag  │                                                            │
│ │ Gear │              bobber ● with fight ring when reeling         │
│ │ Lure │                                                            │
│ │Water │   ┌───────────────────────────────┐                        │
│ │ Dex  │   │  "Hooked. Keep it in the band" │ ← message pill, bottom-center, 36 px above the cast button
│ │Lodge │   └───────────────────────────────┘                        │
│ └──────┘               [     CAST / HOOK / REEL     ]   ← 280 px wide, bottom-center, 28 px from bottom
└────────────────────────────────────────────────────────────────────┘
```

- **Stage**: `position:fixed; inset:0`. The canvas is the page background. `drawCover` already fills; keep the gentle breathe.
- **Rail** (left, 72 px wide, full height, `bg-bg/55 backdrop-blur-md`): the seven tabs as icon + 10 px label, vertical. Active tab = brass icon + a 3 px brass bar on the rail's left edge. The rail is the only persistent chrome besides the HUD bar.
- **Drawer**: clicking any tab other than Cast opens a panel **over the water from the left**, 440 px wide (`max-w-[32rem]`), full height minus the HUD bar, `bg-bg/85 backdrop-blur-lg`, 240 ms slide. Clicking Cast, pressing `Esc`, or clicking the water closes it. The water keeps animating behind it (fish keep swimming; the player can still see a bite).
- **Cast tab on desktop** has no drawer: its content (stats, boss card, bounties, last catch) becomes two things: the **last-catch toast card** (bottom-right, auto-hides after 6 s, hover to keep) and a compact **Bounties** chip row under the HUD bar on the right. Boss progress lives in the stage chips ("Pond King 17/24").
- **Message pill + cast button**: bottom-center over the water. During `reel` the pill shows hits (`3 / 5`) and the line meter is the ring, not a bar. The old DOM bar (`hud.track/zone/cursor`) is **removed**.
- **Toasts** stack top-center under the HUD bar.
- **Main menu** on desktop: the current biome painting full-bleed with the water effects running, title bottom-left, mode cards as a single row of 7 at the bottom (or 2 rows of 4 on `lg`, 1 row on `2xl`). Keep the phone version as is.

### 1.3 Files
- `src/components/game/shell.tsx` → keep as the router; move layouts into `src/components/game/layout/MobileLayout.tsx` and `layout/DesktopLayout.tsx`, plus `layout/Rail.tsx`, `layout/Drawer.tsx`, `layout/HudBar.tsx`, `layout/CastDock.tsx` (pill + button).
- `src/components/game/panels.tsx` → split into `panels/{Cast,Bag,Gear,Lures,Waters,Dex,Lodge}Panel.tsx` + `panels/shared.tsx` (Stat, Badge, Filter, Toggle). No logic changes while splitting.
- `src/game/engine.ts` → delete the `hud` object and `paintHud()`; add `sim.ring` (below).

## 2. The fight on the water

Replace the horizontal bar with a **ring around the bobber**, drawn in `paint()`.

### 2.1 Geometry
- Center = bobber (`sim.bnx·w, sim.bny·h`). Radius `R = clamp(0.09·min(w,h), 44, 96)` px. Ring thickness 10 px.
- The old 0–100 cursor maps to the ring's angle: `θ(p) = -π/2 + (p/100)·2π·0.86` — the ring is an 86 % arc opening at the bottom so the fish stays visible under the bobber. Band = the arc from `θ(zc − zone/2)` to `θ(zc + zone/2)`.
- The cursor is a 16 px brass "lure" dot on the arc at `θ(cp)`, with a 40 px fading trail (last 6 positions).
- Line tension (`tz / hold`) is a second, thinner ring (4 px) *inside* the first: fills clockwise from top, color `lagoon → brass → #e4572e` at 0 → 0.5 → 0.85. At ≥ 0.85 the ring and the fishing line **thrum** (±2 px sine at 47 Hz already exists for the line; reuse).
- Hits show as small brass ticks pinned to the ring at the angle they were landed, so the player sees progress build around the circle.

### 2.2 Phases
- `wait`: no ring. The bobber dips every ~1.5 s with a tiny ripple (fake nibbles, cosmetic) so a kid watches it.
- `bite`: ring appears instantly at 70 % alpha, pulsing (scale 1 → 1.12 at 3 Hz); the **whole ring is the band** for the bite window; band shrinks as `biteLeft` runs out (visualises "hook early"). Cursor not shown.
- `reel`: as 2.1. Band color: `lagoon`. On hit: band flashes white 80 ms, +12 trauma already. On miss: ring shakes (reuse trauma offset) and the tension ring jumps.
- Boss phase 2 reversals: the ring briefly **spins the whole arc 180°** over 220 ms (ease-out) — a fake-out you can see coming. Boss phase 3: band narrows 20 % and the tension ring thickens to 6 px.
- `succeed` / `fail`: ring bursts into 24 spark particles (reuse `burst`), then the existing leap.

### 2.3 Rules unchanged
`sim.cp/cd/zc/zone/hits/need/tz/hold` keep their meaning; only the drawing changes. `reelTap()`, `hook()`, `startCast()` untouched except for Helping Hand (§5).

## 3. Living water (Canvas 2D only)

All effects are gated by `s.motion`. Quality tier `s.gfx: "high" | "lite"` (new setting, default `high`; auto-drops to `lite` if the frame loop measures < 45 fps for 3 s — see §7).

### 3.1 Water line
Each biome gets a `waterY` (0–1, where the painting's waterline is) in a new table `WATER_LINE: number[]` in `content.ts` (eyeball from the paintings; Pond ≈ 0.52, Sky ≈ 0.6 … record all 15). Everything below `waterY·h` is "water".

### 3.2 Ripple displacement (the big one)
Draw the painting once per frame into an **offscreen canvas** `buf` the size of the stage (reuse; resize only when the stage resizes). Then copy the water region to the main canvas **in horizontal strips** with a sinusoidal x-offset:

```ts
const strip = gfx === "high" ? 2 : 4;              // px per strip
for (let y = waterTop; y < h; y += strip) {
  const depth = (y - waterTop) / (h - waterTop);   // 0 at the waterline, 1 at the bottom
  const amp = 1.5 + depth * 6;                      // ripples grow toward the camera
  const dx = Math.sin(y * 0.035 + t * 1.7) * amp + Math.sin(y * 0.11 - t * 2.3) * amp * 0.35;
  ctx.drawImage(buf, 0, y, w, strip, dx, y, w, strip);
}
```
Above the waterline, draw `buf` straight. ~400 `drawImage` calls at 1080p in `high`; measured fine on integrated GPUs since each is a thin blit. Weather multiplies `amp`: Sunny 1.0, Rain 1.3, Storm 1.9, Fog 0.7, Night 0.8.

### 3.3 Sun glints
On Sunny and Night (moon): 40 sparkles in a band just below the waterline, `x` random, `y = waterY·h + rand(0, 0.12·h)`, each a 2–4 px additive (`globalCompositeOperation = "lighter"`) white dot whose alpha is `max(0, sin(t·3 + seed))^8`. Cheap, and it sells the water instantly.

### 3.4 Light rays
Sunny/Fog only, `high` only: 5 translucent triangles from the top (above the painting's light source side; store `sunX` per biome in `WATER_LINE`'s sibling table `SUN_X`), 60–120 px wide at the top, fading to zero alpha at `waterY`, slowly swaying (`±0.02·w` at 0.1 Hz). Alpha 0.06–0.1, `lighter`.

### 3.5 Shore foam and lily drift
Skip. (Named so no one adds it; the paintings already carry shore detail.)

### 3.6 Time of day
Real clock → a tint over the whole painting before ripples. Compute `hour = local hour + minutes/60`:

| Window | Tint | Alpha |
|---|---|---|
| 05–07 dawn | `#ffb37a` | 0.12 |
| 07–17 day | none | 0 |
| 17–19 dusk | `#ff8c5a` | 0.16 |
| 19–05 night | `#0b1a33` | 0.32, plus glints become moon-white and 18 stars twinkle above the waterline |

Weather `night` (the existing weather state) forces the night window. Add a Settings toggle **"Follow the clock"** (default on); off = always day.

### 3.7 Weather, upgraded
Keep the existing tints and particles; add: Rain → ripple rings where drops hit the water (spawn at `rate/3`, radius grows 0 → 14 px over 0.6 s, alpha fades); Storm → the existing lightning flash now also brightens the glints band for 120 ms; Fog → existing banks plus the ripple `amp × 0.7`.

### 3.8 Fish under the surface
Background swimmers (`sim.swimmers`) are drawn **through the water**, i.e. onto `buf` before the ripple pass, with alpha 0.55 and a slight blue tint — so they shimmer with the surface. The hooked fish and the leap are drawn *after* the ripple pass at full alpha (they've broken the surface).

## 4. Catch celebration

`succeed()` already sets `lastCatch`. Add a `celebration` UI field: `{ catch: LastCatch; at: number } | null`.

- Desktop: a card 420×300 slides up from the bottom-right over 260 ms (`ease-out-back`), holding a `<FishPortrait>` on a blurred strip of the biome, the name in Fraunces 32 px, rarity + mutation line, weight, value, and badges (NEW SPECIES / PERFECT / RECORD / BOSS). Auto-dismiss after 6 s or on click/Space.
- **Rare and up**: 60 confetti particles in the rarity color from the card's top edge, 1.2 s. **New species**: a 48 px rubber-stamp "NEW!" rotated −12° that scales in from 1.6 → 1 with 2 bounces. **Record** (weight > previous dex `w` and count > 1): a small "PERSONAL BEST" ribbon.
- Phone: the existing card in the Cast panel stays; add only the NEW! stamp.
- Sound: `audio.land(t)` already scales with rarity; add `audio.fanfare()` (3-note brass arpeggio) for epic+/new species.

## 5. Helping Hand (kid assist)

A per-save setting `assist: boolean` (default **true**). Adjusts the fight live:

```
missStreak   = consecutive misses within this fight + consecutive failed fights (slip/snap) × 2
hitStreak    = consecutive successful fights
zoneBonus    = assist ? clamp(missStreak * 3 - hitStreak * 1.5, -4, +14) : 0      // percentage points of band width
speedFactor  = assist ? clamp(1 - missStreak * 0.07 + hitStreak * 0.03, 0.6, 1.1) : 1
biteBonus    = assist ? clamp(missStreak * 0.25, 0, 1.2) : 0                       // extra seconds on the bite window
```
Apply in `hook()` (`sim.zone += zoneBonus`), the `reel` branch of `frame()` (`speed *= speedFactor`), and `beginBite()` (`biteMax += biteBonus`). Reset `missStreak` on success, `hitStreak` on fail. Store both on `sim` (not saved). Tournament mode forces `assist = false` and ignores these (see `05`).

Show it honestly: when `zoneBonus > 0`, the ring band gets a soft white outer glow and the message pill's hint reads "Helping hand: the band is wider." Kids should know the game is helping; it's not a secret.

## 6. Assets and loading

- Convert `public/art/biomes/*.jpg` to WebP at two sizes with `sharp` (dev dependency, run once via `scripts/art-build.mjs`, commit the outputs): `<id>-1600.webp` (q 78) and `<id>-800.webp` (q 72). Keep the JPGs for now as fallback via `<picture>`/`onerror`; delete them in WP-9 once nothing references them.
- `art.ts` → `loadArt(biome, neighbors = true)`: load the current biome at the size matching `min(1600, stage width·DPR)`, then the previous/next **unlocked** biomes at 800, then the rest at 800 **only when idle** (`requestIdleCallback`, one at a time). Menu uses 800 everywhere. `biomeArt(i)` returns the best loaded size.
- Fonts: keep Google Fonts but add `font-display: swap` (it's in the URL already) and a `<link rel=preload>` for the two faces used above the fold.
- Target budget (acceptance): first paint < 1.5 s and first biome visible < 2.5 s on a throttled "Fast 3G" Playwright profile; total transfer for the first screen < 1.2 MB.

## 7. Performance budget and auto-lite

- Measure fps in the loop: a rolling average over 60 frames. If avg < 45 fps for 3 s and `gfx === "high"` and the player hasn't pinned the setting, switch to `lite` and toast "Switched to light graphics for a smoother game — change it in Settings." `lite` = 4 px ripple strips, no light rays, half the glints, no plankton.
- Draw calls: keep `paint()` under 1,200 canvas operations per frame at 1080p `high`. Count them in dev with a `window.__facDraw` counter behind `import.meta.env.DEV`.
- Never allocate in the frame loop: pre-allocate particle arrays, reuse the offscreen buffer, no `.map()` in `paint()`.

## 8. Keyboard and mouse (desktop)

| Key | Action |
|---|---|
| Space / Enter / click water | act() (exists) |
| 1–7 | switch tabs (opens/closes the drawer) |
| Esc | close drawer / dismiss celebration |
| F | toggle fullscreen (`document.documentElement.requestFullscreen()`) |
| H | hide all chrome (photo mode); any key/click restores |
| M | mute toggle |
| J | co-op assist (exists) |

Mouse: hovering the water shows a faint crosshair at the pointer (groundwork for WP-2 spots); the cursor becomes a pointer over the water during `idle`.

## 9. Done when (acceptance for WP-1)

1. At 1440×900 the painting fills the viewport; rail, HUD bar, cast dock and drawer behave as §1.2; at 390×844 the old layout is pixel-for-pixel equivalent (compare screenshots).
2. The reel fight is a ring around the bobber with band, cursor, hits and tension exactly as §2; the DOM bar is gone; boss phase 2 shows the spin.
3. Ripples, glints, rays, time-of-day tint, rain rings are visible in a screenshot taken at 20:00 local in Rain on Pond; `motion` off disables all of them; `lite` disables rays/plankton.
4. Catch celebration appears on desktop for every catch, with confetti for rare+ and NEW! for a first catch.
5. Helping Hand widens the band after two misses (unit test on the formula) and the glow + hint appear; turning it off in Settings removes the effect.
6. First-screen transfer < 1.2 MB, measured with Playwright `page.on("response")` byte totals; only two biome images load before the player travels.
7. Rolling fps ≥ 55 in Playwright headless at 1440×900 for 30 s of idle on Pond (log the measure in the PR). Auto-lite triggers when fps is forced low (test by setting `strip = 1` temporarily or throttling CPU 6× in Playwright).
8. All keys in §8 work; `F` and `H` have tooltips in Settings → Controls.
9. `panels.tsx` is split; `shell.tsx` < 250 lines; gates green; screenshots of menu, Pond idle, bite, reel, celebration and two drawers attached to the PR.
