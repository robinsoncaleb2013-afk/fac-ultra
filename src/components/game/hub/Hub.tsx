import { lazy, Suspense, useEffect, useRef, type ComponentType } from "react";
import { money, rankName } from "@/game/content";
import { useGame } from "@/game/engine";
import { HUB_TABS, resolveHubTarget, tabsFor, type HubTab } from "@/game/hubnav";
import { useHubUi } from "@/game/hubstate";
import { leaveLabel } from "@/game/leave";
import { showsMoney, MODES } from "@/game/modes";
import { FullscreenButton } from "@/components/game/fullscreen";
import { closeHub, hubBack, hubFocusFirst, hubLeave, hubTab } from "@/components/game/hub/actions";
import { Icon, type IconName } from "@/components/game/hub/icons";
import { LeaveDialog } from "@/components/game/hub/LeaveDialog";
import { useHubLayout } from "@/components/game/hub/parts";
import { PlayTab } from "@/components/game/hub/PlayTab";
import { ShopTab, TackleTab } from "@/components/game/hub/TackleTab";
import { WatersTab } from "@/components/game/hub/WatersTab";
import { cn } from "@/lib/cn";

/* The heavier tabs load when first opened (09 §5): nobody opens the Lodge in the first ten seconds. */
const lazyTab = <K extends string>(load: () => Promise<Record<K, ComponentType<{ split: boolean }>>>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] })));
const Lodge = () => import("@/components/game/hub/LodgeTab");
const LodgeTab = lazyTab(Lodge, "LodgeTab");
const CollectionTab = lazyTab(Lodge, "CollectionTab");
const LogTab = lazyTab(Lodge, "LogTab");
const LogbookTab = lazyTab(Lodge, "LogbookTab");
const PlayersTab = lazyTab(() => import("@/components/game/hub/PlayersTab"), "PlayersTab");
const FriendsTab = lazyTab(() => import("@/components/game/hub/PlayersTab"), "FriendsTab");
const SettingsTab = lazyTab(() => import("@/components/game/hub/SettingsTab"), "SettingsTab");
const AccountTab = lazyTab(() => import("@/components/game/hub/SettingsTab"), "AccountTab");
const CollectionsTab = lazyTab(() => import("@/components/game/hub/CollectionsTab"), "CollectionsTab");
const CampTab = lazyTab(() => import("@/components/game/hub/SurvivalTabs"), "CampTab");
const LarderTab = lazyTab(() => import("@/components/game/hub/SurvivalTabs"), "LarderTab");
const EventTab = lazyTab(() => import("@/components/game/hub/SurvivalTabs"), "EventTab");

const ICON: Record<HubTab, IconName> = {
  play: "play",
  collections: "lodge",
  friends: "players",
  account: "cloud",
  tackle: "tackle",
  shop: "coin",
  lodge: "lodge",
  waters: "waters",
  players: "players",
  camp: "flag",
  larder: "satchel",
  log: "map",
  logbook: "map",
  collection: "lodge",
  event: "flag",
  settings: "settings",
};

const BODY: Record<HubTab, ComponentType<{ split: boolean }>> = {
  play: PlayTab,
  collections: CollectionsTab,
  friends: FriendsTab,
  account: AccountTab,
  tackle: TackleTab,
  shop: ShopTab,
  lodge: LodgeTab,
  waters: WatersTab,
  players: PlayersTab,
  camp: CampTab,
  larder: LarderTab,
  log: LogTab,
  logbook: LogbookTab,
  collection: CollectionTab,
  event: EventTab,
  settings: SettingsTab,
};

/** Little drifting specks of light: the quiet motion behind the menu. */
const MOTES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  dx: `${((i * 53) % 90) - 45}px`,
  dur: `${12 + ((i * 7) % 9)}s`,
  delay: `${-((i * 3) % 13)}s`,
  size: 3 + (i % 4),
}));

export function Motes() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {MOTES.map((m, i) => (
        <span key={i} className="hub-mote" style={{ left: m.left, width: m.size, height: m.size, ["--dx" as string]: m.dx, ["--dur" as string]: m.dur, ["--delay" as string]: m.delay }} />
      ))}
    </div>
  );
}

