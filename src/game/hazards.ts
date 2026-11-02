/* Hardest-difficulty hazards (docs/architecture/12 §3). The dangers Caleb asked for, in ONE data table so each can be
   tuned alone. Pure: every function takes the hazard state and returns a new one plus what changed, in plain English.

   Hazards are on in Expedition at Hard (a small taste) and Legend (all of them), and nowhere else. Kid Mode switches
   them off (the Kid lens beats the level), and Tournament, Recreational, Survival, Co-op and Story never have them.

   Randomness: hazards draw from their OWN seeded stream, `makeRng(seedFrom("hazard", seed, n))`, one draw per
   decision, `n` counted in the save. They never touch `rng()` (the fishing model and the tournament replay), so a
   hazard can never move a bite or a server-verified cast. The same seed and the same actions give the same dangers. */

import { makeRng, seedFrom } from "./rng.ts";
import { BIOMES, BOATS, LURES, rarityOf, SIG_LURES, TANK_TIERS } from "./content.ts";
import type { HazardLevel } from "./difficulty.ts";
import type { Mode } from "./modes.ts";

export type HazardId = "lureSnap" | "rodSnap" | "boatSink" | "wallet" | "tankJump" | "lawsuit";

/** Every tunable number, per hazard. `hard` is the small taste on Hard (0 = none); `full` is Legend. */
export const HAZARD_TABLE = {
  /** A line snaps in a fight: chance the lure you were using is lost. A signature lure is taken first. */
  lureSnap: { hard: 0.08, full: 0.25, packLoss: 3 },
  /** A line snaps against a violent fish (this rarity or better, or a boss): chance the rod is lost. The first rod is never lost. */
  rodSnap: { hard: 0, full: 0.06, minRarity: 3 },
  /** At the start of a cast in a storm with a boat too weak for the water: chance it sinks. The first boat never sinks. */
  boatSink: { hard: 0, full: 0.12, weather: 2, salvageShare: 0.35 },
  /** At the start of a cast: chance the wallet falls in. You lose this share of your money (rounded down). */
  wallet: { hard: 0, full: 0.015, share: 0.12, minMoney: 200 },
  /** Every check: chance a fish in the tank jumps out. You have this long to put it back. */
  tankJump: { hard: 0, full: 0.25, everyMs: 5 * 60_000, windowMs: 30_000, lostForMs: 30 * 60_000 },
  /** Every check while the tank is not good enough: chance a visitor complains. Fix it in time or they sue. */
  lawsuit: { hard: 0, full: 0.35, everyMs: 5 * 60_000, graceMs: 8 * 60_000, share: 0.5, minMoney: 500, cooldownMs: 20 * 60_000 },
} as const;

/** Where hazards may run at all. Everything else is a plain "no". */
export function hazardLevelFor(mode: Mode, level: HazardLevel, kidLens: boolean): HazardLevel {
  if (mode !== "expedition" || kidLens) return "none";
  return level;
}

export const oddsOf = (id: HazardId, level: HazardLevel): number => (level === "none" ? 0 : level === "taste" ? HAZARD_TABLE[id].hard : HAZARD_TABLE[id].full);

export type JumpState = { key: string; until: number };

export type HazardState = {
  /** Fixed when the slot is made. */
  seed: number;
  /** How many decisions have been drawn so far. */
  n: number;
  /** The boat that sank (its index), or -1. Salvage it from the Boats list. */
  sunk: number;
  /** The fish out of the tank right now, and when it is lost. */
  jump: JumpState | null;
  /** Species that jumped out and are not back in a tank yet (key → ms when they may return). */
  lostTank: Record<string, number>;
  /** When an unhappy visitor will sue (ms), or 0 for nobody. */
  grace: number;
  /** Last time a lawsuit was settled (ms). */
  lastSuit: number;
  /** Last time the tank checks ran (ms). */
  lastCheck: number;
};

export function freshHazards(seed = 1): HazardState {
  return { seed: seed >>> 0, n: 0, sunk: -1, jump: null, lostTank: {}, grace: 0, lastSuit: 0, lastCheck: 0 };
}

