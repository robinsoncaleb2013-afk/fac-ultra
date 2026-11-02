import { act, partnerDown, partnerUp, reelDown, reelUp, sim, useGame } from "@/game/engine";
import { Button } from "@/components/ui/button";
import { SpeakButton } from "@/components/game/kid";
import { useKidOn, useRules } from "@/components/game/use-kid";
import { isLongMessage } from "@/game/kid";
import { cn } from "@/lib/cn";

/** The pill follows the needle: calm and green, pulling hard (amber), too tight (red). */
const TENSION = ["text-lagoon", "text-brass", "text-[#e4572e]"] as const;

/** The message pill and the big action button. Bottom-centre on desktop, pinned above the tabs on phones. */
export function CastDock({ mobile, onCast }: { mobile?: boolean; onCast?: () => void }) {
  const phase = useGame((s) => s.phase);
  const message = useGame((s) => s.message);
  const detail = useGame((s) => s.detail);
  const twoPlayer = useRules().twoPlayer;
  const kid = useKidOn();
  const helping = useGame((s) => s.helping);
  const tension = useGame((s) => s.tension);
  const label = phase === "idle" ? "Cast" : phase === "wait" ? "Waiting" : phase === "bite" ? "Hook" : "Reel";
  const hint =
    phase === "bite"
      ? "Early hooks pay more."
      : phase === "reel"
        ? mobile
          ? "Press and hold the water to reel. Lift to give line."
          : "Hold Space or the mouse to reel. Let go to give line."
        : phase === "wait"
          ? "Watch the bobber."
          : mobile
            ? "Tap the water, or the button."
            : "Click the water, or press Space.";
  const sub = phase === "reel" && helping ? "Helping hand: the green is wider." : detail || hint;
  const readable = kid && isLongMessage(`${message} ${sub}`);
  return (
    <div
      className={cn(
        "safe-x z-20",
        mobile
          ? "safe-bot-dock shrink-0 border-t border-line bg-bg/90 px-3 pt-2 backdrop-blur"
          : "absolute bottom-7 left-1/2 flex w-[280px] -translate-x-1/2 flex-col",
      )}
    >
      <div
        className={cn(
          "relative rounded-2xl bg-bg/70 px-3 py-1.5 text-center backdrop-blur-sm",
          mobile ? "mb-2" : "mb-3 min-h-9",
          readable && "px-12",
        )}
        aria-live="polite"
      >
        <p className={cn("font-serif text-lg leading-tight", phase === "reel" && TENSION[tension])}>{message}</p>
        <p className="min-h-4 text-xs text-muted">{sub}</p>
        {readable ? <SpeakButton text={`${message} ${sub}`} className="absolute top-1/2 right-1 -translate-y-1/2" /> : null}
      </div>
      <div className="flex gap-2">
        <Button
          data-cast
          disabled={phase === "wait"}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onCast?.();
            if (sim.phase === "reel") {
              event.currentTarget.setPointerCapture?.(event.pointerId);
              reelDown();
            } else act();
          }}
          onPointerUp={reelUp}
          onPointerCancel={reelUp}
          className={cn(
            "flex-1 font-serif text-lg",
            mobile ? "min-h-14" : "min-h-12",
            phase === "bite" && "motion-safe:animate-pulse",
          )}
        >
          {label}
        </Button>
        {twoPlayer ? (
          <Button
            variant="ghost"
            disabled={phase !== "reel"}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture?.(event.pointerId);
              partnerDown();
            }}
            onPointerUp={partnerUp}
            onPointerCancel={partnerUp}
            className={cn("font-serif text-lg", mobile && "min-h-14")}
          >
            Assist (P2)
          </Button>
        ) : null}
      </div>
    </div>
  );
}
