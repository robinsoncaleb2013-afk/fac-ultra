/* TEST PHASE: while the game is in development, every new build wipes all progress and saves, so testers
   always start fresh and old test data can never break a new build. See docs/TEST-PHASE.md.

   This file holds the ONE master switch and the two "what is kept" lists. Pure: no network, no storage.
   Server code (src/lib/test-reset.server.ts) and browser code (src/game/epoch-gate.ts) both import it. */

import { BUILD_EPOCH, BUILD_SWITCH } from "./build-epoch.generated.ts";

/* ─────────────────────────────────────────────────────────────────────────────────────────────────
   THE MASTER SWITCH.  true  = every new build resets progress and saves (the testing default).
                       false = nothing is ever reset (what real players need).
   Before real launch: set this to false (and/or set FAC_TEST_RESET=0 on the server), then follow the
   checklist in docs/TEST-PHASE.md.  Setting FAC_TEST_RESET=0 or =1 overrides this constant without a
   code change. */
export const TEST_PHASE_RESET = true;
/* ───────────────────────────────────────────────────────────────────────────────────────────────── */

/** Read an on/off word. Anything unrecognised (or blank) is "not set". */
export function parseSwitch(v: string | null | undefined): boolean | null {
  const t = (v ?? "").trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(t)) return false;
  if (["1", "true", "on", "yes"].includes(t)) return true;
  return null;
}

/** Is the reset switch ON? The environment (FAC_TEST_RESET) beats the constant; a value stamped at build time
    comes next. `env` is process.env on the server; the browser passes nothing and asks the server instead. */
export function resetSwitchOn(env: Record<string, string | undefined> = {}): boolean {
  return parseSwitch(env.FAC_TEST_RESET) ?? BUILD_SWITCH ?? TEST_PHASE_RESET;
}

/** Is this a development server / test run (not a stamped build)? */
function isDev(): boolean {
  const meta = import.meta as unknown as { env?: { DEV?: boolean } };
  return meta.env?.DEV === true;
}

/** The build epoch: a label that changes on every new build. Dev servers and tests keep a fixed "dev" so they
    never wipe on a hot reload; FAC_TEST_RESET_EPOCH (server, development only) forces a value for testing. */
export function currentEpoch(env: Record<string, string | undefined> = {}): string {
  const forced = (env.FAC_TEST_RESET_EPOCH ?? "").trim();
  if (isDev()) return forced || "dev";
  return BUILD_EPOCH;
}

export type EpochVerdict = "first" | "same" | "reset" | "off";

/** The one decision, used by both sides.
    first = nothing stored yet (a brand-new database or device): just remember the epoch, no wipe, no notice.
    same  = already on this build: nothing to do.
    reset = a different build and the switch is ON: wipe progress, remember the new epoch.
    off   = a different build but the switch is OFF: do nothing at all (the stored epoch is left alone). */
export function decideEpoch(stored: string | null | undefined, current: string, on: boolean): EpochVerdict {
  if (!on) return "off";
  if (!stored) return "first";
  return stored === current ? "same" : "reset";
}

/* ── What a reset keeps (change these lists to change the behaviour) ───────────────────────────── */

/** Server tables that are WIPED by a reset: progress, saves, tournaments, rooms, rate limits, invites. */
export const WIPE_TABLES: readonly string[] = [
  "saves",
  "events",
  "entries",
  "catches",
  "survival_runs",
  "results",
  "event_final",
  "rooms",
  "signals",
  "invites",
  "friend_requests",
  "friend_invites",
  "rate_hits",
  "acct_hits",
];

/** Server tables that are KEPT: identities and the friend graph (listed so a new table must be placed on a list).
    `players` is kept but its temporary state (ban, last seen, current event) is cleared. */
export const KEEP_TABLES: readonly string[] = ["accounts", "sessions", "magic_links", "oauth_states", "profiles", "players", "friends", "blocks", "app_state"];

/** Browser keys that are KEPT (exact names). Everything else the game stores is progress and is wiped. */
export const KEEP_KEYS: readonly string[] = [
  "fac-ultra-device", // graphics level, sound, volume, motion, colour-blind palette, Kid Mode
  "fac-ultra-fs-landscape", // full-screen preference
  "fac-ultra-blocked-names", // names this device blocked
  "fac-ultra-sessions", // visit counter for the Home Screen hint
  "fac-ultra-a2hs-dismissed", // Home Screen hint dismissed
  "fac-player-id", // anonymous player identity (the server keeps it too)
  "fac-player-name",
  "fac-ultra-epoch", // the build this device last saw
  "fac-ultra-epoch-notice", // "progress was reset" notice waiting to be read
];

/** Browser keys that START with one of these belong to the game, so a reset wipes them unless kept above. */
export const GAME_KEY_PREFIXES: readonly string[] = ["fac-ultra", "facultra", "fac-cloud", "fac-tourney-queue"];

export const isGameKey = (k: string): boolean => GAME_KEY_PREFIXES.some((p) => k.startsWith(p));
/** Which of these browser keys does a reset delete? */
export const keysToWipe = (all: readonly string[]): string[] => all.filter((k) => isGameKey(k) && !KEEP_KEYS.includes(k));

export const EPOCH_KEY = "fac-ultra-epoch";
export const NOTICE_KEY = "fac-ultra-epoch-notice";
export const NOTICE_TEXT = "The game was updated for testing, so progress has been reset. Happy fishing!";
export const TESTING_LINE = "Testing build — progress resets on every update";
