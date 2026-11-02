import { useState } from "react";
import { ArtThumb } from "@/components/game/panels/shared";
import {
  BIOMES,
  biomeDexCount,
  biomeSpeciesCaught,
  BOSS_INDEX,
  dexCount,
  MUTATIONS,
  rarityOf,
  TONE,
  TOTAL_SPECIES,
} from "@/game/content";
import { useGame } from "@/game/engine";
import { habitOf, habitSentences } from "@/game/habits";
import { whereToFind } from "@/game/match";
import { FishPortrait } from "@/components/game/portrait";
import { cn } from "@/lib/cn";

/** What a species does and where to find it, in plain sentences (04 §3.6). */
function HabitCard({ biome, index }: { biome: number; index: number }) {
  const lines = habitSentences(habitOf(biome, index));
  const spots = whereToFind(biome, index);
  return (
    <div className="mx-2 mb-2 flex flex-col gap-1 rounded-xl bg-surface-2/50 px-3 py-2 text-sm">
      {lines.map((line) => (
        <p key={line} className="text-muted">
          {line}
        </p>
      ))}
      <p>
        <span className="text-brass">Where to find it: </span>
        {spots.length ? spots.map((sp) => sp.name).join(", ") : "Nowhere in this water."}
      </p>
    </div>
  );
}

export function DexPanel() {
  const [open, setOpen] = useState<string | null>(null);
  const dex = useGame((s) => s.dex);
  const pins = useGame((s) => s.pins);
  const pin = useGame((s) => s.pin);
  const mastered = useGame((s) => s.mastered);
  const n = dexCount(dex);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-serif text-lg">
          Dex {n}/{TOTAL_SPECIES}
        </h3>
        <p className="text-sm text-muted">
          Each species adds 1% to sale prices and 0.1 luck. Pin up to eight favorites. Catch all 24
          others in a water and its boss wakes.
        </p>
      </div>
      {BIOMES.map((place, biome) => {
        const caught = biomeSpeciesCaught(dex, biome);
        const bossEntry = dex[`${biome}-${BOSS_INDEX}`];
        const bossName = place.fish[BOSS_INDEX];
        const isMastered = mastered.includes(biome);
        return (
          <section
            key={place.id}
            className="overflow-hidden rounded-2xl border border-line bg-surface"
          >
            <div className="relative h-16">
              <ArtThumb id={place.id} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-bg/80 to-transparent" />
              <h4 className="absolute bottom-2 left-3 font-serif">{place.name}</h4>
              <span className="absolute right-3 bottom-2 text-xs text-muted">
                {biomeDexCount(dex, biome)}/25
              </span>
            </div>
            <ul className="flex flex-col">
              {place.fish.map((name, index) => {
                if (index === BOSS_INDEX) return null;
                const key = `${biome}-${index}`;
                const entry = dex[key];
                const rarity = rarityOf(index);
                const kept = pins.includes(key);
                return (
                  <li key={key} className="border-t border-line">
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      {entry ? (
                        <FishPortrait
                          biome={biome}
                          species={index}
                          rarity={rarity}
                          mutation={entry.m}
                          className="size-10"
                        />
                      ) : (
                        <span className="grid size-10 place-items-center text-muted">—</span>
                      )}
                      <span className="min-w-0 flex-1">
                        {entry ? (
                          <>
                            <span className={cn("block truncate text-sm", TONE[rarity])}>
                              {entry.m ? `${MUTATIONS[entry.m].name} ` : ""}
                              {name}
                            </span>
                            <span className="block text-xs text-muted">
                              {entry.w} lb · ×{entry.c}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted">Undiscovered</span>
                        )}
                      </span>
                      {entry ? (
                        <button
                          type="button"
                          aria-expanded={open === key}
                          onClick={() => setOpen(open === key ? null : key)}
                          className="min-h-11 rounded-full px-3 text-xs text-lagoon"
                        >
                          {open === key ? "Hide" : "Habits"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={!entry}
                        onClick={() => pin(key)}
                        className={cn(
                          "min-h-11 rounded-full px-3 text-xs",
                          kept ? "bg-brass text-brass-ink" : "text-muted",
                        )}
                      >
                        {kept ? "Kept" : "Keep"}
                      </button>
                    </div>
                    {entry && open === key ? <HabitCard biome={biome} index={index} /> : null}
                  </li>
                );
              })}
              <li className="flex items-center gap-2 border-t border-brass/50 bg-surface-2/40 px-2 py-1.5">
                {bossEntry ? (
                  <FishPortrait
                    biome={biome}
                    species={BOSS_INDEX}
                    rarity={4}
                    mutation={bossEntry.m}
                    className="size-10"
                  />
                ) : (
                  <span className="grid size-10 place-items-center font-serif text-lg text-muted">
                    ?
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  {bossEntry ? (
                    <>
                      <span className="block truncate text-sm text-r4">
                        {bossEntry.m ? `${MUTATIONS[bossEntry.m].name} ` : ""}
                        {bossName}
                      </span>
                      <span className="block text-xs text-muted">
                        Boss · {bossEntry.w} lb · ×{bossEntry.c}
                        {isMastered ? " · Mastered" : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block truncate text-sm text-muted">
                        ??? — the boss of {place.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {caught} / 24 — the water is still hiding {24 - caught} fish
                      </span>
                    </>
                  )}
                </span>
              </li>
            </ul>
          </section>
        );
      })}
    </div>
  );
}
