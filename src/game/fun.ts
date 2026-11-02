/* The fun layer's saved fields and how two saves of the same angler combine (docs/architecture/07 §1).
   Expedition and Recreational are one angler's collection, so stickers, shinies, the daily claim,
   the Regulars' scores and the pet are shared between them; Survival and Tournaments have none of it. */

import type { ModeRules } from "./modes.ts";
import { readClaims } from "./fotd.ts";
import { noPet, readPet, type Pet } from "./pet.ts";
import { readRivalRecord, type RivalRecord } from "./rivals.ts";
import { readShiny, readStickers } from "./stickers.ts";

export type Fun = {
  pet: Pet;
  stickers: string[];
  shiny: string[];
  fotdClaimed: string[];
  rivalRecord: RivalRecord;
};

export const noFun = (): Fun => ({ pet: noPet(), stickers: [], shiny: [], fotdClaimed: [], rivalRecord: {} });

export function readFun(o: Record<string, unknown>): Fun {
  return {
    pet: readPet(o.pet),
    stickers: readStickers(o.stickers),
    shiny: readShiny(o.shiny),
    fotdClaimed: readClaims(o.fotdClaimed),
    rivalRecord: readRivalRecord(o.rivalRecord),
  };
}

const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];

/** Both books count: nothing you earned in either mode is lost, and a day's Fish of the Day is claimed once. */
export function mergeFun(a: Fun, b: Fun): Fun {
  const record: RivalRecord = { ...a.rivalRecord };
  for (const [id, e] of Object.entries(b.rivalRecord)) {
    const p = record[id];
    record[id] = p ? { w: Math.max(p.w, e.w), l: Math.max(p.l, e.l) } : { ...e };
  }
  return {
    pet: { kind: a.pet.kind ?? b.pet.kind, next: Math.max(a.pet.next, b.pet.next), gifts: Math.max(a.pet.gifts, b.pet.gifts) },
    stickers: union(a.stickers, b.stickers),
    shiny: union(a.shiny, b.shiny),
    fotdClaimed: union(a.fotdClaimed, b.fotdClaimed).sort().slice(-60),
    rivalRecord: record,
  };
}

/** Where the fun layer runs: the career and Recreational (and local co-op). Tournaments are scored on the server
    from a seed, and Survival keeps its own slot with its own rules, so both leave it out (05 §6). */
export const funModeOn = (r: Pick<ModeRules, "id" | "survival">) => r.id !== "tournament" && !r.survival;
