import { useEffect, useRef, useState } from "react";
import { mobileWaterHeight, peekCollapsed, type LayoutPlan } from "@/game/device";
import { act, useGame } from "@/game/engine";
import { Stage, StageChips } from "@/components/game/stage";
import { Panel } from "@/components/game/panels";
import { Toasts } from "@/components/game/overlays";
import { Celebration } from "@/components/game/layout/Celebration";
import { CastDock } from "@/components/game/layout/CastDock";
import { DragButtons } from "@/components/game/layout/DragButtons";
import { CornerHud } from "@/components/game/hub/CornerHud";
import { SpotBar } from "@/components/game/layout/RigControl";
import { cn } from "@/lib/cn";

const PEEK = 120;

/** Portrait phones and tablets: sticky water on top, the current tab's panel inline below,
    the cast button pinned at the bottom; the pause menu (hub/) holds everything else (09 §2.1). */
export function MobileLayout({ plan, height }: { plan: LayoutPlan; height: number }) {
  const tab = useGame((s) => s.tab);
  const [collapsed, setCollapsed] = useState(false);
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
        <CornerHud compact />
        <DragButtons className="top-1/2 -translate-y-1/2" />
        {collapsed ? null : <StageChips className="absolute top-16 left-3 z-10 pr-3" />}
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
      <Toasts />
      <Celebration mobile />
    </div>
  );
}
