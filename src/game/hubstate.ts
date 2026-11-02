/* Which part of the pause menu ("the Hub") is open (docs/architecture/02, WP-10).
   A tiny store of its own: nothing here is saved, and nothing here is a game rule. The game store's setTab() and
   setLodgeView() open the Hub through this, so every old route into a panel still lands somewhere sensible. */

import { create } from "zustand";
import type { HubTab } from "./hubnav.ts";

export type WheelPage = "lures" | "emotes";

type HubUi = {
  open: boolean;
  tab: HubTab;
  /** The highlighted item in each tab (null = the first one). */
  item: Partial<Record<HubTab, string>>;
  /** Phones: the detail of the chosen item is showing full screen. */
  detail: boolean;
  /** A hold-to-open wheel or satchel. `held` is true while a key or button is keeping it open. */
  wheel: { page: WheelPage; held: boolean } | null;
  satchel: { held: boolean } | null;
  /** A gamepad has been seen: the hint bar shows its buttons. */
  pad: boolean;
  openHub: (tab?: HubTab, item?: string) => void;
  closeHub: () => void;
  setTab: (tab: HubTab) => void;
  selectItem: (tab: HubTab, id: string) => void;
  setDetail: (v: boolean) => void;
  openWheel: (page?: WheelPage, held?: boolean) => void;
  closeWheel: () => void;
  openSatchel: (held?: boolean) => void;
  closeSatchel: () => void;
  setPad: (v: boolean) => void;
};

let lastWheel: WheelPage = "lures";

export const useHubUi = create<HubUi>((set, get) => ({
  open: false,
  tab: "play",
  item: {},
  detail: false,
  wheel: null,
  satchel: null,
  pad: false,
  openHub: (tab, item) =>
    set((s) => ({
      open: true,
      wheel: null,
      satchel: null,
      tab: tab ?? s.tab,
      item: item && tab ? { ...s.item, [tab]: item } : s.item,
      detail: !!item,
    })),
  closeHub: () => set({ open: false, detail: false }),
  setTab: (tab) => set({ tab, detail: false }),
  selectItem: (tab, id) => set((s) => ({ item: { ...s.item, [tab]: id } })),
  setDetail: (detail) => set({ detail }),
  openWheel: (page, held = true) => {
    if (get().open) return;
    lastWheel = page ?? lastWheel;
    set({ wheel: { page: lastWheel, held }, satchel: null });
  },
  closeWheel: () => set({ wheel: null }),
  openSatchel: (held = true) => {
    if (get().open) return;
    set({ satchel: { held }, wheel: null });
  },
  closeSatchel: () => set({ satchel: null }),
  setPad: (pad) => set({ pad }),
}));

/** Remember which wheel page was used last, so the next hold opens on it. */
export function rememberWheelPage(p: WheelPage) {
  lastWheel = p;
}
