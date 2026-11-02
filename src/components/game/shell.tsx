import { useEffect } from "react";
import { Anchor, Backpack, BookOpen, Fish, Map, Store, Trophy } from "lucide-react";
import { dexCount, money, rankName, xpNeed } from "@/game/content";
import { act, hud, hydrate, useGame, type Tab } from "@/game/engine";
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
  useEffect(() => {
    hydrate();
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea") && !target.closest("[data-cast]")) return;
      event.preventDefault();
      act();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      </div>
    </div>
  );
}

function Header() {
  const coins = useGame((s) => s.c);
  const lv = useGame((s) => s.lv);
  const xp = useGame((s) => s.xp);
  const dex = useGame((s) => dexCount(s.dex));
  const need = xpNeed(lv);
  return (
    <header className="safe-top shrink-0 border-b border-line px-3 pb-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-serif text-2xl leading-none">FAC Ultra</p>
          <p className="mt-1 text-xs text-muted">
            {rankName(lv)} · Lv {lv}
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl leading-none text-brass">{money(coins)}</p>
          <p className="mt-1 text-xs text-muted">{dex}/200</p>
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
      <Button
        data-cast
        disabled={phase === "wait"}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          act();
        }}
        className={cn("mt-1 w-full font-serif text-lg", phase === "bite" && "motion-safe:animate-pulse")}
      >
        {label}
      </Button>
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
