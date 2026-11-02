import { useState } from "react";
import { artUrl } from "@/game/art";
import { cn } from "@/lib/cn";

export function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-2 py-2 text-center">
      <p className="text-xs text-muted">{k}</p>
      <p className="font-serif text-lg leading-tight">{v}</p>
    </div>
  );
}

export function Badge({ children }: { children: string }) {
  return <span className="rounded-full bg-surface-2 px-2 py-1 text-xs text-brass">{children}</span>;
}


export function Filter({ on, children, onClick }: { on: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 min-w-11 shrink-0 rounded-full border px-3 text-sm",
        on ? "border-brass bg-surface-2 text-fg" : "border-line text-muted",
      )}
    >
      {children}
    </button>
  );
}


export function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="flex min-h-12 items-center justify-between rounded-2xl border border-line bg-surface px-3"
    >
      <span>{children}</span>
      <span className={on ? "text-brass" : "text-muted"}>{on ? "On" : "Off"}</span>
    </button>
  );
}

/** A biome painting thumbnail: the small WebP. If it ever fails to load the picture is simply hidden (the card still reads fine). */
export function ArtThumb({ id, className }: { id: string; className?: string }) {
  const [bad, setBad] = useState(false);
  if (bad) return <div aria-hidden className={className} />;
  return <img src={artUrl(id, 800)} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} className={className} />;
}
