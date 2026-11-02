import { useEffect } from "react";
import { audio } from "@/game/audio";
import { useGame } from "@/game/engine";
import { kidActive, SPEECH_RATE } from "@/game/kid";
import { MODES } from "@/game/modes";

/** Kid Mode is in force: switched on, and the mode being played allows it (tournaments never do). */
export function useKidOn(): boolean {
  return useGame((s) => kidActive(s.kid, MODES[s.mode]));
}

/** The rules of the mode being played. */
export function useRules() {
  return useGame((s) => MODES[s.mode]);
}

/** Puts `data-kid` on <html> so the stylesheet can take text up one step (styles.css). */
export function useKidAttr() {
  const on = useKidOn();
  useEffect(() => {
    const root = document.documentElement;
    if (on) root.dataset.kid = "1";
    else delete root.dataset.kid;
    return () => {
      delete root.dataset.kid;
    };
  }, [on]);
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Read text aloud with the system voice, slightly slow. */
export function speak(text: string) {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = SPEECH_RATE;
    u.onstart = () => audio.duck(true);
    u.onend = () => audio.duck(false);
    u.onerror = () => audio.duck(false);
    window.speechSynthesis.speak(u);
  } catch {
    /* no voice available */
  }
}
