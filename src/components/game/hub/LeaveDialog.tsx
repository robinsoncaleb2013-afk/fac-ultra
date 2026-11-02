import { useEffect, useRef } from "react";
import { currentLeaveFacts, useGame } from "@/game/engine";
import { leaveLines, leaveTitle } from "@/game/leave";
import { useHubUi } from "@/game/hubstate";
import { Icon } from "@/components/game/hub/icons";

/** "Leave?": asked only when something is in progress (a fish on, a trip, an event or a run). Saving happens first either way. */
export function LeaveDialog() {
  const ask = useHubUi((s) => s.leaveAsk);
  const setAsk = useHubUi((s) => s.askLeave);
  const leave = useGame((s) => s.leaveToMenu);
  const stay = useRef<HTMLButtonElement>(null);
  /* Read the facts when the question opens; the game is paused behind it (an event keeps its own clock). */
  const facts = ask ? currentLeaveFacts() : null;
  useEffect(() => {
    if (!ask) return;
    const t = window.setTimeout(() => stay.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [ask]);
  if (!ask || !facts) return null;
  const lines = leaveLines(facts);
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/55 p-4" data-hub-dialog role="alertdialog" aria-modal="true" aria-label={leaveTitle(facts)} data-testid="leave-dialog">
      <div className="hub-paper hub-in w-full max-w-md p-5 text-left">
        <p className="font-serif text-2xl">{leaveTitle(facts)}</p>
        <p className="hub-ink-muted mt-1 text-[15px]">Everything is saved first, so nothing is lost.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {lines.map((l) => (
            <li key={l} className="flex items-start gap-2 text-[15px]">
              <Icon name="check" className="mt-0.5 size-4 shrink-0 text-[#8a5a14]" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <button ref={stay} type="button" data-nav="act" className="hub-btn" onClick={() => setAsk(false)}>
            Stay here
          </button>
          <button
            type="button"
            data-nav="act"
            data-testid="leave-confirm"
            className="hub-btn hub-btn-quiet"
            onClick={() => {
              setAsk(false);
              leave();
            }}
          >
            <Icon name="exit" className="size-5" /> Save and leave
          </button>
        </div>
      </div>
    </div>
  );
}
