import { useEffect, useRef, useState } from "react";
import { mobileWaterHeight, peekCollapsed, type LayoutPlan } from "@/game/device";
import { act, useGame } from "@/game/engine";
import { Stage, StageChips } from "@/components/game/stage";
import { Panel } from "@/components/game/panels";
import { TABS } from "@/components/game/tabs";
import { Toasts } from "@/components/game/overlays";
import { Celebration } from "@/components/game/layout/Celebration";
import { CastDock } from "@/components/game/layout/CastDock";
import { DragButtons } from "@/components/game/layout/DragButtons";
import { HudBarMobile } from "@/components/game/layout/HudBar";
import { MenuSheet } from "@/components/game/layout/MenuSheet";
import { SpotBar } from "@/components/game/layout/RigControl";
import { cn } from "@/lib/cn";

const PEEK = 120;

/** Portrait phones and tablets: sticky water on top, the current tab's panel inline below,
    the cast button pinned above the bottom tabs (09 §2.1). */
export function MobileLayout({ plan, height }: { plan: LayoutPlan; height: number }) {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const [collapsed, setCollapsed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const waterH = mobileWaterHeight(height, plan.twoColumns);

  /* A new tab starts at the top with the water full size. */
  useEffect(() => {
    setCollapsed(false);
    if (panel.current) panel.current.scrollTop = 0;
  }, [tab]);

  const snapBack = () => setCollapsed(false);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg">
      <div
        style={{ height: collapsed ? PEEK : waterH }}
        className="relative shrink-0 transition-[height] duration-200 motion-reduce:transition-none"
      >
        <Stage
          big
          className="absolute inset-0"
          onWater={() => {
            snapBack();
            act();
          }}
        />
        <HudBarMobile onMenu={() => setSheet(true)} />
        <DragButtons className="top-1/2 -translate-y-1/2" />
        {collapsed ? null : <StageChips className="absolute top-11 left-3 z-10 pr-3" />}
        {collapsed ? null : <SpotBar className="absolute inset-x-0 bottom-1" />}
      </div>
      <div
        ref={panel}
        onScroll={(e) => {
          const el = e.currentTarget;
          const next = peekCollapsed(el.scrollTop, el.clientHeight);
          setCollapsed((was) => (was === next ? was : next));
        }}
        className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", plan.twoColumns && "mx-auto w-full max-w-4xl")}
      >
        <Panel columns={plan.twoColumns} />
      </div>
      <CastDock mobile onCast={snapBack} />
      <nav aria-label="Game menu" className="safe-bot safe-x flex shrink-0 border-t border-line bg-surface pt-1">
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
                "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px]",
                on ? "bg-surface-2 text-brass" : "text-muted",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </nav>
      <Toasts />
      <Celebration mobile />
      <MenuSheet open={sheet} onOpenChange={setSheet} />
    </div>
  );
}
