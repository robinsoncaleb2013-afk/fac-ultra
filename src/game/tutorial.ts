/* Guided voice tutorial (Update Three, P1).

   The first-run teacher: a short, ordered list of steps that shows a new
   player how to cast, reel, open a pack and stock the tank. The steps with
   an `action` are interactive — the player has to DO the thing, and tapping
   Next does not skip past them. The steps without one are narration and
   move on with Next.

   Pure state machine: no store, no browser, no timers. The engine and the
   overlay (components/game/TutorialOverlay.tsx) drive it: the overlay
   shows `currentStep`, the engine calls `advance` when the player really
   reels a fish in, opens a pack or adds a fish to the tank, and finishing
   (or skipping) is what sets `save.tutored = true` in the engine.

   The one browser touch is `speak`, a fully guarded wrapper over
   `window.speechSynthesis` in the same spirit as the Kid Mode reader
   (components/game/use-kid.ts): a no-op with no window, no voice support,
   or sound off, so it is safe to call from tests and from the server. */

import { BIOMES } from "./content.ts";
import { SPEECH_RATE } from "./kid.ts";

/** The things a player can be asked to DO. `"next"` is not one of them:
    narration moves on `"next"`, doing moves on its own action only. */
export type TutorialAction = "reel" | "pack" | "tank";

/** Everything `advance` understands: `"next"` for narration, or a doing. */
export type TutorialEvent = "next" | TutorialAction;

export type TutorialStep = {
  /** Stable name of the step (progress, tests, telemetry). Never shown. */
  id: string;
  /** Player-facing words: plain English, one or two short sentences. */
  text: string;
  /** Set only on the steps the player must PERFORM. While a step has an
      action, `"next"` does nothing — only that action moves on. */
  action?: TutorialAction;
};

/** The teaching order. Cast and the wait are told, then the three doings —
    reel a fish in, open a pack, put a fish in the tank — then the send-off. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "welcome",
    text: "Welcome to Fish and Collect! Catch fish, earn coins, and fill your fish book.",
  },
  {
    id: "cast",
    text: "Tap Cast to throw your line in the water. Watch the bobber float.",
  },
  {
    id: "bite",
    text: "Wait for a bite. When the bobber splashes, tap fast to hook the fish.",
  },
  {
    id: "reel",
    text: "Reel in your first fish! Hold Reel while the mark is in the green, and let go when it turns red.",
    action: "reel",
  },
  {
    id: "pack",
    text: "Great catch! Open a pack in Tackle to find new gear.",
    action: "pack",
  },
  {
    id: "tank",
    text: "Put a fish in your tank. Open the Lodge, pick a fish you caught, and tap Add.",
    action: "tank",
  },
  {
    id: "done",
    text: "You did it! Keep casting to find new fish, earn coins, and grow your tank.",
  },
];

/** Where the player is in the tutorial. `index` is the step showing;
    `done` is true once the last step has been finished (or skipped). */
export type TutorialState = {
  index: number;
  done: boolean;
};

/** A fresh tutorial, on the first step. */
export function startTutorial(): TutorialState {
  return { index: 0, done: false };
}

/** The step to show right now, or null once the tutorial is finished. */
export function currentStep(state: TutorialState): TutorialStep | null {
  if (!state || state.done) return null;
  return TUTORIAL_STEPS[state.index] ?? null;
}

/** True once the tutorial has been finished or skipped. A state built by
    hand with its index past the end counts as done too. */
export function isTutorialDone(state: TutorialState): boolean {
  if (!state) return true;
  return state.done || state.index >= TUTORIAL_STEPS.length;
}

/**
 * Move the tutorial on. Pure: the input state is never changed.
 *
 * - A narration step (no `action`) moves on `"next"` only.
 * - An interactive step (with an `action`) moves on that action only.
 *   `"next"` — and any other action — leave it exactly where it is.
 * - Moving on from the last step finishes the tutorial.
 * - A finished tutorial never moves again.
 */
export function advance(state: TutorialState, event: TutorialEvent): TutorialState {
  if (isTutorialDone(state)) return state;
  const step = currentStep(state);
  if (!step) return { index: TUTORIAL_STEPS.length, done: true };
  const moves = step.action ? event === step.action : event === "next";
  if (!moves) return state;
  const index = state.index + 1;
  return index >= TUTORIAL_STEPS.length ? { index, done: true } : { index, done: false };
}

/** Skip the whole tutorial: finished, wherever the player was. The engine
    treats a skip exactly like a finish (it sets `save.tutored = true`). */
export function skipTutorial(state: TutorialState): TutorialState {
  void state;
  return { index: TUTORIAL_STEPS.length, done: true };
}

/* ── The guaranteed first catch ──────────────────────────────────────────
   While the tutorial is running, a brand-new player's first fish is not
   left to the dice: it is always the Bluegill, the first fish of the
   first water (Pond). The engine asks `shouldForceFirstCatch` at the bite
   and, when it says yes, deals this fish instead of the rolled one. */

/** Biome index and species index of the tutorial's first catch. */
export const TUTORIAL_FIRST_CATCH = { biome: 0, species: 0 } as const;

/** "Bluegill" — read from the content table so it can never drift. */
export const TUTORIAL_FIRST_CATCH_NAME: string = BIOMES[TUTORIAL_FIRST_CATCH.biome].fish[TUTORIAL_FIRST_CATCH.species];

/** The save-shaped facts the first-catch rule needs. */
export type FirstCatchInput = {
  /** The guided tutorial is finished (Save.tutored). */
  tutored: boolean;
  /** Lifetime fish caught (Save.caught). */
  caught: number;
  /** The tutorial overlay is running right now. */
  tutorialActive: boolean;
};

/**
 * Should this bite be forced to the tutorial's first catch? Only while
 * the tutorial is active, only for a player who has not finished it, and
 * only when they have never caught anything — the very first catch.
 */
export function shouldForceFirstCatch(input: FirstCatchInput): boolean {
  return !!input && !input.tutored && input.caught === 0 && input.tutorialActive;
}

/* ── Reading the steps aloud ───────────────────────────────────────────── */

export type SpeakOptions = {
  /** The game's sound setting (Save.sound), passed in by the caller.
      Voice is on unless this is exactly `false`. */
  soundOn?: boolean;
  /** Muted wins over everything: no voice while muted. */
  muted?: boolean;
  /** Words per the Kid Mode pace by default (kid.ts SPEECH_RATE). */
  rate?: number;
};

/** Is there a voice to read with on this device, right now? */
export function canSpeak(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * Read `text` aloud with the system voice. Fully guarded: no window, no
 * speech support, empty text, sound off or muted all make it a quiet
 * no-op, so callers never have to check first. Like the Kid Mode reader,
 * it cancels whatever was being said before it starts.
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!text || !text.trim()) return;
  if (opts.soundOn === false || opts.muted) return;
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts.rate ?? SPEECH_RATE;
    window.speechSynthesis.speak(u);
  } catch {
    /* no voice available */
  }
}

/** Stop any voice in progress (the player skipped, or the card closed). */
export function stopSpeaking(): void {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* no voice available */
  }
}
