import { Anchor, Backpack, BookOpen, Fish, Map, Store, Tent, Trophy } from "lucide-react";
import type { Mode } from "@/game/modes";
import { MODES } from "@/game/modes";
import type { Tab } from "@/game/engine";

type TabInfo = { id: Tab; label: string; icon: typeof Fish };

export const TABS: TabInfo[] = [
  { id: "cast", label: "Cast", icon: Fish },
  { id: "bag", label: "Bag", icon: Backpack },
  { id: "gear", label: "Gear", icon: Store },
  { id: "lures", label: "Lures", icon: Anchor },
  { id: "waters", label: "Waters", icon: Map },
  { id: "dex", label: "Dex", icon: BookOpen },
  { id: "lodge", label: "Lodge", icon: Trophy },
];

/** Survival has no shop, lures or travel: you fish, you camp, you look at what you found (WP-5). */
const SURVIVAL_TABS: TabInfo[] = [
  TABS[0],
  { id: "camp", label: "Camp", icon: Tent },
  TABS[5],
  { ...TABS[6], label: "Runs" },
];

/** The tabs the rail or bottom bar shows in this mode. The number keys follow this order. */
export function tabsFor(mode: Mode): TabInfo[] {
  return MODES[mode].survival ? SURVIVAL_TABS : TABS;
}
