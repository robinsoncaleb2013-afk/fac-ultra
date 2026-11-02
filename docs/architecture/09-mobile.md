# 09 · Mobile

One game, two presentations. PC gets the full effects stack; phones and tablets get a layout built for a thumb and a graphics tier that holds 60 fps on a mid-range Android. Nothing in the rules differs — a tournament cast on a phone replays identically on the server.

This document amends `03-presentation-big-water.md` §1.1 (which said "phone keeps today's layout"). **Mobile is part of WP-1**, not a later package; its acceptance items are in §8 and are added to `03` §9.

## 1. Device and graphics tiers

### 1.0 Graphics levels (amended in WP-10 — read this first)

Players see **five levels**; the drawing code still has **three tiers**. The levels sit on top of the tiers and are kept separate from the form factor (a PC can be on Low; a phone can never be pushed above Low by Auto).

| Level (what players see) | Tier it uses | What is trimmed on top of the tier (`TRIM` in `graphics.ts`) |
|---|---|---|
| **Ultra** | `full` | nothing: the `full` column of §1.2 |
| **High** | `full` | 30 glints, 70 particles, 48 confetti, no plankton |
| **Medium** | `lite` | nothing: the `lite` column |
| **Low** | `mobile` | nothing: the `mobile` column |
| **Potato** | `mobile` | 8 px strips redrawn every 3rd frame, 4 glints, 12 particles, 1 swimmer, quarter rain rings, 8 confetti, canvas DPR 1 |

`LEVEL_TIER` in `src/game/device.ts` is the mapping and `tierSpec(tier)` in `graphics.ts` applies the trim, so every effect still reads one table. The device setting `gfx` is now `"auto" | "ultra" | "high" | "medium" | "low" | "potato"`. Old values load as `full → ultra`, `lite → medium`, `mobile → low` (no save-version bump: device settings are not part of the career save).

**Auto** is the default. It uses, in this order of importance:
1. **The speed test** (`src/game/probe.ts`): about 50 animation frames measured at start-up. Frame rate is the main signal (`levelFromFps`: 55+ Ultra, 46+ High, 34+ Medium, 22+ Low, below that Potato).
2. **The graphics-chip name** (`WEBGL_debug_renderer_info`) is only a hint: it can hold the level back (software drawing → Low, weak built-in chips → High) and never pushes it up (`levelCapFromRenderer`).
3. **The device default** (§1.1) when the test has not finished.
Auto may lower the starting level anywhere, and may raise it only on a PC. Its ceiling is `autoCeiling(form)`: Ultra on a PC, Medium on a tablet, **Low on a phone** (mobile defaults stay safe).

**The governor** (`governorStep`, `03` §7): quick down, slow up.
- Down: under 45 fps for 3 s drops one level and shows the toast "Switched to lighter graphics for a smoother game — change it in Settings." (Pinned levels are never lowered by the game.)
- Up: Auto only; the game must stay at 57+ fps for 30 s (a smooth stretch, not one lucky second); **at most once per session**; never above `autoCeiling`; and never again once the player has pinned a level by hand during the session.
- `src/game/governor.test.ts` drives it with simulated frame times.

Settings → Picture quality lists Auto plus the five levels, each with one plain-English line (`LEVEL_INFO`).

### 1.1 Detecting the device class
`src/game/device.ts`:

```ts
export type Form = "phone" | "tablet" | "desktop";
export type Gfx = "full" | "lite" | "mobile";

export function formFactor(): Form {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const w = Math.min(innerWidth, innerHeight);          // short side
  if (!coarse) return "desktop";
  return w < 600 ? "phone" : "tablet";
}

export function defaultGfx(form: Form): Gfx {
  if (form === "desktop") return "full";
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (form === "tablet" && mem >= 4 && cores >= 6) return "lite";
  return "mobile";
}
```

- `form` is re-evaluated on `resize`/`orientationchange`; `gfx` is a saved device setting (`07` §2) the player can pin in Settings (Full / Light / Mobile). Unpinned (Auto), it starts at `defaultGfx()` (or the speed test, §1.0) and the governor may step it **down** quickly and **up** slowly as §1.0 describes. (This replaces the WP-1 rule "never up".)
- `useDesktop()` from `03` becomes `useForm()`; the desktop layout applies when `form === "desktop"` **or** when a tablet is in landscape with ≥ 1024 px width (a big iPad is a small PC).

