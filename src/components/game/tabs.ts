import { Anchor, Backpack, BookOpen, Fish, Map, Store, Trophy } from "lucide-react";
import { useGame, type Tab } from "@/game/engine";
import { TOURNAMENT_TABS } from "@/game/modes";

export const TABS: { id: Tab; label: string; icon: typeof Fish }[] = [
  { id: "cast", label: "Cast", icon: Fish },
  { id: "bag", label: "Bag", icon: Backpack },
  { id: "gear", label: "Gear", icon: Store },
  { id: "lures", label: "Lures", icon: Anchor },
  { id: "waters", label: "Waters", icon: Map },
  { id: "dex", label: "Dex", icon: BookOpen },
  { id: "lodge", label: "Lodge", icon: Trophy },
];

/** The tabs for the mode being played: an event shows only Cast, Dex and Lodge. */
export function useTabs() {
  const tournament = useGame((s) => s.mode === "tournament");
  return tournament ? TABS.filter((t) => TOURNAMENT_TABS.includes(t.id)) : TABS;
}
