import { useEffect } from "react";
import type { LayoutPlan } from "@/game/device";
import { act, useGame } from "@/game/engine";
import { BountyChips, DerbyBanner } from "@/components/game/panels/CastPanel";
import { Stage, StageChips } from "@/components/game/stage";
import { Toasts } from "@/components/game/overlays";
import { Celebration } from "@/components/game/layout/Celebration";
import { CastDock } from "@/components/game/layout/CastDock";
import { DragButtons } from "@/components/game/layout/DragButtons";
import { Drawer } from "@/components/game/layout/Drawer";
import { HudBar } from "@/components/game/layout/HudBar";
import { Rail } from "@/components/game/layout/Rail";
import { RigPopover, RigSheet, SpotChips } from "@/components/game/layout/RigControl";

/** Big Water: the painting fills the screen; the rail, HUD bar, drawer and cast dock float over it. */
export function DesktopLayout({ plan }: { plan: LayoutPlan }) {
  const photo = useGame((s) => s.photo);
  const derby = useGame((s) => !!s.derby);
  const railW = plan.railCollapsed ? 56 : 72;

  /* Photo mode: the next key or click brings the chrome back (and does nothing else). */
  useEffect(() => {
    if (!photo) return;
    const back = (e: Event) => {
      e.stopPropagation();
      useGame.setState({ photo: false });
    };
    window.addEventListener("pointerdown", back, true);
    return () => window.removeEventListener("pointerdown", back, true);
  }, [photo]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <Stage
        big={plan.bigRing}
        className="absolute inset-0"
        onWater={() => {
          const s = useGame.getState();
          if (s.celebration) s.dismissCelebration();
          if (s.tab !== "cast") s.setTab("cast");
          else act();
        }}
      />
      {photo ? null : (
        <>
          <HudBar left={railW} />
          <StageChips className="absolute top-14 z-10" style={{ left: railW + 12 }} />
          <div className="pointer-events-none absolute top-14 right-4 z-10 flex w-96 max-w-[45vw] flex-col items-end gap-2">
            {derby ? <DerbyBanner /> : null}
            <BountyChips />
          </div>
          <Rail collapsed={plan.railCollapsed} />
          <Drawer left={railW} width={plan.drawerWidth} />
          <div className="absolute bottom-7 z-20" style={{ left: railW + 12 }}>
            {plan.bigRing ? <RigSheet compact /> : <RigPopover />}
          </div>
          {plan.bigRing ? (
            <div
              className="absolute right-3 bottom-7 z-20 flex"
              style={{ width: `calc(50% - ${150 + 12}px)` }}
            >
              <SpotChips className="overflow-x-auto [scrollbar-width:none]" />
            </div>
          ) : null}
          <CastDock />
          {plan.bigRing ? <DragButtons className="top-1/2 -translate-y-1/2" /> : null}
          <Toasts />
          <Celebration />
        </>
      )}
    </div>
  );
}
