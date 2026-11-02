/* The fun layer's screens (docs/architecture/05 §6): ambience, the colour-blind palette, Fish of the Day,
   the pet panel and the Regulars board. The rules live in src/game; these only read state and call actions. */

import { useEffect } from "react";
import { Gift, Star } from "lucide-react";
import { audio } from "@/game/audio";
import { ambienceTarget } from "@/game/ambience";
import { useGame } from "@/game/engine";
import { whereToFind } from "@/game/match";
import { giftReady, minutesToGift, PET_KINDS, PET_LEVEL, PETS, petUnlocked } from "@/game/pet";
import { favouriteWater, RIVALS, recordLine } from "@/game/rivals";
import { FishPortrait } from "@/components/game/portrait";
import { rarityOf } from "@/game/content";
import { useFotd, useFunOn, useTick } from "@/components/game/fun-hooks";
import { cn } from "@/lib/cn";



/** Sets the ambience from the game state, and unlocks audio on the first tap or key (browsers stay silent until then). */
export function Ambience() {
  const sound = useGame((s) => s.sound);
  const volume = useGame((s) => s.volume);
  const screen = useGame((s) => s.screen);
  const mode = useGame((s) => s.mode);
  const biome = useGame((s) => s.biome);
  const weather = useGame((s) => s.weather);
  useEffect(() => {
    const first = () => {
      audio.unlock();
      window.removeEventListener("pointerdown", first, true);
      window.removeEventListener("keydown", first, true);
    };
    window.addEventListener("pointerdown", first, true);
    window.addEventListener("keydown", first, true);
    return () => {
      window.removeEventListener("pointerdown", first, true);
      window.removeEventListener("keydown", first, true);
    };
  }, []);
  useEffect(() => {
    audio.ambient(ambienceTarget({ sound, volume, screen, mode, biome, weather, speaking: false }));
  }, [sound, volume, screen, mode, biome, weather]);
  return null;
}



/** A one-line Fish of the Day for the menu and the water chips. */
export function FotdLine({ className }: { className?: string }) {
  const { fotd, done } = useFotd();
  if (!fotd) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Star className={cn("size-3.5", done ? "fill-brass text-brass" : "text-brass")} aria-hidden />
      Fish of the Day: {fotd.name} in {fotd.water}
      {done ? " (caught)" : ""}
    </span>
  );
}

export function FotdCard() {
  const { fotd, done, streak } = useFotd();
  const here = useGame((s) => s.biome);
  if (!fotd) return null;
  const spots = whereToFind(fotd.biome, fotd.species);
  return (
    <section className={cn("flex items-center gap-3 rounded-2xl border bg-surface p-3", done ? "border-line" : "border-brass")}>
      <FishPortrait biome={fotd.biome} species={fotd.species} rarity={rarityOf(fotd.species)} mutation={0} className="size-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-brass uppercase">Fish of the Day</p>
        <p className="font-serif text-lg leading-tight">{fotd.name}</p>
        <p className="text-sm text-muted">
          {done
            ? `You caught it today! ${streak > 1 ? `${streak} days in a row.` : ""}`
            : `Find it in ${fotd.water}${here === fotd.biome ? " (you are here)" : ""}${spots.length ? `, near ${spots[0].name}` : ""}. Your first one today gives double XP.`}
        </p>
      </div>
    </section>
  );
}

/** The pet's gift button, for the water chips. Only there when a gift is ready. */
export function GiftChip({ className }: { className?: string }) {
  const pet = useGame((s) => s.pet);
  const claim = useGame((s) => s.claimGift);
  const on = useFunOn();
  useTick(15_000);
  if (!on || !pet.kind || !giftReady(pet, Date.now())) return null;
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={claim}
      className={cn(
        "pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brass bg-brass px-3 text-sm font-semibold text-brass-ink",
        className,
      )}
    >
      <Gift className="size-4" aria-hidden />
      {PETS[pet.kind].label} brought something
    </button>
  );
}

/** Lodge → Pet. */
export function PetView() {
  const lv = useGame((s) => s.lv);
  const pet = useGame((s) => s.pet);
  const choose = useGame((s) => s.choosePet);
  const claim = useGame((s) => s.claimGift);
  useTick(15_000);
  const now = Date.now();
  if (!petUnlocked(lv)) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Fishing buddy</h3>
        <p className="mt-1 text-sm text-muted">
          A buddy joins you at level {PET_LEVEL}: an otter, a heron or a dog. You are level {lv}. Keep fishing!
        </p>
      </section>
    );
  }
  const ready = giftReady(pet, now);
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Pick your fishing buddy</h3>
        <p className="mt-1 text-sm text-muted">
          Your buddy sits by the water and cheers when you land a fish. Once an hour it brings you lures that suit a fish you have not
          caught yet. It never changes how fish bite or fight.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {PET_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={pet.kind === k}
              onClick={() => choose(k)}
              className={cn(
                "flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-center",
                pet.kind === k ? "border-brass bg-surface-2" : "border-line bg-bg/40",
              )}
            >
              <span className="text-3xl" aria-hidden>
                {PETS[k].emoji}
              </span>
              <span className="font-serif">{PETS[k].label}</span>
              <span className="text-xs text-muted">{PETS[k].blurb}</span>
            </button>
          ))}
        </div>
      </section>
      {pet.kind ? (
        <section className="rounded-2xl border border-line bg-surface p-3">
          <h3 className="font-serif text-lg">Gift</h3>
          <p className="mt-1 text-sm text-muted">
            {ready ? `${PETS[pet.kind].label} has brought you something.` : `The next gift is ready in about ${minutesToGift(pet, now)} min.`} Gifts so
            far: {pet.gifts}.
          </p>
          <button
            type="button"
            disabled={!ready}
            onClick={claim}
            className="mt-2 min-h-11 rounded-full bg-brass px-5 text-sm font-semibold text-brass-ink disabled:opacity-40"
          >
            Take the gift
          </button>
        </section>
      ) : null}
    </div>
  );
}

/** Lodge → Regulars: the twelve anglers and your record against each. */
export function RegularsView() {
  const rec = useGame((s) => s.rivalRecord);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        The Regulars are the anglers you meet in the Derby. They fish with the same rules as you, so you beat them by fishing well.
      </p>
      {RIVALS.map((r) => (
        <article key={r.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
          <span className="text-3xl" aria-hidden>
            {r.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-serif text-lg leading-tight">{r.name}</h4>
              <span className="shrink-0 text-xs text-brass" title={`Skill ${Math.round(r.skill * 100)} out of 100`}>
                {"★".repeat(Math.max(1, Math.round(r.skill * 5)))}
                <span className="text-muted">{"★".repeat(5 - Math.max(1, Math.round(r.skill * 5)))}</span>
              </span>
            </div>
            <ul className="mt-1 text-sm text-muted">
              {r.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted">
              Favourite water: {favouriteWater(r)} · {recordLine(rec, r.id)}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