/** The pause menu: a single row of tabs, one section at a time, a list with a big detail panel (or a full-screen detail on phones). */
export function Hub() {
  const open = useHubUi((s) => s.open);
  const tab = useHubUi((s) => s.tab);
  const detail = useHubUi((s) => s.detail);
  const pad = useHubUi((s) => s.pad);
  const setTab = useHubUi((s) => s.setTab);
  const mode = useGame((s) => s.mode);
  const screen = useGame((s) => s.screen);
  const motion = useGame((s) => s.motion);
  const coins = useGame((s) => s.c);
  const lv = useGame((s) => s.lv);
  const layout = useHubLayout();
  const inGame = screen === "game";
  const rules = MODES[mode];
  const tabs = tabsFor(screen, mode);
  const prev = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, tabs.indexOf(tab));
  const dir = idx >= prev.current ? "hub-from-right" : "hub-from-left";

  useEffect(() => {
    document.documentElement.dataset.motion = motion ? "on" : "off";
  }, [motion]);
  /* A tab this level does not have (the Lodge asked for from a mode without one, Tackle from the main menu) moves to the
     nearest one it does have; the main menu can never show a game tab. */
  const tabKey = tabs.join();
  useEffect(() => {
    if (!open || tabs.includes(tab)) return;
    const to = resolveHubTarget(tabs, tab);
    setTab(to.tab);
  }, [open, tab, tabKey, tabs, setTab]);
  /* Put the keys somewhere sensible whenever the menu or its tab changes, and give focus back on close. */
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(hubFocusFirst, 80);
    return () => {
      window.clearTimeout(t);
      before?.focus?.({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => !detail && hubFocusFirst(), 60);
    prev.current = idx;
    return () => window.clearTimeout(t);
  }, [tab, open, idx, detail]);

  if (!open) return null;
  const Body = tabs.includes(tab) ? BODY[tab] : BODY[tabs[0]];
  const phoneTop = !layout.split && !layout.bottomTabs;
  const tournament = mode === "tournament";
  const cash = inGame && showsMoney(rules) ? money(coins) : "";

  const strip = (
    <nav
      role="tablist"
      aria-label={inGame ? "Game menu sections" : "Main menu sections"}
      className={cn(
        "no-scrollbar flex snap-x snap-mandatory overflow-x-auto",
        layout.bottomTabs ? "hub-wood safe-bot safe-x w-full justify-between border-t border-[#caa45a]/40" : "justify-center",
      )}
    >
      {layout.split ? (
        <kbd aria-hidden className="mr-1 self-center rounded border border-[#caa45a]/60 px-1.5 text-xs text-[#c9b890]">Q</kbd>
      ) : null}
      {tabs.map((id) => {
        const meta = HUB_TABS.find((t) => t.id === id)!;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`hub-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="hub-panel"
            data-nav="tab"
            title={`${meta.label} (${tabs.indexOf(id) + 1}): ${meta.blurb}`}
            onClick={() => setTab(id)}
            className={cn("hub-tab", layout.bottomTabs && "min-h-14 min-w-16 flex-1 flex-col gap-0.5 px-1 text-[12px]")}
          >
            <Icon name={ICON[id]} className={layout.bottomTabs ? "size-6" : "size-5"} />
            <span className={cn("font-serif", layout.bottomTabs ? "text-[12px]" : "text-lg")}>{meta.label}</span>
          </button>
        );
      })}
      {layout.split ? (
        <kbd aria-hidden className="ml-1 self-center rounded border border-[#caa45a]/60 px-1.5 text-xs text-[#c9b890]">E</kbd>
      ) : null}
    </nav>
  );

  return (
    <div ref={root} data-hub-root role="dialog" aria-modal="true" aria-label={inGame ? "Game menu" : "Main menu"} data-level={inGame ? "game" : "main"} className="hub fixed inset-0 z-40 text-[#f1e5c9]">
      <div className="hub-backdrop" onClick={screen === "game" ? closeHub : undefined} />
      <Motes />
      <div className="relative mx-auto flex h-full max-w-[1560px] flex-col">
        <header className={cn("safe-top safe-x flex shrink-0 items-center gap-3 px-4", layout.split ? "pb-1" : "pb-1")}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {!layout.split && detail ? (
              <button type="button" data-nav="back" onClick={hubBack} className="grid size-11 shrink-0 place-items-center rounded-full border border-white/25 bg-black/30" aria-label="Back">
                <Icon name="back" className="size-5" />
              </button>
            ) : null}
            <div className="min-w-0">
              <p className="truncate font-serif text-2xl leading-none">{inGame ? rules.title : "FAC Ultra"}</p>
              <p className="mt-1 truncate text-[13px] text-[#c9b890]">
                {!inGame ? "Pick how you want to fish" : tournament ? "The event keeps running while you look around" : "Paused. Your fish are saved."}
              </p>
            </div>
          </div>
          {layout.split || phoneTop ? <div className="min-w-0 flex-[2]">{strip}</div> : null}
          <div className="flex flex-1 items-center justify-end gap-2">
            <p className="hidden text-right text-[13px] leading-tight text-[#c9b890] xl:block">
              {rankName(lv)} · Lv {lv}
              {cash ? <span className="block font-serif text-lg text-brass">{cash}</span> : null}
            </p>
            <FullscreenButton />
            {inGame ? (
              <button
                type="button"
                data-nav="leave"
                data-testid="hub-leave"
                onClick={hubLeave}
                aria-label={`${leaveLabel(rules)}: save and go back to the main menu`}
                title="Save and go back to the main menu"
                className={cn("flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/25 bg-black/35 hover:border-brass", layout.split ? "px-4" : "size-11")}
              >
                <Icon name="exit" className="size-5" />
                {layout.split ? <span className="font-serif text-base">{leaveLabel(rules)}</span> : null}
              </button>
            ) : null}
            <button
              type="button"
              data-nav="close"
              data-testid="hub-close"
              onClick={closeHub}
              aria-label={inGame ? "Resume" : "Close menu"}
              title={inGame ? "Back to the water (Esc)" : "Close (Esc)"}
              className={cn("flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/25 bg-black/35 hover:border-brass", inGame && layout.split ? "px-4" : "size-11")}
            >
              <Icon name={inGame ? "play" : "close"} className="size-5" />
              {inGame && layout.split ? <span className="font-serif text-base">Resume</span> : null}
            </button>
          </div>
        </header>
        <main id="hub-panel" role="tabpanel" aria-labelledby={`hub-tab-${tab}`} className="safe-x min-h-0 flex-1 px-4 pt-2 pb-2">
          <div key={tab} className={cn("h-full min-h-0", dir)}>
            <Suspense fallback={<p className="p-6 text-center text-[#c9b890]">Opening…</p>}>
              <Body split={layout.split} />
            </Suspense>
          </div>
        </main>
        {layout.bottomTabs ? strip : null}
        {layout.split ? <HintBar pad={pad} inGame={inGame} /> : null}
      </div>
      <LeaveDialog />
    </div>
  );
}

function Key({ children }: { children: string }) {
  return <kbd className="mx-1 rounded border border-[#caa45a]/60 bg-black/30 px-1.5 py-0.5 text-xs text-[#fff4d6]">{children}</kbd>;
}

/** The bottom bar: which keys (or gamepad buttons) do what, on a PC. */
function HintBar({ pad, inGame }: { pad: boolean; inGame: boolean }) {
  return (
    <footer className="hub-wood safe-x mx-4 mb-3 flex shrink-0 items-center justify-center gap-5 rounded-full border border-[#caa45a]/40 px-5 py-2 text-[13px] text-[#e7d9b6]" aria-label="Controls">
      {pad ? (
        <>
          <span><Key>A</Key>Choose</span>
          <span><Key>B</Key>Back</span>
          <span><Key>D-pad</Key>Move</span>
          <span><Key>LB</Key><Key>RB</Key>Section</span>
          <span><Key>Start</Key>{inGame ? "Resume" : "Close"}</span>
        </>
      ) : (
        <>
          <span><Key>↑</Key><Key>↓</Key><Key>←</Key><Key>→</Key>Move</span>
          <span><Key>Enter</Key>Choose</span>
          <span><Key>Q</Key><Key>E</Key>Section</span>
          <span><Key>F</Key>Full screen</span>
          <span><Key>Esc</Key>{inGame ? "Resume" : "Close"}</span>
        </>
      )}
    </footer>
  );
}

export { hubTab };
