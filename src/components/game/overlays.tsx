import { useEffect } from "react";
import { money } from "@/game/content";
import { useGame } from "@/game/engine";
import { Button } from "@/components/ui/button";

export function WelcomeBack() {
  const wb = useGame((s) => s.welcomeBack);
  const nb = useGame((s) => s.nightBack);
  const dismiss = useGame((s) => s.dismissWelcome);
  const dismissNight = useGame((s) => s.dismissNightBack);
  if (!wb && !nb) return null;
  const hours = wb && wb.hours >= 1 ? `${wb.hours.toFixed(1)} hours` : wb ? `${Math.max(1, Math.round(wb.hours * 60))} minutes` : "";
  const nightHours = nb && nb.hours >= 1 ? `${nb.hours.toFixed(1)} hours` : nb ? `${Math.max(1, Math.round(nb.hours * 60))} minutes` : "";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-brass bg-surface p-5 text-center">
        <p className="font-serif text-2xl">While you were away</p>
        {wb ? (
          <>
            <p className="mt-2 text-sm text-muted">Your aquarium exhibits earned for {hours} (up to your tank's cap):</p>
            <p className="mt-3 font-serif text-4xl text-brass">{money(wb.gain)}</p>
          </>
        ) : null}
        {nb ? (
          <>
            <p className="mt-3 text-sm text-muted">
              Night fishing caught {nb.count} fish in {nightHours}: {nb.names.join(", ")}.
            </p>
            <p className="mt-1 text-sm">
              <span className="text-brass">{money(nb.gold)} gold</span> · {nb.xp} XP
            </p>
          </>
        ) : null}
        <Button
          className="mt-4 w-full"
          onClick={() => {
            dismiss();
            dismissNight();
          }}
        >
          Collect
        </Button>
      </div>
    </div>
  );
}

/** Toasts stack top-centre, under the HUD bar. */
export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} text={toast.text} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ id, text, dismiss }: { id: number; text: string; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(id), 3200);
    return () => window.clearTimeout(timer);
  }, [id, dismiss]);
  return <div className="rounded-full border border-line bg-surface px-4 py-2 text-sm">{text}</div>;
}
