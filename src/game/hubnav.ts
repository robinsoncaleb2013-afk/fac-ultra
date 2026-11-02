/* Navigating the Hub with keys, a gamepad and the keyboard shortcuts (docs/architecture/09 §2.3, WP-10).
   Pure: a key code in, an action out; a gamepad snapshot in, a list of actions out. The component applies them. */

import { MODES, type MenuTabId, type Mode } from "./modes.ts";
import type { LodgeView, Tab } from "./engine.ts";

/* Two levels of menu (WP-12, Caleb's feedback). The MAIN menu is outside any game: Play (pick a mode), a read-only look at
   your collections, friends, your account and the settings. The IN-GAME menu belongs to the mode you are fishing: its tabs
   come from `MODES[mode].menuTabs`, so a new mode is data and nothing here needs an `if`. */

/** Level 1: the main menu. Nothing here can sell, buy, craft, cast or change a game. */
export type MainTab = "play" | "collections" | "friends" | "account" | "settings";
/** Level 2: the in-game menu (see modes.ts). */
export type HubTab = MenuTabId | MainTab;

export const MAIN_TABS: readonly MainTab[] = ["play", "collections", "friends", "account", "settings"];

export const HUB_TABS: readonly { id: HubTab; label: string; blurb: string }[] = [
  { id: "play", label: "Play", blurb: "Pick how you want to fish" },
  { id: "collections", label: "Collections", blurb: "Look at your fish and trophies" },
  { id: "friends", label: "Friends", blurb: "Add, accept, remove or block" },
  { id: "account", label: "Account", blurb: "Sign in and keep your fish safe in the cloud" },
  { id: "tackle", label: "Tackle", blurb: "The rods, lures and bait you carry" },
  { id: "shop", label: "Shop & Sell", blurb: "Sell your fish and buy new gear" },
  { id: "lodge", label: "Lodge", blurb: "Your trophies, records and fish book" },
  { id: "waters", label: "Waters", blurb: "Where to fish, and the spots in each" },
  { id: "players", label: "Players", blurb: "Friends and events" },
  { id: "camp", label: "Camp", blurb: "Eat, make things and rest" },
  { id: "larder", label: "Larder", blurb: "The fish you are keeping" },
  { id: "log", label: "Log", blurb: "Your best runs and every run you finished" },
  { id: "logbook", label: "Logbook", blurb: "Every fishing trip you took" },
  { id: "collection", label: "Collection", blurb: "Your fish book, records and buddy" },
  { id: "event", label: "Event", blurb: "The clock, the board and your standing" },
  { id: "settings", label: "Settings", blurb: "Sound, picture, full screen and controls" },
];

/** Which tabs the in-game menu shows for a mode, in order. It is the mode's own list. */
export function tabsForMode(mode: Mode): HubTab[] {
  return [...MODES[mode].menuTabs];
}

/** The tabs for whichever level is showing: the main menu outside a game, the mode's menu inside one. */
export function tabsFor(screen: "menu" | "game", mode: Mode): HubTab[] {
  return screen === "menu" ? [...MAIN_TABS] : tabsForMode(mode);
}

/* What the main menu must never offer: anything that changes a game. (A test walks this list.) */
export const MAIN_MENU_FORBIDDEN: readonly string[] = ["shop", "tackle", "camp", "larder", "waters", "event", "lodge"];

/** The old panel names (cast/bag/gear/…) open the menu at the matching tab and item. This is the career-shaped answer;
    `resolveHubTarget` then moves it to where the current mode keeps that thing. */
export function hubTargetFor(tab: Tab, lodgeView: LodgeView): { tab: HubTab; item?: string } | null {
  switch (tab) {
    case "cast":
      return null;
    case "bag":
      return { tab: "tackle", item: "satchel" };
    case "gear":
      return { tab: "tackle", item: "rod" };
    case "lures":
      return { tab: "tackle", item: "box" };
    case "camp":
      return { tab: "camp" };
    case "waters":
      return { tab: "waters" };
    case "dex":
      return { tab: "lodge", item: "book" };
    case "lodge":
      return lodgeView === "settings" ? { tab: "settings" } : { tab: "lodge", item: lodgeView };
  }
}

/** Move a request ("open the Lodge on the logbook") to the tab this mode really has for it. A tab the mode does not show
    falls back to the nearest thing it does, then to its first tab. Pure. */
export function resolveHubTarget(tabs: readonly HubTab[], want: HubTab, item?: string): { tab: HubTab; item?: string } {
  const has = (t: HubTab) => tabs.includes(t);
  if (item === "satchel" && has("larder") && !has("tackle")) return { tab: "larder" };
  if (item === "camp" && has("camp")) return { tab: "camp" };
  if (want === "tackle" && item === "satchel" && has("tackle")) return { tab: "tackle", item };
  if (want === "lodge" && !has("lodge")) {
    if (item === "logbook" && has("logbook")) return { tab: "logbook" };
    if (has("collection")) return { tab: "collection", item: item === "logbook" ? undefined : item };
    if (has("log")) return { tab: "log", item };
  }
  if (want === "tackle" && !has("tackle")) {
    if (has("camp")) return { tab: "camp" };
    if (has("event")) return { tab: "event" };
  }
  if (want === "players" && has("friends")) return { tab: "friends", item };
  if (want === "players" && !has("players") && has("event")) return { tab: "event" };
  if (want === "shop" && !has("shop") && has("tackle")) return { tab: "tackle" };
  if (has(want)) return { tab: want, item };
  return { tab: tabs[0] };
}

export type NavAction = "up" | "down" | "left" | "right" | "prevTab" | "nextTab" | "select" | "back" | "close";

