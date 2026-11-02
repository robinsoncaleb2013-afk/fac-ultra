import { useEffect } from "react";
import { BIOMES, LURES, money } from "@/game/content";
import { useGame } from "@/game/engine";
import { useHubUi } from "@/game/hubstate";
import { MODES, showsMoney } from "@/game/modes";
import { BagPanel } from "@/components/game/panels/BagPanel";
import { Icon } from "@/components/game/hub/icons";
import { DarkPanel } from "@/components/game/hub/panel-shell";

/** The satchel: hold B (or tap the bag in the corner) for a quick look at the catch and the tackle. Let go to put it away. */
export function Satchel() {
  const satchel = useHubUi((s) => s.satchel);
  const close = useHubUi((s) => s.closeSatchel);
  const openHub = useHubUi((s) => s.openHub);
  const lure = useGame((s) => s.lure);
  const coins = useGame((s) => s.c);
  const mode = useGame((s) => s.mode);
  const biome = useGame((s) => s.biome);
  useEffect(() => {
    if (!satchel) return;
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyB" && useHubUi.getState().satchel?.held) close();
    };
    const key = (e: KeyboardEvent) => e.code === "Escape" && close();
    window.addEventListener("keyup", up);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keyup", up);
      window.removeEventListener("keydown", key);
    };
  }, [satchel, close]);
  if (!satchel) return null;
  return (
    <div role="dialog" aria-label="Satchel" className="fixed inset-0 z-40 grid grid-cols-[minmax(0,1fr)] place-items-center p-4 text-[#f1e5c9]">
      <div className="hub-backdrop" onClick={close} />
      <div className="hub-in relative flex max-h-[85dvh] w-full min-w-0 max-w-xl flex-col">
        <div className="hub-wood flex items-center justify-between rounded-t-2xl border border-[#caa45a]/40 px-4 py-2">
          <p className="font-serif text-xl">Satchel</p>
          <p className="text-sm text-[#c9b890]">
            {BIOMES[biome].name} · {lure >= 0 ? LURES[lure].name : "no lure"}
            {showsMoney(MODES[mode]) ? ` · ${money(coins)}` : ""}
          </p>
          <button type="button" onClick={close} aria-label="Close satchel" className="grid size-11 place-items-center">
            <Icon name="close" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <DarkPanel label="Your catch" className="rounded-t-none">
            <BagPanel />
          </DarkPanel>
        </div>
        <button type="button" onClick={() => { close(); openHub("tackle"); }} className="hub-btn mt-2 self-center">
          Open tackle
        </button>
      </div>
    </div>
  );
}