### 1.2 What each tier draws

| Effect (`03` §3) | full | lite | mobile |
|---|---|---|---|
| Painting + breathe | ✓ 1600 px | ✓ 1600 px | ✓ 800 px (DPR-capped at 1.5) |
| Ripple displacement | 2 px strips | 4 px strips | **6 px strips, water region only, every other frame** (cached frame reused) |
| Sun/moon glints | 40 | 20 | 12 |
| Light rays | ✓ | — | — |
| Time-of-day tint | ✓ | ✓ | ✓ (one `fillRect`) |
| Weather tints | ✓ | ✓ | ✓ |
| Rain rings | ✓ | ✓ | half rate |
| Particles cap | 90 | 60 | 30 |
| Plankton | ✓ | — | — |
| Background swimmers | 5, through water | 5 | 3, drawn after ripple (cheaper) |
| Fish pattern layer | ✓ | ✓ | ✓ (patterns are cheap) |
| Celebration confetti | 60 | 40 | 24 |
| Fight ring | ✓ | ✓ | ✓ (bigger — see §3) |

Canvas DPR: `full/lite` cap at 2 (as today), `mobile` caps at 1.5. On a 1080 px-wide phone that halves the fill cost.

### 1.3 Battery and background
- `visibilitychange: hidden` → stop the rAF loop entirely; on return, `frame()` gets one `dt` capped at 0.05 s as today (no catch-up storm).
- On `mobile`, if the page has had no input for 60 s and no cast is active, drop to 30 fps (skip every other frame) until the next touch. Shows nothing different to a kid glancing at a swimming fish.
- Never use `requestAnimationFrame` for the HUD text; the store already handles it.

## 2. Mobile layout

### 2.1 Portrait (the common case)

```
┌─────────────────────────┐
│ $1,240  Lv 7 ▮▮▯   ☰    │ ← HUD bar 44 px, over the water
│                         │
│      THE PAINTING       │   water: 52 % of the viewport height (was a 288 px strip)
│   ● bobber + ring       │   full-bleed, no rounded strip; chips (weather·water·window) float top-left
│                         │
│  ◌ spot chips  ◌ rig    │ ← spot picker & rig button float at the bottom of the water
├─────────────────────────┤
│  "Hooked. Keep it green"│ ← message pill
│ [        CAST         ] │ ← 56 px tall, full width, thumb reach
├─────────────────────────┤
│  Cast panel content     │   the current tab's panel scrolls here (bounties, last catch…)
│  …                      │
├─────────────────────────┤
│ 🎣 🎒 🛠 🪝 🗺 📖 🏆       │ ← bottom tabs, 7 icons, 56 px + safe-area
└─────────────────────────┘
```

