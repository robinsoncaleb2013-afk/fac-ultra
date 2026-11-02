/* Small hooks for the fun layer's screens (kept apart from the components so fast refresh stays happy). */

import { useEffect, useState } from "react";
import { useGame } from "@/game/engine";
import { claimStreak, fotdClaimedToday, fotdFor, today } from "@/game/fotd";
import { funModeOn } from "@/game/fun";
import { MODES } from "@/game/modes";

/** Re-render every `ms` (the clock-driven bits: the gift timer, a new day). */
export function useTick(ms = 30_000) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((x) => x + 1), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return n;
}


export function useFunOn() {
  return useGame((s) => funModeOn(MODES[s.mode]));
}


/** Puts `data-cb` on <html> for the colour-blind palette (styles.css). */
export function useCbAttr() {
  const on = useGame((s) => s.cb);
  useEffect(() => {
    const root = document.documentElement;
    if (on) root.dataset.cb = "1";
    else delete root.dataset.cb;
    return () => {
      delete root.dataset.cb;
    };
  }, [on]);
}


/** Today's Fish of the Day among the waters this angler has open, and whether it is already caught. */
export function useFotd() {
  const ub = useGame((s) => s.ub);
  const claimed = useGame((s) => s.fotdClaimed);
  const on = useFunOn();
  useTick(60_000);
  const date = today();
  const fotd = on ? fotdFor(date, ub) : null;
  return { fotd, done: fotdClaimedToday(claimed, date), streak: claimStreak(claimed, date), date };
}
