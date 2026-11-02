import { BOATS, money } from "@/game/content";
import { useGame } from "@/game/engine";
import { HAZARD_TABLE, salvageCost, tankComplaint } from "@/game/hazards";
import { useTick } from "@/components/game/use-tick";
import { Button } from "@/components/ui/button";

/* Legend-difficulty alerts (docs/architecture/12 §3): the banner with the timer when a fish jumps out of the tank, the
   warning when a visitor is about to sue, and the way to raise a sunk boat. Hidden whenever there is nothing to say. */

export function HazardAlerts() {
  const screen = useGame((s) => s.screen);
  const jump = useGame((s) => s.hz.jump);
  const grace = useGame((s) => s.hz.grace);
  const sunk = useGame((s) => s.hz.sunk);
  const coins = useGame((s) => s.c);
  const tank = useGame((s) => s.tank);
  const put = useGame((s) => s.putFishBack);
  const raise = useGame((s) => s.raiseBoat);
  const active = screen === "game" && (!!jump || !!grace || sunk >= 0);
  useTick(active ? 500 : 60_000);
  if (!active) return null;
  const now = Date.now();
  const left = jump ? Math.max(0, Math.ceil((jump.until - now) / 1000)) : 0;
  const mins = grace ? Math.max(0, Math.ceil((grace - now) / 60_000)) : 0;
  const cost = sunk >= 0 ? salvageCost(sunk) : 0;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[55] flex flex-col items-center gap-2 px-3" aria-live="polite">
      {jump && left > 0 ? (
        <div role="alert" data-testid="jump-alert" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-brass bg-surface p-3 shadow-xl">
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg leading-tight">A fish jumped out of the tank!</p>
            <p className="text-sm text-muted">Put it back in {left} {left === 1 ? "second" : "seconds"} or it is lost.</p>
          </div>
          <Button data-testid="put-back" onClick={put}>
            Put it back
          </Button>
        </div>
      ) : null}
      {grace ? (
        <div role="alert" className="pointer-events-auto w-full max-w-md rounded-2xl border border-line bg-surface p-3 shadow-xl">
          <p className="font-serif text-lg leading-tight">A visitor is unhappy</p>
          <p className="text-sm text-muted">
            {tankComplaint(tank) || "Your tank is fine again."} Fix it in {mins} {mins === 1 ? "minute" : "minutes"} or they may sue you for half your money.
          </p>
        </div>
      ) : null}
      {sunk >= 0 ? (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-xl">
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg leading-tight">Your {BOATS[sunk]?.name} sank</p>
            <p className="text-sm text-muted">You are on the shore boat for now. Raise it for {money(cost)}.</p>
          </div>
          <Button data-testid="raise-boat" disabled={coins < cost} onClick={raise}>
            Raise it
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export const JUMP_SECONDS = Math.round(HAZARD_TABLE.tankJump.windowMs / 1000);
