# Test phase: every new build resets all progress

Written for Caleb and Chris. While FAC Ultra is only being tested, **every new build (every update) automatically wipes all progress and saves**. Testers start fresh on each version, and an old test save can never break a new build.

## The one switch

- In the code: `TEST_PHASE_RESET` in `src/lib/test-phase.ts`. It is `true` now.
- Without touching code: set `FAC_TEST_RESET=0` (off) or `FAC_TEST_RESET=1` (on) where the game's server starts. This beats the constant.
- While it is on, a small line says **"Testing build — progress resets on every update"** on the title screen and inside Settings. It disappears when the switch is off.

## What an update wipes

On the server (once per new build):
- cloud saves (every profile, every mode)
- tournaments: events, entries, catches, results, trophies and titles, Daily Survival runs
- rooms and live boards, friend requests, friend invite links, event invites
- rate-limit and strike counters, and each angler's temporary ban / "fishing now" state

On each device (the first time it opens the new build):
- every save slot (Expedition, Recreational, Survival, Co-op, Tournament) and their backup copies
- cloud sync notes and the 7-day "other copy" backups
- tournament queues and the "Who's fishing today?" answer (it is asked again)

The player then sees once: "The game was updated for testing, so progress has been reset. Happy fishing!"

## What it keeps

- Accounts, sign-in sessions (people stay signed in), family profiles and their names
- The friend graph (who is friends with whom) and block lists
- Device settings: picture quality, sound and volume, motion, flash, colour-blind colours, Kid Mode, full-screen preference
- The anonymous player id and name on each device

The keep lists are two plain lists in `src/lib/test-phase.ts` (`WIPE_TABLES` / `KEEP_TABLES` for the server, `KEEP_KEYS` for browsers). A test fails if a new table is not put on one of them.

## How it works (short)

Each build gets an "epoch" (commit + build time) stamped by `scripts/build-epoch.mjs` during `npm run build`. The server remembers the last epoch it saw (table `app_state`); when it differs, it wipes in one step and logs `[test-phase] New build ...`. The browser does the same with `localStorage["fac-ultra-epoch"]` before it loads any save. An old tab left open learns about the new build from `GET /api/epoch` and reloads once; the cloud refuses a push from an older build. Dev servers (`npm run dev`) and tests always use the epoch `dev`, so nothing wipes on a hot reload. (`FAC_TEST_RESET_EPOCH` forces an epoch: at build time for the stamped build; on a dev server it changes the server only.)

If the switch is off, nothing is wiped and the remembered epoch is left alone. Switching it back on later wipes once on the next new build.

## Before real launch (checklist)

1. Set `FAC_TEST_RESET=0` on every server (and/or set `TEST_PHASE_RESET = false` in `src/lib/test-phase.ts` and release that build). Confirm the "Testing build" line is gone from Settings.
2. Do **not** deploy any further build until step 1 is in place: the build that has the switch on wipes players' progress.
3. Take a database backup (Neon: a branch or snapshot) before the first real launch.
4. Decide whether to wipe the test accounts and friend lists once by hand (the reset keeps them on purpose).
5. Check the server log of the first launch build does not show a `[test-phase] New build ...` line.
6. Tell testers their progress will no longer reset.
