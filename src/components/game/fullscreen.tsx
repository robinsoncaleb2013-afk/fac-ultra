import { useCallback, useEffect, useState } from "react";
import { useGame } from "@/game/engine";
import {
  browserFsEnv,
  fullscreenSupport,
  HOME_SCREEN_HINT,
  isFullscreen,
  toggleFullscreenWith,
  watchFullscreen,
  type FsSupport,
} from "@/game/fullscreen";
import { Icon } from "@/components/game/hub/icons";
import { cn } from "@/lib/cn";

/** Toggle full screen from anywhere (the F key, the corner button, Settings). iPhone Safari gets the Home Screen hint instead. */
export async function toggleFullscreen() {
  try {
    const result = await toggleFullscreenWith(browserFsEnv());
    if (result === "home-screen") useGame.getState().notify(HOME_SCREEN_HINT);
    else if (result === "unavailable") useGame.getState().notify("Full screen isn't available here.");
    return result;
  } catch {
    return "unavailable" as const;
  }
}

/** Whether we are in full screen right now, kept in step with Esc, swipes and our own button. */
export function useFullscreen(): { active: boolean; support: FsSupport; toggle: () => void } {
  const [state, setState] = useState<{ active: boolean; support: FsSupport }>({ active: false, support: "no" });
  useEffect(() => {
    const env = browserFsEnv();
    const update = () => {
      const e = browserFsEnv();
      setState({ active: isFullscreen(e.doc), support: fullscreenSupport(e) });
    };
    update();
    const off = watchFullscreen(env.doc, update);
    window.addEventListener("resize", update);
    return () => {
      off();
      window.removeEventListener("resize", update);
    };
  }, []);
  const toggle = useCallback(() => void toggleFullscreen(), []);
  return { ...state, toggle };
}

/** A 44 px corner button. Hidden where full screen is pointless (an installed copy already has no browser bars) or impossible. */
export function FullscreenButton({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const { active, support, toggle } = useFullscreen();
  if (support === "no" || support === "installed") return null;
  return (
    <button
      type="button"
      onClick={toggle}
      onPointerDown={(e) => e.stopPropagation()}
      aria-pressed={active}
      aria-label={active ? "Leave full screen" : "Full screen"}
      title={active ? "Leave full screen (F)" : "Full screen (F)"}
      className={cn(
        "pointer-events-auto grid size-11 place-items-center rounded-full border backdrop-blur-sm",
        tone === "light" ? "border-white/25 bg-black/35 text-[#fff4d6] hover:border-brass" : "border-[#8a6a2c] bg-white/30 text-[#2a2016]",
        className,
      )}
    >
      <Icon name={active ? "shrink" : "expand"} className="size-5" />
    </button>
  );
}
