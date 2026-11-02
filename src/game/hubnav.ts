/* Navigating the Hub with keys, a gamepad and the keyboard shortcuts (docs/architecture/09 §2.3, WP-10).
   Pure: a key code in, an action out; a gamepad snapshot in, a list of actions out. The component applies them. */

import type { Mode } from "./modes.ts";
import type { LodgeView, Tab } from "./engine.ts";

export type HubTab = "play" | "tackle" | "lodge" | "waters" | "players" | "settings";

export const HUB_TABS: readonly { id: HubTab; label: string; blurb: string }[] = [
  { id: "play", label: "Play", blurb: "Pick how you want to fish" },
  { id: "tackle", label: "Tackle", blurb: "Rods, reels, lures and your bag" },
  { id: "lodge", label: "Lodge", blurb: "Your trophies, records and fish book" },
  { id: "waters", label: "Waters", blurb: "Where to fish, and the spots in each" },
  { id: "players", label: "Players", blurb: "Friends and events" },
  { id: "settings", label: "Settings", blurb: "Sound, picture, full screen and your account" },
];

/** Which tabs a mode shows, in order. A tournament event fixes your gear and water; Survival has no shop or travel. */
export function tabsForMode(mode: Mode): HubTab[] {
  if (mode === "tournament") return ["play", "lodge", "players", "settings"];
  if (mode === "survival") return ["play", "tackle", "lodge", "players", "settings"];
  return ["play", "tackle", "lodge", "waters", "players", "settings"];
}

/** The old panel names (cast/bag/gear/…) open the Hub at the matching tab and item. */
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
      return { tab: "tackle", item: "camp" };
    case "waters":
      return { tab: "waters" };
    case "dex":
      return { tab: "lodge", item: "book" };
    case "lodge":
      return lodgeView === "settings" ? { tab: "settings" } : { tab: "lodge", item: lodgeView };
  }
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