- The water is `52dvh` (min 280 px, max 480 px). Scrolling the panel below **never** scrolls the water away: the top block is `position: sticky; top: 0` inside the game column so the bobber is always visible while the kid reads the dex. Scrolling past 40 % of the panel collapses the water to a 120 px **peek strip** (CSS transition, 200 ms) that still animates and shows the bite; tapping the strip or the cast button snaps it back.
- Cast button stays pinned above the tabs at all times (`position: sticky; bottom: 56px`).
- Drawer tabs (Bag/Gear/Lures/Waters/Dex/Lodge) render **inline** below the cast dock (today's behaviour) — a drawer over the water is wrong on a phone; you can't see the fish anyway.
- HUD bar on mobile shows money, level bar and a `☰` that opens a small sheet (Menu / Settings / Fullscreen). Weather/water/window chips stay on the painting.

### 2.2 Landscape phone and tablet
- Landscape phone (`form==="phone"`, width > height): the **desktop** layout with the rail collapsed to icons only (56 px) and the drawer at 60 % width. Fullscreen via the `☰` sheet (phones hide the URL bar only in fullscreen).
- Tablet portrait: portrait layout with the water at 48 % and the panel in two columns. Tablet landscape ≥ 1024 px: desktop layout.

### 2.3 Main menu on mobile
Painting full-bleed (800 px, water effects at the device tier), title top-left, mode cards as a **vertical list** of 7 rows, 64 px each, icon + title + one-line blurb; the row the player last played is first. Swipe left/right on the painting cycles the biome preview (cosmetic).

### 2.4 As built in WP-10: the Hub (amended by §2.5 in WP-12: read that for which tabs show where; this replaces §2.1's bottom tabs, §2.2's rail and §2.3's card list)
- **Title screen** (`hub/TitleScreen.tsx`): the current water painted behind the logo, one big **Play**, **Continue** (last mode) and **Settings**, and the Cloud and Full screen buttons. Swipe to preview another water. Enter plays.
- **The Hub** (`hub/Hub.tsx`) is the pause menu. One row of six tabs: **Play, Tackle, Lodge, Waters, Players, Settings** (Tournament mode hides Tackle and Waters; Survival hides Waters). It opens from the title screen's Play, the corner **Menu** button, Esc, or the digits 1 to 6. It pauses the water (not in a tournament, where the clock is the server's).
- **PC and big tablets** (`useHubLayout().split`): a list on the left and a **large detail panel** on the right that follows hover or the highlighted row. Locked things show a mystery silhouette and a hint. A hint bar at the bottom lists the keys (or gamepad buttons once a pad is seen).
- **Phones**: tabs along the **bottom** (portrait) or the top (landscape), one column, every target 44 px or more, tap an item for a **full-screen detail with a Back button**. The inline cast panel stays under the water in portrait; every other panel now lives in the Hub.
- **Corner HUD** (`hub/CornerHud.tsx`) replaces the rail, HUD bar, drawer, bottom tabs and the ☰ sheet: Menu button, level and collection bars, cash, a postage-stamp map of the water with its spots, and buttons for the quick wheel, the satchel and full screen.
- **Quick wheel** (hold Tab, or tap its corner button): lures and emotes pages (Q/E swap). **Satchel** (hold B, or tap): the catch and a link to Tackle. Release the key and the pointed slice is chosen. Touch uses tap buttons, not long-press.
- **Keyboard and gamepad** (`hub/HubKeys.tsx`, `game/hubnav.ts`, `game/spatial.ts`): arrows or WASD move by position on screen, Enter chooses, Esc goes back or closes, Q/E (LB/RB) change tab, F is full screen. Left and right past the edge change tab. Start toggles the menu, A/B choose and go back, LT holds the wheel, Y the satchel.
- Old routes still work: `setTab("bag")` or `setLodgeView("records")` open the Hub at the matching tab and item (`hubTargetFor`). Digits 1 to 6 now open Hub tabs; the old Space/Enter, H, M, J, [, ], K, R, P keys are unchanged.
- Motion respects `prefers-reduced-motion` and the in-game Motion setting; the drifting specks and the title sway stop. No new fonts: Fraunces and Outfit are still the only fonts (their stylesheet link is unchanged; offline they fall back to Georgia and system sans).

