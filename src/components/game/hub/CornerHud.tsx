import { BIOMES, dexCount, money, rankName, TOTAL_SPECIES, xpNeed } from "@/game/content";
import { useGame } from "@/game/engine";
import { useHubUi } from "@/game/hubstate";
import { moneyWords } from "@/game/kid";
import { MODES, showsMoney } from "@/game/modes";
import { resolveSpot, spotsOf } from "@/game/spots";
import { SurvivalHud } from "@/components/game/survival";
import { FullscreenButton } from "@/components/game/fullscreen";
import { Painting } from "@/components/game/hub/art";
import { Icon } from "@/components/game/hub/icons";
import { cn } from "@/lib/cn";

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/45" role="img" aria-label={label} title={label}>
      <div className="h-full bg-brass" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

const round = "pointer-events-auto grid size-11 place-items-center rounded-full border border-white/25 bg-black/40 text-[#fff4d6] backdrop-blur-sm hover:border-brass";

/** The small always-there HUD: two thin bars, cash, a postage-stamp map, and the buttons for the menu, wheel, satchel and full screen.
    `compact` is the phone version (a thin top strip, the map left out). */
export function CornerHud({ compact = false, className }: { compact?: boolean; className?: string }) {
  const lv = useGame((s) => s.lv);
  const xp = useGame((s) => s.xp);
  const coins = useGame((s) => s.c);
  const dex = useGame((s) => dexCount(s.dex));
  const mode = useGame((s) => s.mode);
  const biome = useGame((s) => s.biome);
  const lastSpot = useGame((s) => s.lastSpot);
  const rules = MODES[mode];
  const cash = showsMoney(rules) ? money(coins) : "";
  const openHub = useHubUi((s) => s.openHub);
  const openWheel = useHubUi((s) => s.openWheel);
  const openSatchel = useHubUi((s) => s.openSatchel);
  const here = resolveSpot(biome, lastSpot[biome]);

  return (
    <header className={cn("safe-top safe-x pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start gap-3 p-2", className)}>
      <button type="button" data-testid="open-menu" onClick={() => openHub()} onPointerDown={(e) => e.stopPropagation()} aria-label="Menu" className={cn(round, "w-auto gap-2 px-4")}>
        <span className="flex items-center gap-2">
          <Icon name="menu" className="size-5" />
          <span className="font-serif text-base">Menu</span>
        </span>
      </button>
      <div className="min-w-0 pt-0.5 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]">
        {rules.survival ? (
          <SurvivalHud compact />
        ) : (
          <>
            <p className="flex items-center gap-2 text-xs text-fg">
              <span className="font-serif text-sm">Lv {lv}</span>
              <span className="hidden sm:inline">{rankName(lv)}</span>
              {cash ? (
                <span className="font-serif text-lg leading-none text-brass" title={moneyWords(coins)}>
                  {cash}
                </span>
              ) : null}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Bar pct={(xp / xpNeed(lv)) * 100} label={`Level ${lv} progress`} />
              <Bar pct={(dex / TOTAL_SPECIES) * 100} label={`${dex} of ${TOTAL_SPECIES} fish found`} />
            </div>
          </>
        )}
      </div>
      <div className="ml-auto flex items-start gap-2">
        {!compact ? (
          <button
            type="button"
            onClick={() => openHub("waters")}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Map of ${BIOMES[biome].name}`}
            title={`${BIOMES[biome].name}: open the map`}
            className="pointer-events-auto hidden overflow-hidden rounded-xl border-2 border-[#caa45a]/70 shadow-[0_2px_8px_rgb(0_0_0/0.5)] md:block"
          >
            <Painting id={BIOMES[biome].id} className="h-[68px] w-[112px]" focus="50% 50%">
              {spotsOf(biome).map((sp) => (
                <span
                  key={sp.id}
                  className={cn("absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#fff4d6]", sp.id === here.id ? "bg-[#ff6b3d]" : "bg-[#d79a2c]")}
                  style={{ left: `${sp.x * 100}%`, top: `${sp.y * 100}%` }}
                />
              ))}
            </Painting>
          </button>
        ) : null}
        <button type="button" data-testid="open-wheel" onClick={() => openWheel(undefined, false)} onPointerDown={(e) => e.stopPropagation()} aria-label="Quick wheel: lures and emotes" title="Quick wheel (hold Tab)" className={round}>
          <Icon name="wheel" className="size-5" />
        </button>
        <button type="button" data-testid="open-satchel" onClick={() => openSatchel(false)} onPointerDown={(e) => e.stopPropagation()} aria-label="Satchel: catch and tackle" title="Satchel (hold B)" className={round}>
          <Icon name="satchel" className="size-5" />
        </button>
        <FullscreenButton />
      </div>
    </header>
  );
}
