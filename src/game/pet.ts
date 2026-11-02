/* The pet companion (docs/architecture/05 §6.2).

   At level 5 you may pick an otter, a heron or a dog. It sits at the water's edge,
   reacts to catches, and once an hour brings you a lure that matches the best fish you
   have not caught yet at your current spot, which teaches the match system. The pet
   is cosmetic plus that one hint: it never changes a bite, a fight or a score.

   Pure and seeded. The store calls these; the drawing is in components/game/pet-fx.ts. */

import { BIOMES, BOSS_INDEX, LURES, type Dex } from "./content.ts";
import { habitOf } from "./habits.ts";
import { FAMILY_INFO, type LureFamily } from "./presentation.ts";
import { makeRng, seedFrom } from "./rng.ts";
import { resolveSpot, type Spot } from "./spots.ts";

export const PET_KINDS = ["otter", "heron", "dog"] as const;
export type PetKind = (typeof PET_KINDS)[number];

/** The level that opens the pet. */
export const PET_LEVEL = 5;
/** A real hour between gifts. */
export const GIFT_MS = 3_600_000;
/** How many of the lure the pet brings. */
export const GIFT_QTY = 5;

export type PetReaction = "clap" | "tilt" | "wag";

export const PETS: Record<PetKind, { label: string; emoji: string; reaction: PetReaction; blurb: string; cheer: string }> = {
  otter: { label: "Otter", emoji: "🦦", reaction: "clap", blurb: "Claps its paws at every catch.", cheer: "Your otter claps!" },
  heron: { label: "Heron", emoji: "🪶", reaction: "tilt", blurb: "Tilts its head and stands very tall.", cheer: "Your heron stands tall!" },
  dog: { label: "Dog", emoji: "🐕", reaction: "wag", blurb: "Wags its tail and wiggles all over.", cheer: "Your dog wags its tail!" },
};

/** `kind` null = no pet yet. `next` is the real time (ms) the next gift is ready. */
export type Pet = { kind: PetKind | null; next: number; gifts: number };

export const noPet = (): Pet => ({ kind: null, next: 0, gifts: 0 });

export const isPetKind = (v: unknown): v is PetKind => typeof v === "string" && (PET_KINDS as readonly string[]).includes(v);

export const petUnlocked = (level: number) => level >= PET_LEVEL;

/** Pick (or change) the pet. A new pet's first gift is ready straight away, as a welcome; a change keeps the timer. */
export function adopt(pet: Pet, kind: PetKind, now: number): Pet {
  if (!isPetKind(kind)) return pet;
  return { kind, next: pet.kind ? pet.next : now, gifts: pet.gifts };
}

export function giftReady(pet: Pet, now: number): boolean {
  return pet.kind !== null && now >= pet.next;
}

/** Whole minutes until the next gift (0 when it is ready). */
export function minutesToGift(pet: Pet, now: number): number {
  return pet.kind === null ? 0 : Math.max(0, Math.ceil((pet.next - now) / 60_000));
}

export type Gift = {
  /** Index into LURES. */
  lure: number;
  qty: number;
  /** The fish the lure is meant for (a species index in this water). */
  species: number;
  family: LureFamily;
  /** The sentence that teaches the match, in plain English. */
  say: string;
};

/** The best fish you have not caught yet at this spot: the commonest one that holds here, else the commonest one in the water. */
export function bestUncaught(biome: number, spot: Spot, dex: Dex): number {
  let any = -1;
  for (let i = 0; i < BOSS_INDEX; i++) {
    if (dex[`${biome}-${i}`]?.c) continue;
    if (any < 0) any = i;
    if (habitOf(biome, i).structures.includes(spot.structure)) return i;
  }
  return any;
}

/** What the pet brings. The same pet, the same water and the same gift count always bring the same thing. */
export function chooseGift(a: { biome: number; spotId?: string; dex: Dex; gifts: number; kind: PetKind }): Gift {
  const spot = resolveSpot(a.biome, a.spotId);
  const r = makeRng(seedFrom("petgift", a.kind, a.biome, a.gifts));
  let species = bestUncaught(a.biome, spot, a.dex);
  /* Page finished: any fish at this spot will do, so the pet is still useful. */
  if (species < 0) species = Math.floor(r() * BOSS_INDEX);
  /* A lure is what the pet carries, so aim at a fish that takes one (some only take baits like cut bait or dough). */
  const lureFamilies = (i: number) => habitOf(a.biome, i).likes.filter((f) => LURES.some((l) => l.family === f));
  if (!lureFamilies(species).length) {
    const order = Array.from({ length: BOSS_INDEX }, (_, i) => i).sort(
      (x, y) => Number(!!a.dex[`${a.biome}-${x}`]?.c) - Number(!!a.dex[`${a.biome}-${y}`]?.c) || x - y,
    );
    species = order.find((i) => lureFamilies(i).length) ?? species;
  }
  const fams = lureFamilies(species);
  const family = (fams.length ? fams : habitOf(a.biome, species).likes)[Math.floor(r() * (fams.length || 1))];
  const options: number[] = [];
  LURES.forEach((l, i) => {
    if (l.family === family) options.push(i);
  });
  /* No procedural lure at all for the family (cannot happen today): a crank, so the gift is never empty. */
  const pool = options.length ? options : LURES.map((_, i) => i).filter((i) => LURES[i].family === "crank");
  const lure = pool[Math.floor(r() * pool.length)];
  const fish = BIOMES[a.biome].fish[species];
  const say = `${PETS[a.kind].label} brought you a ${LURES[lure].name}. ${fish} like ${FAMILY_INFO[family].plural}: try it at ${spot.name}.`;
  return { lure, qty: GIFT_QTY, species, family, say };
}

/** Take the gift: the next one is an hour away. */
export function takeGift(pet: Pet, now: number): Pet {
  return { ...pet, next: now + GIFT_MS, gifts: Math.min(99999, pet.gifts + 1) };
}

export function readPet(v: unknown): Pet {
  if (!v || typeof v !== "object" || Array.isArray(v)) return noPet();
  const o = v as Record<string, unknown>;
  const num = (x: unknown, max: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : 0);
  const kind = isPetKind(o.kind) ? o.kind : null;
  if (!kind) return noPet();
  return { kind, next: num(o.next, 1e16), gifts: Math.round(num(o.gifts, 99999)) };
}
