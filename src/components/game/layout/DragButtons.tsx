import { nudgeDrag, useGame } from "@/game/engine";
import { cn } from "@/lib/cn";

const NAMES = ["Loose", "Normal", "Tight"] as const;

/** The drag setting (04 §5.2) as two big − / + buttons at the right edge of the water during a fight
    (09 §3.1). Desktop uses the [ and ] keys; phones and tablets get these. */
export function DragButtons({ className }: { className?: string }) {
  const reeling = useGame((s) => s.phase === "reel");
  const drag = useGame((s) => s.drag);
  if (!reeling) return null;
  const press = (delta: -1 | 1) => (event: React.PointerEvent) => {
    /* Not a reel press: adjusting the drag must not hold the reel. */
    event.preventDefault();
    event.stopPropagation();
    nudgeDrag(delta);
  };
  return (
    <div
      role="group"
      aria-label="Drag"
      className={cn("safe-x absolute right-2 z-20 flex flex-col items-center gap-1.5", className)}
    >
      <button
        type="button"
        aria-label="Tighter drag"
        disabled={drag >= 2}
        onPointerDown={press(1)}
        className="grid size-12 place-items-center rounded-full border border-line bg-bg/75 text-xl backdrop-blur-sm disabled:opacity-40"
      >
        +
      </button>
      <span className="rounded-full bg-bg/75 px-2 py-0.5 text-[11px] backdrop-blur-sm" aria-live="polite">
        Drag: {NAMES[drag]}
      </span>
      <button
        type="button"
        aria-label="Looser drag"
        disabled={drag <= 0}
        onPointerDown={press(-1)}
        className="grid size-12 place-items-center rounded-full border border-line bg-bg/75 text-xl backdrop-blur-sm disabled:opacity-40"
      >
        −
      </button>
    </div>
  );
}
