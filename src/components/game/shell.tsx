import { useEffect } from "react";
import {
  Anchor,
  Backpack,
  BookOpen,
  Fish,
  HandHelping,
  Map,
  Menu as MenuIcon,
  Store,
  Swords,
  Timer,
  Trophy,
  Users,
  Waves,
} from "lucide-react";
import { BIOMES, dexCount, money, rankName, TOTAL_SPECIES, xpNeed } from "@/game/content";
import { act, assistTap, hud, hydrate, useGame, type Tab } from "@/game/engine";
import { Stage } from "@/components/game/stage";
import { Panel } from "@/components/game/panels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const TABS: { id: Tab; label: string; icon: typeof Fish }[] = [
  { id: "cast", label: "Cast", icon: Fish },
  { id: "bag", label: "Bag", icon: Backpack },
  { id: "gear", label: "Gear", icon: Store },
  { id: "lures", label: "Lures", icon: Anchor },
  { id: "waters", label: "Waters", icon: Map },
  { id: "dex", label: "Dex", icon: BookOpen },
  { id: "lodge", label: "Lodge", icon: Trophy },
];

export function Game() {
  const screen = useGame((s) => s.screen);
  useEffect(() => {
    hydrate();
    const onKey = (event: KeyboardEvent) => {
      const state = useGame.getState();
      if (state.screen !== "game") return;
      if (event.code === "KeyJ" && state.mode === "coop") {
        if (!event.repeat) assistTap();
        return;
      }
      if (event.code !== "Space" && event.code !== "Enter") return;
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select") && !target.closest("[data-cast]")) return;
      event.preventDefault();
      act();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (screen === "menu") {
    return (
      <div className="h-dvh bg-bg text-fg">
        <MainMenu />
        <Toasts />
        <WelcomeBack />
      </div>
    );
  }

  return (
    <div className="h-dvh bg-bg text-fg">
      <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col">
        <Header />
        <Stage />
        <ActionBand />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Panel />
        </div>
        <Nav />
        <Toasts />
        <WelcomeBack />
      </div>
    </div>
  );
}

const MODE_CARDS: {
  id: string;
  title: string;
  blurb: string;
  icon: typeof Fish;
  run: (g: ReturnType<typeof useGame.getState>) => void;
  lock?: (g: ReturnType<typeof useGame.getState>) => string | null;
}[] = [
  {
    id: "expedition",
    title: "Expedition",
    blurb: "The career: money, gear, contracts, stages, bosses, rebirth.",
    icon: Fish,
    run: (g) => g.switchMode("career"),
  },
  {
    id: "aquarium",
    title: "The Aquarium",
    blurb: "Exhibit your best fish. They earn while you sleep.",
    icon: Waves,
    run: (g) => {
      g.switchMode("career");
      g.setLodgeView("tank");
    },
  },
  {
    id: "sandbox",
    title: "Sandbox — Zen Waters",
    blurb: "Everything unlocked, nothing to sell, calmer water. Its own dex.",
    icon: Anchor,
    run: (g) => g.switchMode("sandbox"),
  },
  {
    id: "local",
    title: "Local Co-op",
    blurb: "Two anglers, one screen, one shared ledger. Player 2 assists the reel with J.",
    icon: HandHelping,
    run: (g) => g.switchMode("coop"),
  },
  {
    id: "online",
    title: "Online Co-op",
    blurb: "Room-code fishing with friends — shared water and weather, live catch feed.",
    icon: Users,
    run: (g) => {
      g.switchMode("career");
      g.setLodgeView("crew");
    },
  },
  {
    id: "derby",
    title: "Derby",
    blurb: "Ten minutes, three rivals, most value wins the purse.",
    icon: Timer,
    run: (g) => {
      g.switchMode("career");
      g.setLodgeView("derby");
    },
    lock: (g) => (g.derby ? "A derby is already running." : null),
  },
  {
    id: "rush",
    title: "Boss Rush",
    blurb: "Every boss you've beaten, back to back, against the clock.",
    icon: Swords,
    run: (g) => {
      g.switchMode("career");
      g.setLodgeView("derby");
    },
    lock: (g) => (g.bosses < 3 ? `Beat 3 bosses to unlock (${g.bosses}/3).` : null),
  },
];

function MainMenu() {
  const g = useGame.getState();
  const dex = useGame((s) => dexCount(s.dex));
  const lv = useGame((s) => s.lv);
  const biome = useGame((s) => s.biome);
  const hydrated = useGame((s) => s.hydrated);
  return (
    <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col overflow-y-auto">
      <div className="relative shrink-0">
        <img
          src={`/art/biomes/${BIOMES[biome]?.id ?? "pond"}.jpg`}
          alt=""
          className="h-44 w-full object-cover sm:h-56"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h1 className="font-serif text-4xl leading-none sm:text-5xl">FAC Ultra</h1>
          <p className="mt-2 text-sm text-muted">
            {rankName(lv)} · Lv {lv} · {dex}/{TOTAL_SPECIES} species · Fifteen waters, fifteen bosses
          </p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-2 p-3 sm:grid-cols-2">
        {MODE_CARDS.map((card) => {
          const Icon = card.icon;
          const locked = hydrated ? card.lock?.(g) : null;
          return (
            <button
              key={card.id}
              type="button"
              disabled={!!locked}
              onClick={() => card.run(useGame.getState())}
              className="flex min-h-24 flex-col justify-between rounded-2xl border border-line bg-surface p-4 text-left enabled:hover:border-brass disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-5 text-brass" aria-hidden />
                <span className="font-serif text-lg">{card.title}</span>
              </span>
              <span className="mt-1 text-sm text-muted">{locked ?? card.blurb}</span>
            </button>
          );
        })}
      </div>
      <p className="px-4 pb-4 text-center text-xs text-muted">
        Progress saves in this browser, one ledger per mode. Export a save code from Lodge → Settings to carry it
        anywhere.
      </p>
    </div>
  );
}

function WelcomeBack() {
  const wb = useGame((s) => s.welcomeBack);
  const dismiss = useGame((s) => s.dismissWelcome);
  if (!wb) return null;
  const hours = wb.hours >= 1 ? `${wb.hours.toFixed(1)} hours` : `${Math.max(1, Math.round(wb.hours * 60))} minutes`;
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-bg/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-brass bg-surface p-5 text-center">
        <p className="font-serif text-2xl">While you were away</p>
        <p className="mt-2 text-sm text-muted">
          Your aquarium exhibits earned for {hours} (up to your tank's cap):
        </p>
        <p className="mt-3 font-serif text-4xl text-brass">{money(wb.gain)}</p>
        <Button className="mt-4 w-full" onClick={dismiss}>
          Collect
        </Button>
      </div>
    </div>
  );
}

function Header() {
  const coins = useGame((s) => s.c);
  const lv = useGame((s) => s.lv);
  const xp = useGame((s) => s.xp);
  const dex = useGame((s) => dexCount(s.dex));
  const mode = useGame((s) => s.mode);
  const setScreen = useGame((s) => s.setScreen);
  const need = xpNeed(lv);
  const modeLabel = mode === "sandbox" ? "Zen Waters" : mode === "coop" ? "Local Co-op" : "Expedition";
  return (
    <header className="safe-top shrink-0 border-b border-line px-3 pb-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setScreen("menu")}
            className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-line text-muted"
            aria-label="Back to main menu"
          >
            <MenuIcon className="size-5" aria-hidden />
          </button>
          <div>
            <p className="font-serif text-2xl leading-none">FAC Ultra</p>
            <p className="mt-1 text-xs text-muted">
              {rankName(lv)} · Lv {lv} · {modeLabel}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl leading-none text-brass">{mode === "sandbox" ? "—" : money(coins)}</p>
          <p className="mt-1 text-xs text-muted">
            {dex}/{TOTAL_SPECIES}
          </p>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-brass" style={{ width: `${Math.min(100, (xp / need) * 100)}%` }} />
      </div>
    </header>
  );
}

function ActionBand() {
  const phase = useGame((s) => s.phase);
  const message = useGame((s) => s.message);
  const detail = useGame((s) => s.detail);
  const mode = useGame((s) => s.mode);
  const label = phase === "idle" ? "Cast" : phase === "wait" ? "Waiting" : phase === "bite" ? "Hook" : "Reel";
  const hint =
    phase === "bite"
      ? "Early hooks pay more."
      : phase === "reel"
        ? "Tap while the brass mark is in the teal band."
        : phase === "wait"
          ? "Watch the bobber."
          : "Tap the water, or press Space.";
  return (
    <div className="shrink-0 border-b border-line px-3 pt-2 pb-3">
      <p className="text-center font-serif text-xl">{message}</p>
      <div
        ref={(node) => {
          hud.track = node;
        }}
        className="relative mt-2 h-7 overflow-hidden rounded-full bg-surface-2 opacity-0"
        aria-hidden
      >
        <div
          ref={(node) => {
            hud.zone = node;
          }}
          className="absolute inset-y-0 rounded-full bg-lagoon/80"
        />
        <div
          ref={(node) => {
            hud.cursor = node;
          }}
          className="absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full bg-brass"
        />
      </div>
      <p className="mt-1 min-h-5 text-center text-sm text-muted">{detail || hint}</p>
      <div className="flex gap-2">
        <Button
          data-cast
          disabled={phase === "wait"}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            act();
          }}
          className={cn("mt-1 flex-1 font-serif text-lg", phase === "bite" && "motion-safe:animate-pulse")}
        >
          {label}
        </Button>
        {mode === "coop" ? (
          <Button
            variant="ghost"
            disabled={phase !== "reel"}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              assistTap();
            }}
            className="mt-1 font-serif text-lg"
          >
            Assist (P2)
          </Button>
        ) : null}
      </div>
      {mode === "coop" ? (
        <p className="mt-1 text-center text-xs text-muted">Player 2: tap Assist — or press J — when the mark is in the band.</p>
      ) : null}
    </div>
  );
}

function Nav() {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  return (
    <nav className="safe-bot flex shrink-0 gap-1 overflow-x-auto border-t border-line bg-surface px-2 pt-1">
      {TABS.map((item) => {
        const Icon = item.icon;
        const on = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={on ? "page" : undefined}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex min-h-11 min-w-16 shrink-0 flex-col items-center justify-center rounded-xl px-2 text-xs",
              on ? "bg-surface-2 text-brass" : "text-muted",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex flex-col items-center gap-2 px-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} text={toast.text} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ id, text, dismiss }: { id: number; text: string; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(id), 3200);
    return () => window.clearTimeout(timer);
  }, [id, dismiss]);
  return <div className="rounded-full border border-line bg-surface px-4 py-2 text-sm">{text}</div>;
}
