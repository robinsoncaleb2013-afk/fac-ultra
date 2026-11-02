import { useRef, useState } from "react";
import { Anchor, Fish, HandHelping, Smile, Swords, Tent, Timer, Users, Waves } from "lucide-react";
import { BIOMES, dexCount, rankName, TOTAL_SPECIES } from "@/game/content";
import type { LayoutPlan } from "@/game/device";
import { useGame } from "@/game/engine";
import { MENU_CARDS, orderCards, type MenuCard } from "@/game/modes";
import { Button } from "@/components/ui/button";
import { Stage } from "@/components/game/stage";
import { cn } from "@/lib/cn";

type G = ReturnType<typeof useGame.getState>;

/* The icon for each card. Titles, blurbs and the mode a card opens come from modes.ts. */
const ICONS: Record<string, typeof Fish> = {
  expedition: Fish,
  recreational: Anchor,
  survival: Tent,
  local: HandHelping,
  online: Users,
  aquarium: Waves,
  derby: Timer,
  rush: Swords,
};

/** Why a card cannot be opened right now, or null. */
function lockOf(c: MenuCard, g: G): string | null {
  if (c.id === "derby" && g.derby) return "A derby is already running.";
  if (c.needsBosses && g.bosses < c.needsBosses) return `Beat ${c.needsBosses} bosses to unlock (${g.bosses}/${c.needsBosses}).`;
  return null;
}

function open(c: MenuCard) {
  const g = useGame.getState();
  g.switchMode(c.mode);
  if (c.view) useGame.getState().setLodgeView(c.view);
}

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
  const cards = mobile ? orderCards(MENU_CARDS, last) : MENU_CARDS;
  const kid = useGame((s) => s.kid);
  const setKid = useGame((s) => s.setKid);
  const shown = preview ?? biome;
  /* Swipe the painting to preview another unlocked water (cosmetic only). */
  const swipe = (dx: number) => {
    if (Math.abs(dx) < 50) return;
    const step = dx < 0 ? 1 : -1;
    const list = ub.length ? ub : [0];
    const i = Math.max(0, list.indexOf(shown));
    setPreview(list[(i + step + list.length) % list.length]);
  };

  const card = (c: MenuCard) => {
    const Icon = ICONS[c.id] ?? Fish;
    const locked = hydrated ? lockOf(c, g) : null;
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
          open(c);
        }}
        className={cn(
          "flex rounded-2xl border border-line bg-bg/75 text-left backdrop-blur-md enabled:hover:border-brass disabled:opacity-50",
          mobile
            ? "h-16 shrink-0 items-center gap-3 px-4"
            : plan.railCollapsed
              ? "min-h-24 w-60 shrink-0 flex-col justify-between p-4"
              : "min-h-28 min-w-0 flex-col justify-between p-3",
        )}
      >
        {mobile ? (
          <>
            <Icon className="size-6 shrink-0 text-brass" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif text-lg leading-tight">{c.title}</span>
              <span className="block truncate text-xs text-muted">{locked ?? c.blurb}</span>
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2">
              <Icon className="size-5 shrink-0 text-brass" aria-hidden />
              <span className="font-serif text-lg">{c.title}</span>
            </span>
            <span className="mt-1 text-sm text-muted">{locked ?? c.blurb}</span>
          </>
        )}
      </button>
    );
  };

  const kidChip = (
    <button
      type="button"
      aria-pressed={kid}
      onClick={() => setKid(!kid)}
      className={cn(
        "pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm backdrop-blur-md",
        kid ? "border-brass bg-brass text-brass-ink" : "border-line bg-bg/75 text-fg",
      )}
    >
      <Smile className="size-4" aria-hidden />
      Kid Mode: {kid ? "On" : "Off"}
    </button>
  );

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
            <div className="mt-2">{kidChip}</div>
          </div>
          <div className="mt-auto flex flex-col gap-2 pt-40">{cards.map(card)}</div>
          <p className="px-2 pt-3 text-center text-xs text-muted">Progress saves in this browser, one ledger per mode.</p>
        </div>
      ) : (
        <div className="safe-x absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-serif text-5xl leading-none">FAC Ultra</h1>
              <p className="mt-2 text-sm text-fg/80">
                {rankName(lv)} · Lv {lv} · {dex}/{TOTAL_SPECIES} species · Fifteen waters, fifteen bosses
              </p>
            </div>
            {kidChip}
          </div>
          <div className={cn(plan.railCollapsed ? "flex gap-2 overflow-x-auto pb-1" : "grid grid-cols-4 gap-2 min-[1700px]:grid-cols-8")}>
            {cards.map(card)}
          </div>
          <p className="text-xs text-muted">
            Progress saves in this browser, one ledger per mode. Export a save code from Lodge → Settings to carry it
            anywhere.
          </p>
        </div>
      )}
      <WhoIsFishing />
    </div>
  );
}

/** First launch: "Who's fishing today?" Kid and Both turn Kid Mode on; Grown-up leaves it off. */
function WhoIsFishing() {
  const ask = useGame((s) => s.askWho);
  const answer = useGame((s) => s.answerWho);
  if (!ask) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-4">
      <div role="dialog" aria-label="Who is fishing today" className="w-full max-w-sm rounded-2xl border border-brass bg-surface p-5">
        <p className="font-serif text-2xl">Who&apos;s fishing today?</p>
        <p className="mt-1 text-sm text-muted">
          Kid Mode makes the writing bigger and the fishing a little friendlier. You can change it any time on this
          screen or in Settings.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={() => answer("kid")}>A kid</Button>
          <Button variant="ghost" onClick={() => answer("both")}>
            A grown-up and a kid
          </Button>
          <Button variant="ghost" onClick={() => answer("grown")}>
            A grown-up
          </Button>
        </div>
      </div>
    </div>
  );
}
