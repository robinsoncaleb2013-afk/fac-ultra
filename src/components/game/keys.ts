import { useEffect } from "react";
import { act, assistTap, useGame, type Tab } from "@/game/engine";

const NUMBER_TABS: Tab[] = ["cast", "bag", "gear", "lures", "waters", "dex", "lodge"];

export function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  } catch {
    /* not allowed here */
  }
}

/** Desktop keyboard (03 §8): Space/Enter act, 1–7 tabs, Esc, F, H, M, J. */
export function useKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = useGame.getState();
      if (state.screen !== "game") return;
      const target = event.target as HTMLElement | null;
      const typing = !!target?.closest("input, textarea, select");
      if (state.photo && !event.repeat) {
        useGame.setState({ photo: false });
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "KeyJ" && state.mode === "coop") {
        if (!event.repeat) assistTap();
        return;
      }
      if (event.repeat) return;
      if (event.code === "Escape") {
        if (state.celebration) state.dismissCelebration();
        else if (state.tab !== "cast") state.setTab("cast");
        return;
      }
      if (event.code === "KeyF") return void toggleFullscreen();
      if (event.code === "KeyH") return void useGame.setState({ photo: true });
      if (event.code === "KeyM") return void state.toggleSetting("sound");
      const digit = /^Digit([1-7])$/.exec(event.code);
      if (digit) {
        const id = NUMBER_TABS[Number(digit[1]) - 1];
        state.setTab(state.tab === id && id !== "cast" ? "cast" : id);
        return;
      }
      if (event.code !== "Space" && event.code !== "Enter") return;
      if (target?.closest("button, a") && !target.closest("[data-cast]")) return;
      event.preventDefault();
      if (state.celebration) state.dismissCelebration();
      act();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
