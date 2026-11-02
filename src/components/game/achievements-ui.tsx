import { useState } from "react";
import { achStats, useGame } from "@/game/engine";
import { achievementViews, CATEGORY_NAMES, summaryOf, type AchCategory } from "@/game/achievements";
import { shortDate } from "@/game/social";
import { cn } from "@/lib/cn";

/* The Achievements room in the Lodge (docs/architecture/12 §6). Tap or hover a badge for its detail. */

export function AchievementsRoom() {
  /* The whole store: this room is only open in the menu, never during a fight. */
  const st = useGame();
  const { mode, ach } = st;
  const stats = achStats(st);
  const [open, setOpen] = useState<string | null>(null);
  const [cat, setCat] = useState<AchCategory | "all">("all");
  const views = achievementViews(mode, stats, ach);
  const sum = summaryOf(mode, stats, ach);
  const cats = [...new Set(views.map((v) => v.def.cat))];
  const shown = views.filter((v) => cat === "all" || v.def.cat === cat);
  const detail = views.find((v) => v.def.id === open) ?? null;
  if (!views.length) return <p className="text-muted">This mode does not give achievements.</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted" data-testid="ach-summary">
        {sum.done} of {sum.total} earned in this game.
      </p>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Kinds of achievement">
        {(["all", ...cats] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={cn("min-h-10 rounded-full border px-3 text-sm", cat === c ? "border-brass text-brass" : "border-line text-muted")}
          >
            {c === "all" ? "All" : CATEGORY_NAMES[c]}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((v) => (
          <li key={v.def.id}>
            <button
              type="button"
              title={`${v.def.name}: ${v.def.text}`}
              onClick={() => setOpen(open === v.def.id ? null : v.def.id)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(v.def.id)}
              onFocus={() => setOpen(v.def.id)}
              className={cn("flex h-full min-h-20 w-full flex-col rounded-2xl border p-2.5 text-left", v.done ? "border-brass bg-surface-2" : "border-line opacity-80")}
            >
              <span className="font-serif leading-tight">{v.done ? "★ " : ""}{v.def.name}</span>
              <span className="mt-auto pt-1 text-xs text-muted">{v.done ? "Earned" : `${compactNum(v.value)} / ${compactNum(v.def.goal)}`}</span>
              {!v.done ? (
                <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded bg-line">
                  <span className="block h-full bg-brass" style={{ width: `${Math.min(100, (v.value / v.def.goal) * 100)}%` }} />
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {detail ? (
        <div role="status" className="rounded-2xl border border-line bg-surface-2 p-3 text-sm">
          <p className="font-serif text-lg">{detail.def.name}</p>
          <p>{detail.def.text}</p>
          <p className="mt-1 text-muted">{detail.done ? `Earned ${shortDate(detail.at)}.` : `Progress: ${compactNum(detail.value)} of ${compactNum(detail.def.goal)}.`}</p>
        </div>
      ) : null}
    </div>
  );
}

function compactNum(n: number): string {
  return n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : String(n);
}
