/* The fun layer's saved fields (docs/architecture/07 §1). Every mode keeps its own: stickers, shinies, the daily
   claim, the Regulars' scores and the pet live in that mode's save slot and nowhere else. Since WP-11 nothing is
   merged between Expedition and Recreational. Survival and Tournaments have none of it. */

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

/** Where the fun layer runs: Expedition and Recreational (and local co-op), each with its own book. Tournaments are scored on the server
    from a seed, and Survival keeps its own slot with its own rules, so both leave it out (05 §6). */
export const funModeOn = (r: Pick<ModeRules, "id" | "survival">) => r.id !== "tournament" && !r.survival;
