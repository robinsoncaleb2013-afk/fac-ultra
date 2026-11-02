# 09 · Mobile

One game, two presentations. PC gets the full effects stack; phones and tablets get a layout built for a thumb and a graphics tier that holds 60 fps on a mid-range Android. Nothing in the rules differs — a tournament cast on a phone replays identically on the server.

This document amends `03-presentation-big-water.md` §1.1 (which said "phone keeps today's layout"). **Mobile is part of WP-1**, not a later package; its acceptance items are in §8 and are added to `03` §9.

## 1. Device and graphics tiers

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

- `form` is re-evaluated on `resize`/`orientationchange`; `gfx` is a saved device setting (`07` §2) the player can pin in Settings (Full / Light / Mobile). Unpinned, it starts at `defaultGfx()` and the fps governor (`03` §7) may step it **down** one tier, never up.
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