const fin = (v: unknown, d: number, min: number, max: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : d;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/** Untrusted save data → hazard state. */
export function readHazards(v: unknown, fallbackSeed: number): HazardState {
  const base = freshHazards(fallbackSeed);
  if (!v || typeof v !== "object" || Array.isArray(v)) return base;
  const o = v as Record<string, unknown>;
  const jump = o.jump && typeof o.jump === "object" ? (o.jump as Record<string, unknown>) : null;
  const lost: Record<string, number> = {};
  if (o.lostTank && typeof o.lostTank === "object") {
    for (const [k, t] of Object.entries(o.lostTank as object).slice(0, 400)) {
      if (/^\d+-\d+$/.test(k)) lost[k] = fin(t, 0, 0, 1e15);
    }
  }
  return {
    seed: fin(o.seed, base.seed, 0, 4294967295),
    n: fin(o.n, 0, 0, 1e9),
    sunk: fin(o.sunk, -1, -1, BOATS.length - 1),
    jump: jump && typeof jump.key === "string" && /^\d+-\d+$/.test(jump.key) ? { key: jump.key, until: fin(jump.until, 0, 0, 1e15) } : null,
    lostTank: lost,
    grace: fin(o.grace, 0, 0, 1e15),
    lastSuit: fin(o.lastSuit, 0, 0, 1e15),
    lastCheck: fin(o.lastCheck, 0, 0, 1e15),
  };
}

/** One draw from the hazard stream. Returns the number and the state with the counter moved on. */
export function draw(hz: HazardState): { r: number; hz: HazardState } {
  const r = makeRng(seedFrom("hazard", hz.seed, hz.n))();
  return { r, hz: { ...hz, n: hz.n + 1 } };
}

/** "Does it happen?" for one hazard. Draws only when the odds are above zero, so a level without the hazard never moves the counter. */
export function happens(hz: HazardState, id: HazardId, level: HazardLevel): { hit: boolean; hz: HazardState } {
  const odds = oddsOf(id, level);
  if (odds <= 0) return { hit: false, hz };
  const d = draw(hz);
  return { hit: d.r < odds, hz: d.hz };
}

/* ── What a hazard takes ─────────────────────────────────────────────────── */

export type Gear = { rod: number; boat: number; c: number; lure: number; sig: number; box: Record<string, number>; sigBox: number[] };
export type HazardOutcome = { hz: HazardState; gear: Partial<Gear>; lines: string[] };

const none = (hz: HazardState): HazardOutcome => ({ hz, gear: {}, lines: [] });

/** A line snapped in a fight (`fish` is what was on it). The lure, then the rod, can go. Always says what happened. */
export function onSnap(hz: HazardState, level: HazardLevel, g: Gear, fish: { rarity: number; boss: boolean }): HazardOutcome {
  if (level === "none") return none(hz);
  let state = hz;
  const gear: Partial<Gear> = {};
  const lines: string[] = [];
  const lure = happens(state, "lureSnap", level);
  state = lure.hz;
  if (lure.hit) {
    if (g.sig >= 0 && g.sigBox.includes(g.sig)) {
      gear.sigBox = g.sigBox.filter((i) => i !== g.sig);
      gear.sig = -1;
      lines.push(`The fish took your ${SIG_LURES[g.sig]?.name ?? "lure"}. It is gone.`);
    } else if (g.lure >= 0 && (g.box[String(g.lure)] ?? 0) > 0) {
      const have = g.box[String(g.lure)] ?? 0;
      const lose = Math.min(have, HAZARD_TABLE.lureSnap.packLoss);
      const box = { ...g.box };
      if (have - lose <= 0) delete box[String(g.lure)];
      else box[String(g.lure)] = have - lose;
      gear.box = box;
      if (have - lose <= 0) gear.lure = -1;
      lines.push(`The fish tangled ${lose} of your ${LURES[g.lure]?.name ?? "lures"} and ran. They are gone.`);
    }
    /* No lure to lose (the starter bait): nothing is taken, and nothing is said. */
  }
  const violent = fish.boss || fish.rarity >= HAZARD_TABLE.rodSnap.minRarity;
  if (violent && g.rod > 0) {
    const rod = happens(state, "rodSnap", level);
    state = rod.hz;
    if (rod.hit) {
      gear.rod = g.rod - 1;
      lines.push("It was too strong. Your rod broke and went into the water. You are back to your last rod.");
    }
  }
  return { hz: state, gear, lines };
}

/** The weakest boat that is safe on a water. */
export function boatNeeded(biome: number): number {
  return Math.min(BOATS.length - 1, Math.floor((biome * BOATS.length) / BIOMES.length));
}

/** The price to bring a sunk boat back up. */
export function salvageCost(boat: number): number {
  return Math.round((BOATS[boat]?.price ?? 0) * HAZARD_TABLE.boatSink.salvageShare);
}

/** Checked at the start of a cast: the boat and the wallet. */
export function onCast(hz: HazardState, level: HazardLevel, g: Gear, at: { weather: number; biome: number }): HazardOutcome {
  if (level === "none") return none(hz);
  let state = hz;
  const gear: Partial<Gear> = {};
  const lines: string[] = [];
  if (g.boat > 0 && at.weather === HAZARD_TABLE.boatSink.weather && g.boat < boatNeeded(at.biome)) {
    const r = happens(state, "boatSink", level);
    state = r.hz;
    if (r.hit) {
      state = { ...state, sunk: g.boat };
      gear.boat = 0;
      lines.push(`The storm sank your ${BOATS[g.boat].name}. You are back on the shore. Raise it again for ${salvageCost(g.boat)} coins.`);
    }
  }
  if (g.c >= HAZARD_TABLE.wallet.minMoney) {
    const r = happens(state, "wallet", level);
    state = r.hz;
    if (r.hit) {
      const lost = walletLoss(g.c);
      gear.c = g.c - lost;
      lines.push(`Splash! Your wallet fell in the water. You lost ${lost} coins.`);
    }
  }
  return { hz: state, gear, lines };
}

/** Coins lost when the wallet falls in. */
export function walletLoss(c: number): number {
  return c < HAZARD_TABLE.wallet.minMoney ? 0 : Math.floor(c * HAZARD_TABLE.wallet.share);
}

/* ── The tank: jumpers and lawsuits ──────────────────────────────────────── */

export type Tank = { tier: number; exhibits: string[] };

/** What visitors expect of the tank: this many fish, and an average rarity (0 to 4) of at least this. */
export function tankExpectation(tier: number): { minFish: number; minRarity: number } {
  const slots = TANK_TIERS[Math.min(TANK_TIERS.length - 1, Math.max(0, tier))].slots;
  return { minFish: Math.ceil(slots / 3), minRarity: 0.5 + tier * 0.75 };
}

/** The average rarity of what is in the tank. */
export function tankRarity(exhibits: readonly string[]): number {
  if (!exhibits.length) return 0;
  let sum = 0;
  for (const k of exhibits) sum += rarityOf(Number(k.split("-")[1]) || 0);
  return sum / exhibits.length;
}

/** Does the tank meet what visitors expect? A tank nobody has set up yet has no visitors to disappoint. */
export function tankMeetsExpectations(tank: Tank): boolean {
  if (tank.exhibits.length === 0) return true;
  const e = tankExpectation(tank.tier);
  return tank.exhibits.length >= e.minFish && tankRarity(tank.exhibits) >= e.minRarity;
}

/** The plain-English reason a tank is not good enough, or "" when it is. */
export function tankComplaint(tank: Tank): string {
  if (tankMeetsExpectations(tank)) return "";
  const e = tankExpectation(tank.tier);
  if (tank.exhibits.length < e.minFish) return `Visitors want at least ${e.minFish} fish in the tank.`;
  return "Visitors want better fish in the tank. Add some rarer ones.";
}

/** The sad split of a lawsuit. The plaintiff gets half; with an odd amount they get the bigger half. */
export function lawsuitSplit(c: number): { theyGet: number; youKeep: number } {
  const total = Math.max(0, Math.floor(c));
  const gets = Math.min(total, Math.ceil(total * HAZARD_TABLE.lawsuit.share));
  return { theyGet: gets, youKeep: total - gets };
}

export type TankEvent =
  | { kind: "jump"; key: string; until: number }
  | { kind: "lost"; key: string }
  | { kind: "complaint"; text: string; until: number }
  | { kind: "calm" }
  | { kind: "sued"; theyGet: number; youKeep: number };

export type TankOutcome = { hz: HazardState; exhibits: string[]; c: number; events: TankEvent[]; lines: string[] };

/** The time-based checks. Call it often (every few seconds is fine): it only acts when a window ends or a check is due. */
export function tickTank(hz: HazardState, level: HazardLevel, tank: Tank, c: number, now: number): TankOutcome {
  let state = hz;
  let exhibits = tank.exhibits;
  let money = c;
  const events: TankEvent[] = [];
  const lines: string[] = [];
  if (level === "none") {
    if (state.jump || state.grace) state = { ...state, jump: null, grace: 0 };
    return { hz: state, exhibits, c: money, events, lines };
  }
  /* A fish that was not put back in time is lost. */
  if (state.jump && now >= state.jump.until) {
    const key = state.jump.key;
    exhibits = exhibits.filter((k) => k !== key);
    state = { ...state, jump: null, lostTank: { ...state.lostTank, [key]: now + HAZARD_TABLE.tankJump.lostForMs } };
    events.push({ kind: "lost", key });
    lines.push("You were too slow. The fish that jumped out of the tank is gone for a while.");
  }
  /* Forget species whose time away is over. */
  const back = Object.entries(state.lostTank).filter(([, t]) => t <= now);
  if (back.length) {
    const rest = { ...state.lostTank };
    for (const [k] of back) delete rest[k];
    state = { ...state, lostTank: rest };
  }
  /* A visitor who was unhappy: fixed in time, or they sue. */
  if (state.grace) {
    const t = { ...tank, exhibits };
    if (tankMeetsExpectations(t)) {
      state = { ...state, grace: 0 };
      events.push({ kind: "calm" });
      lines.push("The visitors like your tank now. No lawsuit.");
    } else if (now >= state.grace) {
      const split = lawsuitSplit(money);
      money -= split.theyGet;
      state = { ...state, grace: 0, lastSuit: now };
      events.push({ kind: "sued", ...split });
      lines.push(`A visitor sued you because the tank was not good enough. They took ${split.theyGet} coins, half of your money. You kept ${split.youKeep}.`);
    }
  }
  /* The periodic checks. */
  if (now - state.lastCheck >= Math.min(HAZARD_TABLE.tankJump.everyMs, HAZARD_TABLE.lawsuit.everyMs)) {
    state = { ...state, lastCheck: now };
    if (!state.jump && exhibits.length > 0) {
      const r = happens(state, "tankJump", level);
      state = r.hz;
      if (r.hit) {
        const d = draw(state);
        state = d.hz;
        const key = exhibits[Math.min(exhibits.length - 1, Math.floor(d.r * exhibits.length))];
        state = { ...state, jump: { key, until: now + HAZARD_TABLE.tankJump.windowMs } };
        events.push({ kind: "jump", key, until: state.jump!.until });
        lines.push("A fish jumped out of the tank! Put it back before it is lost.");
      }
    }
    const t = { ...tank, exhibits };
    if (!state.grace && !tankMeetsExpectations(t) && money >= HAZARD_TABLE.lawsuit.minMoney && now - state.lastSuit >= HAZARD_TABLE.lawsuit.cooldownMs) {
      const r = happens(state, "lawsuit", level);
      state = r.hz;
      if (r.hit) {
        state = { ...state, grace: now + HAZARD_TABLE.lawsuit.graceMs };
        const text = tankComplaint(t);
        events.push({ kind: "complaint", text, until: state.grace });
        lines.push(`A visitor is unhappy and may sue you. ${text} You have ${Math.round(HAZARD_TABLE.lawsuit.graceMs / 60_000)} minutes.`);
      }
    }
  }
  return { hz: state, exhibits, c: money, events, lines };
}

/** Put the jumping fish back. */
export function putBack(hz: HazardState, now: number): { ok: boolean; hz: HazardState } {
  if (!hz.jump || now >= hz.jump.until) return { ok: false, hz };
  return { ok: true, hz: { ...hz, jump: null } };
}

/** May this species go back in a tank? (False for a while after it jumped out.) */
export function mayExhibit(hz: HazardState, key: string, now: number): { ok: boolean; minutes: number } {
  const t = hz.lostTank[key] ?? 0;
  return t > now ? { ok: false, minutes: Math.max(1, Math.ceil((t - now) / 60_000)) } : { ok: true, minutes: 0 };
}
