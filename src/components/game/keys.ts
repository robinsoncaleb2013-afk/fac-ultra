import { useEffect } from "react";
import { takePhoto } from "@/components/game/photo";
import { MODES } from "@/game/modes";
import { toggleFullscreen } from "@/components/game/fullscreen";
import { useHubUi } from "@/game/hubstate";
import { tabsForMode } from "@/game/hubnav";
import { act, nudgeDrag, partnerDown, partnerUp, reelDown, reelUp, sim, useGame } from "@/game/engine";

/** Desktop keyboard (03 §8, 04 §5.2, WP-10): Space/Enter act (hold to reel), 1–9 open the menu at a tab, Esc opens or closes the
    menu, F full screen, H, M, J (partner), [ and ] for drag during a fight, K and R to keep or release the fish just landed,
    P to take a picture. Hold Tab for the quick wheel (lures and emotes) and hold B for the satchel (catch and tackle). While the
    menu is open it reads the keys itself (Hub.tsx), so nothing here fires underneath it. */
export function useKeys() {
  useEffect(() => {
    const onUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "Enter") reelUp();
      else if (event.code === "KeyJ") partnerUp();
    };
    const onKey = (event: KeyboardEvent) => {
      const state = useGame.getState();
      const target = event.target as HTMLElement | null;
      const typing = !!target?.closest("input, textarea, select");
      if (state.screen === "game" && state.photo && !event.repeat) {
        useGame.setState({ photo: false });
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      /* Full screen works everywhere, including the title screen and the menu. */
      if (event.code === "KeyF") {
        if (!event.repeat) void toggleFullscreen();
        return;
      }
      if (state.screen !== "game") return;
      const hub = useHubUi.getState();
      if (hub.open) return;
      if (event.code === "KeyJ" && MODES[state.mode].twoPlayer) {
        if (!event.repeat) partnerDown();
        return;
      }
      /* Hold Tab (quick wheel) or B (satchel); the wheel and satchel close themselves when the key comes up. */
      if (event.code === "Tab" || event.code === "KeyB") {
        event.preventDefault();
        if (!event.repeat && !state.celebration) {
          if (event.code === "Tab") hub.openWheel(undefined, true);
          else hub.openSatchel(true);
        }
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
        else if (hub.wheel) hub.closeWheel();
        else if (hub.satchel) hub.closeSatchel();
        else hub.openHub();
        return;
      }
      if (event.code === "KeyH") return void useGame.setState({ photo: true });
      if (event.code === "KeyP" && MODES[state.mode].photo) return void takePhoto();
      if (event.code === "KeyM") return void state.toggleSetting("sound");
      const digit = /^Digit([1-9])$/.exec(event.code);
      if (digit) {
        const id = tabsForMode(state.mode)[Number(digit[1]) - 1];
        if (id) hub.openHub(id);
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
