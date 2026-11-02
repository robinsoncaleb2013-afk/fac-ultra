import { Menu as MenuIcon } from "lucide-react";
import { dexCount, money, rankName, TOTAL_SPECIES, xpNeed } from "@/game/content";
import { useGame } from "@/game/engine";
import { moneyWords } from "@/game/kid";
import { MODES, showsMoney } from "@/game/modes";
import { cn } from "@/lib/cn";

function useHud() {
  const coins = useGame((s) => s.c);
  const lv = useGame((s) => s.lv);
  const xp = useGame((s) => s.xp);
  const dex = useGame((s) => dexCount(s.dex));
  const mode = useGame((s) => s.mode);
  const rules = MODES[mode];
  const cash = showsMoney(rules) ? money(coins) : "";
  return { coins, lv, xp, dex, rules, cash, words: moneyWords(coins), pct: Math.min(100, (xp / xpNeed(lv)) * 100) };
}

/** Desktop: floating 56 px bar over the water, fading to nothing. */
export function HudBar({ left }: { left: number }) {
  const h = useHud();
  const setScreen = useGame((s) => s.setScreen);
  const modeLabel = h.rules.title;
  return (
    <header
      style={{ paddingLeft: left + 12 }}
      className="safe-x pointer-events-none absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-gradient-to-b from-bg/80 to-transparent pr-4"
    >
      <div className="pointer-events-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setScreen("menu")}
          aria-label="Back to main menu"
          className="grid size-11 place-items-center rounded-xl text-muted hover:text-fg"
        >
          <MenuIcon className="size-5" aria-hidden />
        </button>
        <div>
          <p className="font-serif text-lg leading-none [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">FAC Ultra</p>
          <p className="mt-1 text-xs text-fg/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
            {rankName(h.lv)} · Lv {h.lv} · {modeLabel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-right">
        <p className="text-xs text-fg/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
          {h.dex}/{TOTAL_SPECIES}
        </p>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" title={`Level ${h.lv}`}>
          <div className="h-full bg-brass" style={{ width: `${h.pct}%` }} />
        </div>
        {h.cash ? (
          <p className="font-serif text-2xl leading-none text-brass" title={h.words}>
            {h.cash}
          </p>
        ) : null}
      </div>
    </header>
  );
}

/** Phone: 44 px bar over the water: money, level bar, and the ☰ sheet button. */
export function HudBarMobile({ onMenu, className }: { onMenu: () => void; className?: string }) {
  const h = useHud();
  return (
    <header
      className={cn(
        "safe-x pointer-events-none absolute inset-x-0 top-0 z-30 flex h-11 items-center gap-3 bg-gradient-to-b from-bg/80 to-transparent pl-3",
        className,
      )}
    >
      {h.cash ? (
        <p className="font-serif text-xl leading-none text-brass" title={h.words}>
          {h.cash}
        </p>
      ) : null}
      <p className="text-xs text-fg">Lv {h.lv}</p>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-brass" style={{ width: `${h.pct}%` }} />
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onMenu}
        aria-label="Menu"
        className="pointer-events-auto ml-auto grid size-11 place-items-center text-fg"
      >
        <MenuIcon className="size-6" aria-hidden />
      </button>
    </header>
  );
}
