import { lazy, Suspense } from "react";
import { useGame } from "@/game/engine";
import { cn } from "@/lib/cn";
import { BagPanel } from "@/components/game/panels/BagPanel";
import { CastPanel } from "@/components/game/panels/CastPanel";
import { GearPanel } from "@/components/game/panels/GearPanel";
import { LurePanel } from "@/components/game/panels/LurePanel";
import { WatersPanel } from "@/components/game/panels/WatersPanel";

/* The Dex and the Lodge are the heaviest panels and nobody opens them in the
   first ten seconds, so they load as their own chunks (09 §5). */
const DexPanel = lazy(() => import("@/components/game/panels/DexPanel").then((m) => ({ default: m.DexPanel })));
const CampPanel = lazy(() => import("@/components/game/panels/CampPanel").then((m) => ({ default: m.CampPanel })));
const LodgePanel = lazy(() => import("@/components/game/panels/LodgePanel").then((m) => ({ default: m.LodgePanel })));

export function Panel({ columns = false }: { columns?: boolean }) {
  const tab = useGame((s) => s.tab);
  return (
    <div
      className={cn(
        "px-3 py-3",
        columns && "[&>div>div]:block [&>div>div]:columns-2 [&>div>div]:gap-3 [&>div>div>*]:mb-3 [&>div>div>*]:break-inside-avoid",
      )}
    >
      <Suspense fallback={<p className="p-4 text-center text-sm text-muted">Loading…</p>}>
        {tab === "cast" ? <CastPanel /> : null}
        {tab === "bag" ? <BagPanel /> : null}
        {tab === "gear" ? <GearPanel /> : null}
        {tab === "lures" ? <LurePanel /> : null}
        {tab === "waters" ? <WatersPanel /> : null}
        {tab === "dex" ? <DexPanel /> : null}
        {tab === "lodge" ? <LodgePanel /> : null}
        {tab === "camp" ? <CampPanel /> : null}
      </Suspense>
    </div>
  );
}
