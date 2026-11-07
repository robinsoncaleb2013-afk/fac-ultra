/* Night fishing (Update Three, P3): solo, away-from-keyboard fishing.

   You switch it on, walk away, and fish are caught on their own at about one
   every four minutes, up to eight hours. Collecting settles the whole stretch
   at once, the way `settleTank` in engine.ts settles the Aquarium: one pure
   function over the save and the clock, returning the new save plus a report
   the welcome-back message is built from.

   The settle works at the SUMMARY level only (see INTEGRATION-P34.md): each
   settled catch credits its fish's value in gold and its XP directly, and
   bumps the dex count, `tot` and `caught`. It does not run the engine's
   catch pipeline, so no bag fish, records, mutations, stickers or tank
   exhibits come out of a night — the coordinator's note says this plainly.

   Nothing here excludes Kid Mode: night fishing is available in Kid Mode
   too (it is solo and needs no fast hands). Pure: no store, no browser. */

import { baseValue, baseWeight, BIOMES, fishWeights, rarityOf } from "./content.ts";
import type { Save } from "./engine.ts";
import { catchXp } from "./keep.ts";
import { weighted, type Rng } from "./rng.ts";

/** Bosses beaten before night fishing opens. */
export const NIGHT_BOSSES_NEEDED = 5;
/** Level reached before night fishing opens. */
export const NIGHT_LEVEL_NEEDED = 45;
/** One fish is caught about this often while night fishing is on. */
export const NIGHT_CATCH_MS = 4 * 60_000;
/** A night never settles more than this many hours, however long you were away. */
export const NIGHT_CAP_HOURS = 8;
/** The cap above, in milliseconds. */
export const NIGHT_CAP_MS = NIGHT_CAP_HOURS * 3_600_000;

/** Both gates, together: enough bosses beaten AND a high enough level. */
export function nightUnlocked(s: Save): boolean {
  return s.bosses >= NIGHT_BOSSES_NEEDED && s.lv >= NIGHT_LEVEL_NEEDED;
}

export type NightProgress = {
  bosses: number;
  bossesNeeded: number;
  level: number;
  levelNeeded: number;
  unlocked: boolean;
};

/** The two goals, for the hub card to show while night fishing is still locked. */
export function nightProgress(s: Save): NightProgress {
  return {
    bosses: s.bosses,
    bossesNeeded: NIGHT_BOSSES_NEEDED,
    level: s.lv,
    levelNeeded: NIGHT_LEVEL_NEEDED,
    unlocked: nightUnlocked(s),
  };
}

/** Switch night fishing on. A locked save, or one already fishing, comes back unchanged. */
export function startNight(s: Save, now: number): Save {
  if (!nightUnlocked(s) || s.night.on) return s;
  return { ...s, night: { on: true, since: now } };
}

export type NightReport = {
  /** Fish caught in the settled stretch. */
  count: number;
  /** Gold those fish are worth, already credited to the save. */
  gold: number;
  /** XP those fish give, already credited to the save. */
  xp: number;
  /** Species names caught, one per fish, for the welcome-back message. */
  names: string[];
  /** Hours settled (the capped stretch, like settleTank's hours). */
  hours: number;
};

export type NightSettle = { s: Save; report: NightReport };

const NO_CATCHES: NightReport = { count: 0, gold: 0, xp: 0, names: [], hours: 0 };

/**
 * Settle a night that is on, and switch night fishing off.
 *
 * Catches accrue at one per `NIGHT_CATCH_MS` over the elapsed time, capped at
 * `NIGHT_CAP_HOURS`. Each catch picks a species from the save's CURRENT biome
 * with `rand`, using the game's own catch table at its base luck — common-heavy,
 * and the boss (slot 24) is never picked, exactly as a normal cast at base luck
 * weights it. The fish's gold is `baseValue` and its XP is `catchXp` with no
 * mutation, the same numbers a plain landed fish of that species is built from.
 *
 * The settled XP is simply added to `s.xp`. The level itself is NOT raised
 * here: `lv` is a stored field (see INTEGRATION-P34.md) and the engine's own
 * level logic owns raising it.
 *
 * If night fishing is off this is a no-op: the same save, an empty report.
 */
export function settleNight(s: Save, now: number, rand: Rng): NightSettle {
  if (!s.night.on) return { s, report: { ...NO_CATCHES, names: [] } };

  const elapsed = Math.min(Math.max(0, now - s.night.since), NIGHT_CAP_MS);
  const hours = elapsed / 3_600_000;
  const count = Math.floor(elapsed / NIGHT_CATCH_MS);
  const off: Save["night"] = { on: false, since: 0 };
  if (count <= 0) return { s: { ...s, night: off }, report: { ...NO_CATCHES, names: [], hours } };

  const biome = s.biome >= 0 && s.biome < BIOMES.length ? s.biome : 0;
  const weights = fishWeights(biome, 0);
  const dex = { ...s.dex };
  const names: string[] = [];
  let gold = 0;
  let xp = 0;
  for (let n = 0; n < count; n++) {
    const i = weighted(weights, rand);
    const key = `${biome}-${i}`;
    const prev = dex[key];
    dex[key] = { c: (prev?.c || 0) + 1, w: Math.max(prev?.w || 0, baseWeight(biome, i)), m: prev?.m ?? 0 };
    gold += baseValue(biome, i);
    xp += catchXp(rarityOf(i), 0, biome, false);
    names.push(BIOMES[biome].fish[i]);
  }

  return {
    s: { ...s, night: off, dex, c: s.c + gold, tot: s.tot + gold, xp: s.xp + xp, caught: s.caught + count },
    report: { count, gold, xp, names, hours },
  };
}
