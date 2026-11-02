import { useEffect } from "react";
import { useGame } from "@/game/engine";
import { EMPTY_PAD, freshPad, keyAction, padEvents, type PadEvent, type PadMemory, type PadSnap } from "@/game/hubnav";
import { useHubUi } from "@/game/hubstate";
import { closeHub, currentTabs, hubBack, hubMove, hubSelect, hubTab } from "@/components/game/hub/actions";

/** Keyboard and gamepad for the Hub. Mounted once; does nothing while the menu is closed except watch for a gamepad. */
export function HubKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const hub = useHubUi.getState();
      if (!hub.open) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t?.closest("input, textarea, select");
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Escape") {
        e.preventDefault();
        /* Handled here: the game's own Esc (which opens the menu) must not see the same key press and open it again. */
        e.stopImmediatePropagation();
        if (typing) return void (t as HTMLElement).blur();
        return void hubBack();
      }
      if (typing) return;
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (digit) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const id = currentTabs()[Number(digit[1]) - 1];
        if (id) (hub.tab === id ? closeHub : () => hub.setTab(id))();
        return;
      }
      const action = keyAction(e.code);
      if (!action) return;
      /* Enter and Space press the focused button natively; we only step in when nothing is focused. */
      const onButton = !!t?.closest("button, a, [role=button]");
      if (action === "select") {
        if (onButton) return;
        e.preventDefault();
        return void hubSelect();
      }
      e.preventDefault();
      if (e.repeat && (action === "prevTab" || action === "nextTab")) return;
      if (action === "prevTab") return void hubTab(-1);
      if (action === "nextTab") return void hubTab(1);
      if (action === "back" || action === "close") return void hubBack();
      hubMove(action);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  /* Gamepad: poll only while one is plugged in. */
  useEffect(() => {
    let raf = 0;
    let mem: PadMemory = freshPad();
    let pads = 0;
    const snap = (): PadSnap => {
      const list = navigator.getGamepads?.() ?? [];
      const pad = [...list].find((p) => p && p.connected);
      if (!pad) return EMPTY_PAD;
      return { buttons: pad.buttons.map((b) => b.pressed), axes: [...pad.axes] };
    };
    const apply = (ev: PadEvent) => {
      const hub = useHubUi.getState();
      const state = useGame.getState();
      if (ev === "toggleHub") {
        if (state.screen === "menu" && !hub.open) return void hub.openHub("play");
        return void (hub.open ? closeHub() : hub.openHub());
      }
      if (ev === "wheelDown") return state.screen === "game" && !hub.open ? hub.openWheel(undefined, true) : undefined;
      if (ev === "wheelUp") return void (hub.wheel?.held && hub.closeWheel());
      if (ev === "satchelDown") return state.screen === "game" && !hub.open ? hub.openSatchel(true) : undefined;
      if (ev === "satchelUp") return void (hub.satchel?.held && hub.closeSatchel());
      if (!hub.open) return;
      if (ev === "prevTab") return void hubTab(-1);
      if (ev === "nextTab") return void hubTab(1);
      if (ev === "select") return void hubSelect();
      if (ev === "close" || ev === "back") return void hubBack();
      hubMove(ev);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const next = snap();
      const r = padEvents(mem, next, now);
      mem = r.mem;
      for (const ev of r.events) apply(ev);
    };
    const start = () => {
      pads++;
      useHubUi.getState().setPad(true);
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      pads = Math.max(0, pads - 1);
      if (!pads && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    if ([...(navigator.getGamepads?.() ?? [])].some((p) => p?.connected)) start();
    window.addEventListener("gamepadconnected", start);
    window.addEventListener("gamepaddisconnected", stop);
    return () => {
      window.removeEventListener("gamepadconnected", start);
      window.removeEventListener("gamepaddisconnected", stop);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
