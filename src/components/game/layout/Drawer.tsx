import type { ReactNode } from "react";
import { useGame } from "@/game/engine";
import { cn } from "@/lib/cn";
import { BossControls } from "@/components/game/panels/CastPanel";
import { Panel } from "@/components/game/panels";

/** A panel that slides in over the water from the left. The water keeps moving behind it. */
export function Drawer({ left, width }: { left: number; width: string }) {
  const tab = useGame((s) => s.tab);
  const motion = useGame((s) => s.motion);
  if (tab === "cast") return null;
  return (
    <aside
      aria-label="Panel"
      style={{ left, width }}
      className={cn(
        "absolute top-14 bottom-0 z-10 overflow-y-auto border-r border-line/60 bg-bg/85 backdrop-blur-lg",
        motion && "animate-in slide-in-from-left duration-[240ms]",
      )}
    >
      <DrawerBody>
        {tab === "waters" ? (
          <div className="px-3 pt-3">
            <BossControls />
          </div>
        ) : null}
        <Panel />
      </DrawerBody>
    </aside>
  );
}

function DrawerBody({ children }: { children: ReactNode }) {
  return <div className="pb-6">{children}</div>;
}
