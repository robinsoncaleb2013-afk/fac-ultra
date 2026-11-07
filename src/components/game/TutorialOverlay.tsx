import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  currentStep,
  isTutorialDone,
  speak,
  stopSpeaking,
  TUTORIAL_STEPS,
  type TutorialAction,
  type TutorialState,
} from "@/game/tutorial";

/** What the card whispers under an interactive step: go and do it. Display copy only. */
const TRY_IT: Record<TutorialAction, string> = {
  reel: "Try it now — reel in a fish to keep going.",
  pack: "Try it now — open a pack in Tackle.",
  tank: "Try it now — add a fish to your tank.",
};

type Props = {
  /** The tutorial machine's state (src/game/tutorial.ts). The parent owns it. */
  state: TutorialState;
  /** Narration steps only: the player tapped Next. */
  onNext: () => void;
  /** The player tapped "Skip tutorial". The parent finishes the tutorial
      (and the engine sets save.tutored = true and saves). */
  onSkip: () => void;
  /** The game's sound setting (Save.sound). Steps are read aloud only when on. */
  soundOn: boolean;
};

/**
 * The guided tutorial card (Update Three, P1).
 *
 * Shows the current step's words, reads them aloud when the step changes
 * and sound is on, and offers Next only on narration steps — a step the
 * player must PERFORM has no Next button at all; only doing the thing
 * moves on (the engine calls the machine's `advance` for that).
 *
 * No game rules live here: this component reads the step the machine
 * gives it and reports taps back through its callbacks.
 *
 * The card sits at the bottom of the screen and never covers the water:
 * the frame around it lets taps through, so the player can cast, reel,
 * open Tackle and stock the tank while the card is up.
 */
export function TutorialOverlay({ state, onNext, onSkip, soundOn }: Props) {
  const step = currentStep(state);
  const stepId = step?.id;
  const stepText = step?.text;

  /* Read each new step aloud, once, when it arrives — if sound is on. */
  useEffect(() => {
    if (!stepText || !soundOn) return;
    speak(stepText, { soundOn });
  }, [stepId, stepText, soundOn]);

  if (!step || isTutorialDone(state)) return null;

  const total = TUTORIAL_STEPS.length;
  const number = Math.min(total, state.index + 1);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
      <section
        aria-label="Tutorial"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-brass bg-surface p-4 shadow-lg"
      >
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          Tutorial · Step {number} of {total}
        </p>
        <p className="mt-1 font-serif text-xl leading-snug">{step.text}</p>
        {step.action ? <p className="mt-1 text-sm text-brass">{TRY_IT[step.action]}</p> : null}
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            variant="quiet"
            className="min-h-11 px-3 py-2 text-sm"
            onClick={() => {
              stopSpeaking();
              onSkip();
            }}
          >
            Skip tutorial
          </Button>
          {step.action ? null : (
            <Button className="min-h-11 px-5 py-2" onClick={onNext}>
              {number === total ? "Finish" : "Next"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
