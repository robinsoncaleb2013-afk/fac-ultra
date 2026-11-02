/* What the arrow keys, the Enter key and a gamepad do inside the Hub. One place, so a keyboard and a gamepad behave alike. */

import { useGame } from "@/game/engine";
import { stepIndex, tabsForMode, type HubTab } from "@/game/hubnav";
import { useHubUi } from "@/game/hubstate";
import { pickNeighbor, type Dir, type Rect } from "@/game/spatial";

const root = () => document.querySelector<HTMLElement>("[data-hub-root]");

function focusables(): HTMLElement[] {
  const r = root();
  if (!r) return [];
  return [...r.querySelectorAll<HTMLElement>("[data-nav]")].filter((el) => {
    if ((el as HTMLButtonElement).disabled) return false;
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  });
}

const rectOf = (el: HTMLElement): Rect => {
  const b = el.getBoundingClientRect();
  return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
};

/** The tabs this mode shows, in order. */
export const currentTabs = (): HubTab[] => tabsForMode(useGame.getState().mode);

/** Move to the next or previous tab. Returns false at either end. */
export function hubTab(delta: -1 | 1): boolean {
  const tabs = currentTabs();
  const hub = useHubUi.getState();
  const i = tabs.indexOf(hub.tab);
  const next = stepIndex(i < 0 ? 0 : i, delta, tabs.length);
  if (next === i) return false;
  hub.setTab(tabs[next]);
  return true;
}

/** Focus the first thing in the body (or the selected item), so the keys have somewhere to start. */
export function hubFocusFirst() {
  const r = root();
  if (!r) return;
  const sel = r.querySelector<HTMLElement>('[data-nav][aria-selected="true"]');
  const first = sel ?? focusables().find((el) => el.dataset.nav !== "tab") ?? focusables()[0];
  first?.focus({ preventScroll: false });
}

/** Move focus up, down, left or right. Left and right past the edge change tab. */
export function hubMove(dir: Dir) {
  const items = focusables();
  const active = document.activeElement as HTMLElement | null;
  if (!active || !items.includes(active)) return hubFocusFirst();
  const others = items.filter((el) => el !== active);
  const i = pickNeighbor(rectOf(active), others.map(rectOf), dir);
  if (i >= 0) {
    others[i].focus();
    others[i].scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }
  if (dir === "left" || dir === "right") {
    if (hubTab(dir === "left" ? -1 : 1)) window.setTimeout(hubFocusFirst, 30);
  }
}

/** Enter or A: press whatever has focus. */
export function hubSelect() {
  const active = document.activeElement as HTMLElement | null;
  if (active && root()?.contains(active) && active !== document.body) return void active.click();
  hubFocusFirst();
}

/** Esc or B: leave a full-screen detail first; otherwise close the menu. Returns true if the menu closed. */
export function hubBack(): boolean {
  const hub = useHubUi.getState();
  if (hub.detail) {
    hub.setDetail(false);
    window.setTimeout(hubFocusFirst, 30);
    return false;
  }
  closeHub();
  return true;
}

/** Close the menu and return to the water (or the title screen). */
export function closeHub() {
  /* setTab("cast") closes the Hub and puts the game's own tab back. */
  useGame.getState().setTab("cast");
  useHubUi.getState().closeHub();
}
