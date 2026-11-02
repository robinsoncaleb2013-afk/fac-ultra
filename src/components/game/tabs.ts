import { Anchor, Backpack, BookOpen, Fish, Map, Store, Trophy } from "lucide-react";
import type { Tab } from "@/game/engine";

export const TABS: { id: Tab; label: string; icon: typeof Fish }[] = [
  { id: "cast", label: "Cast", icon: Fish },
  { id: "bag", label: "Bag", icon: Backpack },
  { id: "gear", label: "Gear", icon: Store },
  { id: "lures", label: "Lures", icon: Anchor },
  { id: "waters", label: "Waters", icon: Map },
  { id: "dex", label: "Dex", icon: BookOpen },
  { id: "lodge", label: "Lodge", icon: Trophy },
];
