import { useGame } from "@/game/engine";
import { cn } from "@/lib/cn";
import { TABS } from "@/components/game/tabs";

/** Desktop and landscape-phone tab rail: icon + label, or icons only when collapsed. */
export function Rail({ collapsed }: { collapsed: boolean }) {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  return (
    <nav
      aria-label="Game menu"
      className={cn(
        "safe-x absolute inset-y-0 left-0 z-20 flex flex-col items-stretch justify-center gap-1 bg-bg/55 backdrop-blur-md",
        collapsed ? "w-14" : "w-[72px]",
      )}
    >
      {TABS.map((item) => {
        const Icon = item.icon;
        const on = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={`${item.label} (${TABS.indexOf(item) + 1})`}
            aria-current={on ? "page" : undefined}
            onClick={() => setTab(on && item.id !== "cast" ? "cast" : item.id)}
            className={cn(
              "relative flex min-h-11 flex-col items-center justify-center gap-0.5 py-1.5",
              on ? "text-brass" : "text-muted hover:text-fg",
            )}
          >
            {on ? <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-brass" aria-hidden /> : null}
            <Icon className="size-5" aria-hidden />
            {collapsed ? <span className="sr-only">{item.label}</span> : <span className="text-[10px]">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
