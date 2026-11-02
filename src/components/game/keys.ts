import { useEffect } from "react";
import { takePhoto } from "@/components/game/photo";
import { MODES } from "@/game/modes";
import { tabsFor } from "@/components/game/tabs";
import { act, nudgeDrag, partnerDown, partnerUp, reelDown, reelUp, sim, useGame } from "@/game/engine";


export function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  } catch {
    /* not allowed here */
  }
}

/** Desktop keyboard (03 §8, 04 §5.2): Space/Enter act (hold to reel), 1–7 tabs, Esc, F, H, M, J (partner),
    [ and ] for drag during a fight, K and R to keep or release the fish just landed, P to take a picture. */
export function useKeys() {
  useEffect(() => {
    const onUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "Enter") reelUp();
      else if (event.code === "KeyJ") partnerUp();
    };
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
      if (event.code === "KeyJ" && MODES[state.mode].twoPlayer) {
        if (!event.repeat) partnerDown();
        return;
      }
      if (event.repeat) return;
      if (event.code === "BracketLeft" || event.code === "BracketRight") {
        return void nudgeDrag(event.code === "BracketLeft" ? -1 : 1);
      }
      if (state.celebration && (event.code === "KeyK" || event.code === "KeyR")) {
        if (event.code === "KeyK") state.keepCatch();
        else state.releaseCatch();
        return;
      }
      if (event.code === "Escape") {
        if (state.celebration) state.dismissCelebration();
        else if (state.tab !== "cast") state.setTab("cast");
        return;
      }
      if (event.code === "KeyF") return void toggleFullscreen();
      if (event.code === "KeyH") return void useGame.setState({ photo: true });
      if (event.code === "KeyP" && MODES[state.mode].photo) return void takePhoto();
      if (event.code === "KeyM") return void state.toggleSetting("sound");
      const digit = /^Digit([1-7])$/.exec(event.code);
      if (digit) {
        const id = tabsFor(state.mode)[Number(digit[1]) - 1]?.id;
        if (!id) return;
        state.setTab(state.tab === id && id !== "cast" ? "cast" : id);
        return;
      }
      if (event.code !== "Space" && event.code !== "Enter") return;
      if (target?.closest("button, a") && !target.closest("[data-cast]")) return;
      event.preventDefault();
      if (state.celebration) state.dismissCelebration();
      /* In the fight the key is the reel: held down it reels, up it gives line. */
      if (sim.phase === "reel") reelDown();
      else act();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", reelUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", reelUp);
    };
  }, []);
}
