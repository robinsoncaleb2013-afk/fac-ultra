# Test phase: the build that used to reset all progress — and what replaced it

> **As built (WP-13, merged; the switch turned off and the per-player clear added later).** Everything below matches the code. The switch is **off**. Every setting for the server is in the environment table in [`README.md`](README.md).

Written for Caleb and Chris. While FAC Ultra was only being tested, **every new build (every update) automatically wiped all progress and saves**, so testers started fresh on each version and an old test save could never break a new build.

That is over. **An update now never wipes a player's data** — the switch below is off in the code itself, so not even a server where nobody set anything can wipe by accident. A player who wants a fresh start clears **their own** profile instead, whenever they like, and the game keeps a backup of their data for 24 hours in case they change their mind (see "A player clearing their own data", below).

## The one switch

- In the code: `TEST_PHASE_RESET` in `src/lib/test-phase.ts`. It is `false` now — that is the guarantee.
- Without touching code: set `FAC_TEST_RESET=0` (off) or `FAC_TEST_RESET=1` (on) where the game's server starts. This beats the constant. The family hub sets `FAC_TEST_RESET=0` as well, so both agree.
- Turning it back on with `FAC_TEST_RESET=1` is for testing the reset itself only: the next new build then wipes once, as described below.
- While it is on, a small line says **"Testing build — progress resets on every update"** on the title screen and inside Settings. It disappears when the switch is off.

## A player clearing their own data

In **Profiles and account** (and in Settings, while a backup can still be restored), a signed-in player can pick **"Clear …'s data"** for the profile that is fishing. It works like this:

1. This device's newest saves are sent to the cloud first, so nothing caught a moment ago is missed.
2. The cloud copies of every save the profile has — every kind of fishing, every slot — are kept as **one backup** on the account (the `save_backups` table, `migrations/0012_save_backups.sql`; the handler is `src/lib/accounts/backups.server.ts`, the route `src/routes/api/save-backup.ts`). A profile only ever has **one** backup: clearing again replaces it with the newer one.
3. The profile's saves are cleared, in the cloud and on this device, and the game starts fresh.
4. For **24 hours** from the clear (`CLEAR_BACKUP_MS` in `src/game/cloud.ts`), **Restore the backup** puts everything back — even after the player has tried the fresh start for a while. Restoring does not use the backup up; it stays until the 24 hours end. After that, the backup is deleted and gone for good.
5. A clear, a backup and a restore only ever touch the acting profile's own saves — never another profile's, never another account's. The backup is even kept if the old test-phase reset is ever run by hand: it is on the reset's keep list, because it is the copy a player would restore from.

## What a wipe does (only when the switch is turned on)

On the server (once per new build):
- cloud saves (every profile, every mode)
- tournaments: events, entries, catches, results, trophies and titles, Daily Survival runs
- rooms and live boards, friend requests, friend invite links, event invites
- rate-limit and strike counters, and each angler's temporary ban / "fishing now" state

On each device (the first time it opens the new build):
- every save slot (Expedition and Story with all three slots each, Recreational, Survival, Co-op, Tournament), their backup copies and the remembered open slot (`fac-ultra-slots`)
- cloud sync notes and the 7-day "other copy" backups
- tournament queues and the "Who's fishing today?" answer (it is asked again)

The player then sees once: "The game was updated for testing, so progress has been reset. Happy fishing!"

## What it keeps

- Accounts, sign-in sessions (people stay signed in), family profiles and their names
- The friend graph (who is friends with whom) and block lists
- Clear-my-data backups (`save_backups`) — a player's own safety net is never wiped
- Device settings: picture quality, sound and volume, motion, flash, colour-blind colours, Kid Mode, full-screen preference
- The anonymous player id and name on each device

The keep lists are two plain lists in `src/lib/test-phase.ts` (`WIPE_TABLES` / `KEEP_TABLES` for the server, `KEEP_KEYS` for browsers). A test fails if a new table is not put on one of them.

## How it works (short)

Each build gets an "epoch" (commit + build time) stamped by `scripts/build-epoch.mjs` during `npm run build`. The server remembers the last epoch it saw (table `app_state`); when it differs **and the switch is on**, it wipes in one step and logs `[test-phase] New build ...`. The browser does the same with `localStorage["fac-ultra-epoch"]` before it loads any save. An old tab left open learns about the new build from `GET /api/epoch` and reloads once; the cloud refuses a push from an older build. Dev servers (`npm run dev`) and tests always use the epoch `dev`, so nothing wipes on a hot reload. (`FAC_TEST_RESET_EPOCH` forces an epoch: at build time for the stamped build; on a dev server it changes the server only.)

A brand-new server database (no remembered epoch) just stores its first epoch; with the switch off nothing is wiped and nothing is logged. A browser seeing its very first build just remembers it, silently.

If the switch is off, nothing is wiped and the remembered epoch is left alone. Switching it back on later wipes once on the next new build.

## Before real launch (checklist)

1. ✅ Done in the code: `TEST_PHASE_RESET = false` in `src/lib/test-phase.ts`, and the hub sets `FAC_TEST_RESET=0`. Confirm the "Testing build" line is gone from Settings.
2. Do **not** set `FAC_TEST_RESET=1` on a server with real players: the next build would wipe their progress.
3. Take a database backup (Neon: a branch or snapshot) before the first real launch.
4. Decide whether to wipe the test accounts and friend lists once by hand (the reset keeps them on purpose).
5. Check the server log of the first launch build does not show a `[test-phase] New build ...` line.
6. Tell testers their progress will no longer reset — and that they can clear their own profile whenever they want, with a 24-hour backup.
