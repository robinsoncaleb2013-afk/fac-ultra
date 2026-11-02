import { useSyncExternalStore } from "react";
import { dismissNotice, noticePending, subscribeTesting, testingOn } from "@/game/epoch-gate";
import { NOTICE_TEXT, TESTING_LINE } from "@/lib/test-phase";

/** Is the test-phase reset switch on (as far as this page knows)? */
export const useTesting = (): boolean => useSyncExternalStore(subscribeTesting, testingOn, testingOn);

/** One quiet line: "Testing build — progress resets on every update". Gone when the switch is off. */
export function TestingLine({ className = "" }: { className?: string }) {
  if (!useTesting()) return null;
  return (
    <p data-testid="testing-line" className={`text-xs leading-snug ${className}`}>
      {TESTING_LINE}
    </p>
  );
}

/** Shown once, after an update reset this device's progress, until it is dismissed. */
export function ResetNotice() {
  const pending = useSyncExternalStore(subscribeTesting, () => noticePending(), () => false);
  if (!pending) return null;
  return (
    <div className="safe-top safe-x pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center p-3">
      <div role="status" data-testid="reset-notice" className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-brass bg-surface p-3 text-sm text-fg shadow-lg">
        <span>{NOTICE_TEXT}</span>
        <button type="button" onClick={dismissNotice} className="min-h-11 min-w-11 shrink-0 rounded-lg border border-brass px-3 font-semibold">
          OK
        </button>
      </div>
    </div>
  );
}