### 2.5 As built in WP-12: two levels of menu (Caleb's feedback: "Play should be what you see first")
The WP-10 Hub showed every tab, even on the title screen, so you could sell fish from the main menu. It is now two levels, both drawn by `hub/Hub.tsx` in the same look (tab strip, list left and large detail panel right on a PC, tap-to-detail on a phone, hint bar):
- **Level 1, the main menu** (screen "menu", outside any game). Title screen buttons: **Play**, **Continue**, **Settings**, **Friends**, **Collections**, plus Cloud and Full screen. The menu's tabs are `MAIN_TABS` in `game/hubnav.ts`: **Play** (mode select), **Collections** (a read-only look at each mode's fish, five heaviest and trophies, read from the saved text by `game/peek.ts`, no buttons that act), **Friends** (add by name, email or code, accept, remove, block), **Account** (sign in, family profiles, cloud saves) and **Settings** (sound, picture, full screen, help and Kid Mode, controls). Nothing here can sell, buy, craft, travel or cast. Mode select shows five painted cards (Expedition, Recreational, Survival, Tournaments, Local Co-op), a **Kid-friendly play** switch that goes with whichever mode you pick, and small **Expedition extras** shortcuts (online co-op, aquarium, derby, boss rush), which start Expedition and open that room.
- **Level 2, the in-game menu** (screen "game"). Its tabs are the mode's own `menuTabs` list in `game/modes.ts`. Expedition and Local Co-op: Tackle, Shop & Sell, Lodge, Waters, Players, Settings. Recreational: Tackle, Waters, Logbook, Collection, Settings. Survival: Camp, Larder, Waters (read-only), Log, Settings. Tournaments: Event, Lodge, Players, Settings. **Selling and buying exist only in Shop & Sell** (the tab only modes with an economy list), plus the in-game satchel of those same modes. Header buttons on every in-game menu: **Resume** (Esc) and **Leave** ("Main menu", "Leave trip", "Leave event" or "Leave run"). Leave saves first and asks "Are you sure?" only when a fish is on, a line is out, a trip, event or run is open (`game/leave.ts`). Settings here is the same panel as the main menu's, plus the account shortcut and "Your saves" for the mode you are in.
- **Phones**: tabs along the bottom (they scroll sideways when there are more than fit), the header carries Resume and Leave as round 44 px icon buttons. Digits 1 to 9 open the in-game tabs. `resolveHubTarget` sends an old request ("open the Lodge on the logbook") to the tab the current mode really has.
- **Keys**: Esc backs out of a detail, then of the "Leave?" question, then resumes (or closes the main menu); the menu now swallows the Esc and digit presses it handles so the game cannot reopen it on the same press. F is full screen on both levels. `scripts/check-touch-targets.mjs` walks both levels and three modes. Bounty chips in the landscape game view grow to 44 px on touch.

## 3. Touch controls

### 3.1 Casting and the fight
- **Tap the water** = `act()` (exists). Tap target is the whole water block, not just the canvas, so a thumb at the edge still casts.
- **Spots** (`04` §2.2): on a phone, tapping a spot's ring on the painting casts there (rings are 44 px minimum on screen, so `r` is computed as `max(spot.r·w, 22px)`); the spot-chip row at the bottom of the water is the accessible fallback and shows the chosen spot's name.
- **Fight v2** (`04` §5.2): **press and hold anywhere on the water** = reel; lift = give line. The ring is drawn **larger on mobile** (`R = clamp(0.14·min(w,h), 56, 120)`) and the tension needle is 18 px so it's readable under a thumb. The message pill mirrors the needle color (green / amber / red) so a thumb covering the ring still gets feedback.
- **Drag** (`[`/`]` on desktop): two small `−/+` buttons at the right edge of the water during a fight; default drag 1.
- **Haptics**: `buzz()` already exists; add a 10 ms tick on each hit and a 30 ms pulse on a run telegraph. Respect `motion` off = no haptics.

### 3.2 Rig control
A bottom sheet (`vaul` is installed and unused — use it) opened by the rig button: three depth tiles and four retrieve tiles, big enough for a thumb (min 56×56), with the current lure's family shown; one line of plain-English hint ("Slow and deep is good for catfish here"). Closes on selection.

### 3.3 Celebration and keep/release
Celebration card slides up from the bottom (full width, 55 % height) with **Keep** and **Release** as two half-width buttons; auto-Keep after 6 s as on desktop. Swipe down dismisses.

### 3.4 Gestures to avoid
No swipe-to-reel, no pinch, no long-press menus. Kids and wet thumbs. Every action is a tap or a hold.

## 4. Text, targets and safe areas
- Minimum tap target 44×44 px everywhere (the Nav already does this; audit panels — the dex grid cells become 56 px on phones, 5 columns in portrait, with names shown on tap).
- Body text 15 px on phones (Tailwind `text-[15px]`), Fraunces headings down one step. Kid Mode (+1 step, `05` §4) still applies.
- `safe-top`/`safe-bot` classes exist; add `safe-x` for landscape notches (`padding-inline: env(safe-area-inset-left/right)`) on the rail and HUD bar.
- `overscroll-behavior: none` (exists) and `touch-action: manipulation` on the water to kill the 300 ms tap delay and double-tap zoom.

