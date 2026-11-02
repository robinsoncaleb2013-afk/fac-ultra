import { Suspense } from "react";
import { CastPanel } from "@/components/game/panels/CastPanel";
import { cn } from "@/lib/cn";

/** The inline panel under the water on phones is only the cast panel now; every other section lives in the pause menu (hub/). */
export function Panel({ columns = false }: { columns?: boolean }) {
  return (
    <div
      className={cn(
        "px-3 py-3",
        columns && "[&>div>div]:block [&>div>div]:columns-2 [&>div>div]:gap-3 [&>div>div>*]:mb-3 [&>div>div>*]:break-inside-avoid",
      )}
    >
      <Suspense fallback={<p className="p-4 text-center text-sm text-muted">Loading…</p>}>
        <CastPanel />
      </Suspense>
    </div>
  );
}
