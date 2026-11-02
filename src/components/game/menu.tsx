import { useRef, useState } from "react";
import { Anchor, Fish, HandHelping, Swords, Timer, Users, Waves } from "lucide-react";
import { BIOMES, dexCount, rankName, TOTAL_SPECIES } from "@/game/content";
import type { LayoutPlan } from "@/game/device";
import { useGame } from "@/game/engine";
import { Stage } from "@/components/game/stage";
import { cn } from "@/lib/cn";

type G = ReturnType<typeof useGame.getState>;
const MODE_CARDS: {
  id: string;
  title: string;
  blurb: string;
  icon: typeof Fish;
  run: (g: G) => void;
  lock?: (g: G) => string | null;
}[] = [
  { id: "expedition", title: "Expedition", blurb: "The career: money, gear, contracts, stages, bosses, rebirth.", icon: Fish, run: (g) => g.switchMode("career") },
  {
    id: "aquarium", title: "The Aquarium", blurb: "Exhibit your best fish. They earn while you sleep.", icon: Waves,
    run: (g) => (g.switchMode("career"), g.setLodgeView("tank")),
  },
  { id: "sandbox", title: "Sandbox — Zen Waters", blurb: "Everything unlocked, nothing to sell, calmer water. Its own dex.", icon: Anchor, run: (g) => g.switchMode("sandbox") },
  { id: "local", title: "Local Co-op", blurb: "Two anglers, one screen, one shared ledger. Player 2 assists the reel with J.", icon: HandHelping, run: (g) => g.switchMode("coop") },
  {
    id: "online", title: "Online Co-op", blurb: "Room-code fishing with friends — shared water and weather, live catch feed.", icon: Users,
    run: (g) => (g.switchMode("career"), g.setLodgeView("crew")),
  },
  {
    id: "derby", title: "Derby", blurb: "Ten minutes, three rivals, most value wins the purse.", icon: Timer,
    run: (g) => (g.switchMode("career"), g.setLodgeView("derby")),
    lock: (g) => (g.derby ? "A derby is already running." : null),
  },
  {
    id: "rush", title: "Boss Rush", blurb: "Every boss you've beaten, back to back, against the clock.", icon: Swords,
    run: (g) => (g.switchMode("career"), g.setLodgeView("derby")),
    lock: (g) => (g.bosses < 3 ? `Beat 3 bosses to unlock (${g.bosses}/3).` : null),
  },
];

const LAST = "fac-ultra-last-mode";
function lastPlayed(): string | null {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
}

/** The main menu: the current water, alive, behind the mode cards. */
export function MainMenu({ plan }: { plan: LayoutPlan }) {
  const dex = useGame((s) => dexCount(s.dex));
  const lv = useGame((s) => s.lv);
  const ub = useGame((s) => s.ub);
  const biome = useGame((s) => s.biome);
  const hydrated = useGame((s) => s.hydrated);
  const [preview, setPreview] = useState<number | null>(null);
  const touch = useRef(0);
  const g = useGame.getState();
  const last = lastPlayed();
  const mobile = plan.kind === "mobile";
  const cards = mobile && last ? [...MODE_CARDS].sort((a, b) => Number(b.id === last) - Number(a.id === last)) : MODE_CARDS;
  const shown = preview ?? biome;
  /* Swipe the painting to preview another unlocked water (cosmetic only). */
  const swipe = (dx: number) => {
    if (Math.abs(dx) < 50) return;
    const step = dx < 0 ? 1 : -1;
    const list = ub.length ? ub : [0];
    const i = Math.max(0, list.indexOf(shown));
    setPreview(list[(i + step + list.length) % list.length]);
  };

  const card = (c: (typeof MODE_CARDS)[number]) => {
    const Icon = c.icon;
    const locked = hydrated ? c.lock?.(g) : null;
    return (
      <button
        key={c.id}
        type="button"
        disabled={!!locked}
        onClick={() => {
          try {
            localStorage.setItem(LAST, c.id);
          } catch {
            /* private mode */
          }
          c.run(useGame.getState());
        }}
        className={cn(
          "flex rounded-2xl border border-line bg-bg/75 text-left backdrop-blur-md enabled:hover:border-brass disabled:opacity-50",
          mobile ? "min-h-16 items-center gap-3 px-4 py-2" : "min-h-24 shrink-0 flex-col justify-between p-4",
          !mobile && plan.railCollapsed && "w-60",
        )}
      >
        <span className="flex items-center gap-2">
          <Icon className="size-5 shrink-0 text-brass" aria-hidden />
          <span className="font-serif text-lg">{c.title}</span>
        </span>
        <span className={cn("text-sm text-muted", mobile ? "line-clamp-1 hidden" : "mt-1")}>{locked ?? c.blurb}</span>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-bg"
      onTouchStart={(e) => {
        touch.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => swipe(e.changedTouches[0].clientX - touch.current)}
    >
      <Stage menu className="absolute inset-0" biomeOverride={shown} big={mobile} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-bg/30" />
      {mobile ? (
        <div className="safe-top safe-x absolute inset-0 flex flex-col overflow-y-auto px-3 pb-4">
          <div className="shrink-0 pt-2 pb-6">
            <h1 className="font-serif text-4xl leading-none">FAC Ultra</h1>
            <p className="mt-2 text-sm text-fg/80">
              {rankName(lv)} · Lv {lv} · {dex}/{TOTAL_SPECIES} species
            </p>
            <p className="text-xs text-fg/60">{BIOMES[shown].name} · swipe to look at other waters</p>
          </div>
          <div className="mt-auto flex flex-col gap-2 pt-40">{cards.map(card)}</div>
          <p className="px-2 pt-3 text-center text-xs text-muted">Progress saves in this browser, one ledger per mode.</p>
        </div>
      ) : (
        <div className="safe-x absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6">
          <div>
            <h1 className="font-serif text-5xl leading-none">FAC Ultra</h1>
            <p className="mt-2 text-sm text-fg/80">
              {rankName(lv)} · Lv {lv} · {dex}/{TOTAL_SPECIES} species · Fifteen waters, fifteen bosses
            </p>
          </div>
          <div
            className={cn(
              plan.railCollapsed ? "flex gap-2 overflow-x-auto pb-1" : "grid grid-cols-4 gap-2 2xl:grid-cols-7",
            )}
          >
            {MODE_CARDS.map(card)}
          </div>
          <p className="text-xs text-muted">
            Progress saves in this browser, one ledger per mode. Export a save code from Lodge → Settings to carry it
            anywhere.
          </p>
        </div>
      )}
    </div>
  );
}
