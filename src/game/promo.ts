/* Promo codes (Update Three, save v13).

   A code typed in the hub pays out once per save: gold, Glow Worms, and — for the
   first code — a common event started on the spot. Pure: it takes a save and hands
   back a new one, draws no random numbers and touches no store, so the engine action
   is a thin wrapper and every rule here is testable on its own (promo.test.ts).

   About the Glow Worms: a "Glow Worm" is BAIT, not a lure. It is BAITS[1] in
   content.ts ("Mutations 25% more likely on this cast") and it is stored in the
   save's bait box (`baitBox`, keyed by BAITS index as a string) — the same place
   buyBait in engine.ts puts it. There is no lure named "Glow Worm": LURES is the
   50 generated brand lures, and `box` (keyed by LURES index) never holds one.
   So the worms below go into `baitBox`, never `box`. */

import { BAITS } from "./content.ts";
import { EVENT_RARITIES, EVENTS, type EventDef } from "./event-data.ts";
import type { Save } from "./engine.ts";
import type { EventsSave } from "./events.ts";

/** The BAITS index of the Glow Worm, found by name so a table edit cannot quietly move the reward. -1 if it ever vanishes. */
export function glowWormIndex(): number {
  return BAITS.findIndex((b) => b.name === "Glow Worm");
}

export type PromoDef = {
  /** Canonical code: upper-case, no spaces. What `Save.promo` records. */
  code: string;
  /** Gold added to the save's coins (`c`). */
  gold: number;
  /** Glow Worms (bait) added to the save's bait box. */
  glowWorms: number;
  /** True when claiming also starts an event right away. */
  startsEvent: boolean;
  /** Rarity index of the event to start (0 = common). Default 0. */
  eventRarity?: number;
};

/** Promo codes. Update Three codes stay valid; Update Four adds FACISULTRA and UPD4. */
export const PROMO_CODES: readonly PromoDef[] = [
  { code: "FACFIRSTCODE", gold: 500, glowWorms: 5, startsEvent: true },
  { code: "UPD3", gold: 500, glowWorms: 10, startsEvent: false },
  { code: "FACISULTRA", gold: 500, glowWorms: 3, startsEvent: false },
  { code: "UPD4", gold: 100, glowWorms: 0, startsEvent: true, eventRarity: 2 },
];

/** What the player typed, tidied the way codes are stored: trimmed and upper-case. */
export function normalizeCode(raw: string): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

/** The def behind a code the player typed, or undefined when no code matches. */
export function promoDef(rawCode: string): PromoDef | undefined {
  const code = normalizeCode(rawCode);
  return PROMO_CODES.find((d) => d.code === code);
}

/** The event a code starts: first event of the given rarity with no night/Astral lock when possible. */
export function promoEvent(rarity = 0): EventDef {
  const dayOk = (e: EventDef) => !e.night && !e.astral;
  return (
    EVENTS.find((e) => e.rarity === rarity && dayOk(e)) ??
    EVENTS.find((e) => e.rarity === rarity) ??
    EVENTS.find((e) => e.rarity === 0 && dayOk(e)) ??
    EVENTS[0]
  );
}

/** Start `def` the way events.ts itself starts an event in stepEvents: `active` carries the
    id and the wall-clock start/end (the length comes from the event's rarity), and `seen`
    counts it. Nothing else in the events state changes. */
function startEvent(events: EventsSave, def: EventDef, now: number): EventsSave {
  return {
    ...events,
    active: { id: def.id, startedAt: now, endsAt: now + EVENT_RARITIES[def.rarity].minutes * 60_000 },
    seen: { ...events.seen, [def.id]: (events.seen[def.id] ?? 0) + 1 },
  };
}

/** The event still running at `now`, or null (an event past its end time is over, as in events.ts `activeEvent`). */
function runningEvent(events: EventsSave, now: number) {
  return events.active && now < events.active.endsAt ? events.active : null;
}

export type RedeemResult = { s: Save; ok: boolean; message: string };

/**
 * Claim a promo code on a save. Pure: the save passed in is never changed; on success the
 * result carries a new save, on failure it carries the save it was given.
 *
 * - Unknown code: refused, nothing changes.
 * - Code already in `s.promo`: refused, no second payout.
 * - Success: gold added to `c`, the Glow Worms added to `baitBox`, the canonical code
 *   recorded in `promo`, and (for a `startsEvent` code) an event started — unless
 *   one is already running, which is left alone and the message says so.
 */
export function redeemCode(s: Save, rawCode: string, now: number): RedeemResult {
  const def = promoDef(rawCode);
  if (!def) return { s, ok: false, message: "That code does not work. Check the letters and try again." };
  if (s.promo.includes(def.code)) return { s, ok: false, message: "You already claimed that code." };

  const wormAt = glowWormIndex();
  const baitBox =
    wormAt >= 0 && def.glowWorms > 0
      ? { ...s.baitBox, [String(wormAt)]: (s.baitBox[String(wormAt)] ?? 0) + def.glowWorms }
      : s.baitBox;

  let events = s.events;
  let eventLine = "";
  if (def.startsEvent) {
    if (runningEvent(s.events, now)) {
      eventLine = " An event is already running.";
    } else {
      const rarity = def.eventRarity ?? 0;
      events = startEvent(s.events, promoEvent(rarity), now);
      const label = rarity >= 2 ? "rare" : "common";
      eventLine = ` A ${label} event has started!`;
    }
  }

  const next: Save = {
    ...s,
    c: s.c + def.gold,
    baitBox,
    promo: [...s.promo, def.code],
    events,
  };
  const wormPart = def.glowWorms > 0 ? ` and ${def.glowWorms} Glow Worms` : "";
  return { s: next, ok: true, message: `You got ${def.gold} gold${wormPart}.${eventLine}` };
}