export function keyAction(code: string): NavAction | null {
  switch (code) {
    case "ArrowUp":
    case "KeyW":
      return "up";
    case "ArrowDown":
    case "KeyS":
      return "down";
    case "ArrowLeft":
    case "KeyA":
      return "left";
    case "ArrowRight":
    case "KeyD":
      return "right";
    case "KeyQ":
    case "PageUp":
      return "prevTab";
    case "KeyE":
    case "PageDown":
      return "nextTab";
    case "Enter":
    case "Space":
      return "select";
    case "Backspace":
      return "back";
    case "Escape":
      return "close";
    default:
      return null;
  }
}

/** Index after moving `delta` in a list of `n`; stops at the ends unless `wrap`. */
export function stepIndex(i: number, delta: number, n: number, wrap = false): number {
  if (n <= 0) return 0;
  const next = i + delta;
  if (wrap) return ((next % n) + n) % n;
  return Math.min(n - 1, Math.max(0, next));
}

export type NavContext = {
  /** The current tab lays its items out sideways (the Play cards): left and right move between items. */
  horizontal: boolean;
  /** Phones: the detail is showing full screen, so Back returns to the list. */
  inDetail: boolean;
};

export type NavMove = { tab?: -1 | 1; item?: -1 | 1; select?: true; back?: true; close?: true };

/** What an action does here. Up and down move through items; left and right move through the tab strip, or through
    the cards in the Play tab; Q and E always change tab; Esc backs out of a full-screen detail first, then closes. */
export function resolveNav(action: NavAction, ctx: NavContext): NavMove {
  switch (action) {
    case "up":
      return { item: -1 };
    case "down":
      return { item: 1 };
    case "left":
      return ctx.horizontal ? { item: -1 } : { tab: -1 };
    case "right":
      return ctx.horizontal ? { item: 1 } : { tab: 1 };
    case "prevTab":
      return { tab: -1 };
    case "nextTab":
      return { tab: 1 };
    case "select":
      return { select: true };
    case "back":
      return ctx.inDetail ? { back: true } : {};
    case "close":
      return ctx.inDetail ? { back: true } : { close: true };
  }
}

/* ── Gamepad ───────────────────────────────────────────────────────────── */

export type PadSnap = { buttons: boolean[]; axes: number[] };
export const EMPTY_PAD: PadSnap = { buttons: [], axes: [] };

/* Standard mapping: 0 A · 1 B · 3 Y · 4 LB · 5 RB · 6 LT · 9 Start · 12–15 d-pad. */
export const PAD = { A: 0, B: 1, Y: 3, LB: 4, RB: 5, LT: 6, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;
export const STICK = 0.6;
export const REPEAT_FIRST_MS = 350;
export const REPEAT_MS = 130;

export type PadMemory = { prev: PadSnap; held: Partial<Record<"up" | "down" | "left" | "right", { since: number; last: number }>> };
export const freshPad = (): PadMemory => ({ prev: EMPTY_PAD, held: {} });

const pressed = (s: PadSnap, i: number) => !!s.buttons[i];

/** Directions held on a snapshot (d-pad or left stick). */
export function heldDirs(s: PadSnap): Array<"up" | "down" | "left" | "right"> {
  const out: Array<"up" | "down" | "left" | "right"> = [];
  const x = s.axes[0] ?? 0;
  const y = s.axes[1] ?? 0;
  if (pressed(s, PAD.UP) || y < -STICK) out.push("up");
  if (pressed(s, PAD.DOWN) || y > STICK) out.push("down");
  if (pressed(s, PAD.LEFT) || x < -STICK) out.push("left");
  if (pressed(s, PAD.RIGHT) || x > STICK) out.push("right");
  return out;
}

export type PadEvent = NavAction | "toggleHub" | "wheelDown" | "wheelUp" | "satchelDown" | "satchelUp";

/** Turn this frame's gamepad state into actions: edges for buttons, and a steady repeat for held directions. */
export function padEvents(mem: PadMemory, next: PadSnap, now: number): { mem: PadMemory; events: PadEvent[] } {
  const events: PadEvent[] = [];
  const edge = (i: number) => pressed(next, i) && !pressed(mem.prev, i);
  const release = (i: number) => !pressed(next, i) && pressed(mem.prev, i);
  if (edge(PAD.A)) events.push("select");
  if (edge(PAD.B)) events.push("close");
  if (edge(PAD.LB)) events.push("prevTab");
  if (edge(PAD.RB)) events.push("nextTab");
  if (edge(PAD.START)) events.push("toggleHub");
  if (edge(PAD.LT)) events.push("wheelDown");
  if (release(PAD.LT)) events.push("wheelUp");
  if (edge(PAD.Y)) events.push("satchelDown");
  if (release(PAD.Y)) events.push("satchelUp");
  const held: PadMemory["held"] = {};
  for (const d of heldDirs(next)) {
    const was = mem.held[d];
    if (!was) {
      events.push(d);
      held[d] = { since: now, last: now };
    } else if (now - was.since >= REPEAT_FIRST_MS && now - was.last >= REPEAT_MS) {
      events.push(d);
      held[d] = { since: was.since, last: now };
    } else held[d] = was;
  }
  return { mem: { prev: next, held }, events };
}

/** Which slice of a wheel with `n` slots a pointer or stick at (dx, dy) from the centre is pointing at, or -1 near the middle.
    Slice 0 is straight up; they go clockwise. */
export function wheelSlice(dx: number, dy: number, n: number, deadzone = 24): number {
  if (n <= 0 || Math.hypot(dx, dy) < deadzone) return -1;
  const angle = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
  const size = (Math.PI * 2) / n;
  return Math.floor(((angle + size / 2) % (Math.PI * 2)) / size);
}