## 5. Loading on a phone
- Mobile tier requests only the `800.webp` size (`03` §6); the first screen is the menu painting (~90 KB) + fonts + the JS bundle. Target: **first paint < 2 s and first biome visible < 3 s on Playwright's "Slow 4G" profile**; first-screen transfer **< 700 KB**.
- Fonts: on phones use `font-display: optional` for Fraunces (falls back to Georgia if it's not cached within 100 ms) so headings never flash late.
- Code-split the Lodge (Aquarium/Derby/Crew/Settings) and the Dex with `React.lazy` — they're the heaviest panels and nobody opens them in the first ten seconds.
- Preload the next unlocked biome only on Wi-Fi (`navigator.connection?.saveData !== true && effectiveType === "4g"`); otherwise load on travel.

## 6. Installable (PWA)
The sandbox already injects a manifest and icons under `public/__grok/` (platform plumbing — don't edit). Add a **"Add to home screen"** hint in the `☰` sheet that appears after the second session on a phone and explains the two taps for iOS Safari / Android Chrome; dismissable forever. No service worker in this chapter (the platform's injector owns the document; a SW would fight it) — offline play is out of scope until the sandbox plumbing is retired.

### 6.1 Full screen (WP-10)
- `src/game/fullscreen.ts` (pure, tested in `fullscreen.test.ts`) wraps the Fullscreen API with the `webkit` fallbacks; `components/game/fullscreen.tsx` holds `toggleFullscreen`, `useFullscreen` and the 44 px `FullscreenButton`, shown in the corner HUD, the Hub header, the title screen and Settings → Full screen. The **F** key toggles it everywhere.
- State follows `fullscreenchange` (so Esc and swipes stay in sync) and the layout re-reads size on enter, leave and rotation (`use-form.ts`).
- **iPhone Safari has no Fullscreen API for pages**: the button shows a plain-English Home Screen hint instead ("Add to Home Screen" from the share menu). An installed copy has no browser bars, so the button hides there.
- Optional: after entering full screen on Android the screen may be locked to landscape if the player turns on "Keep the screen sideways in full screen" in Settings. It fails silently where unsupported; the preference lives in its own localStorage key.
- PWA checks: `theme-color`, `viewport-fit=cover`, safe-area insets (`safe-top`, `safe-bot`, `safe-x`) and `100dvh` are in place, and `__root.tsx` now adds `mobile-web-app-capable` and `apple-mobile-web-app-capable`. **Known gap:** the manifest is written by the sandbox plugin (`scripts/grok-pwa-*`, `public/__grok/`) with `display: standalone`; a `fullscreen` display mode would need that plumbing changed, so it is left alone.

## 7. Multiplayer on mobile
- Tournament lobby and live board (`06` §3) are full-screen sheets on phones; the board over the water becomes a one-line **rank ticker** under the HUD bar ("#4 of 31 · 2.3 lb behind #3").
- P2P mesh cap on phones is **4 peers** (vs 8 on desktop) to protect battery and radio; beyond that, board-only, exactly as the desktop fallback.
- Emotes are a horizontal row above the cast button during an event.

## 8. Done when (added to WP-1's acceptance in `03` §9)

10. `device.ts` tiers: a Playwright run with `isMobile: true`, 390×844, `deviceScaleFactor: 3` selects `phone` + `mobile`; a 1440×900 run selects `desktop` + `full`; a 1024×768 touch run selects `tablet` + `lite`; pinning in Settings overrides and survives reload.
11. Portrait layout matches §2.1: water 52 dvh with sticky peek strip, pinned cast button, inline panels, bottom tabs; landscape phone shows the collapsed-rail desktop layout; screenshots of both plus the menu attached.
12. Touch: tap-to-cast on the whole water block, hold-to-reel, spot tap with ≥ 44 px rings, rig bottom sheet, drag buttons, haptics on hits (verified by stubbing `navigator.vibrate` in Playwright and counting calls).
13. Mobile tier renders ripples every other frame at 6 px strips, ≤ 30 particles, no rays/plankton; rolling fps ≥ 55 in Playwright with CPU throttled 4× at 390×844 for 30 s on Pond.
14. First-screen transfer < 700 KB and first biome visible < 3 s on the "Slow 4G" profile; Lodge and Dex are separate chunks (check the build output).
15. Every tap target in the panels is ≥ 44 px (automated: a Playwright script walks all `button`/`[role=button]` bounding boxes on each tab at 390×844 and fails on any smaller).
16. Background tab stops the loop (assert `requestAnimationFrame` call count stays flat for 2 s after `page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))` with `hidden` stubbed).
