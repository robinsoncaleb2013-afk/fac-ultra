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
import { FishPortrait } from "@/components/game/portrait";
import { cn } from "@/lib/cn";

export function DexPanel() {
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
          Each species adds 1% to sale prices and 0.1 luck. Pin up to eight favorites. Catch all 24 others in a
          water and its boss wakes.
        </p>
      </div>
      {BIOMES.map((place, biome) => {
        const caught = biomeSpeciesCaught(dex, biome);
        const bossEntry = dex[`${biome}-${BOSS_INDEX}`];
        const bossName = place.fish[BOSS_INDEX];
        const isMastered = mastered.includes(biome);
        return (
          <section key={place.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
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
                  <li key={key} className="flex items-center gap-2 border-t border-line px-2 py-1.5">
                    {entry ? (
                      <FishPortrait biome={biome} species={index} rarity={rarity} mutation={entry.m} className="size-10" />
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
                  </li>
                );
              })}
              <li className="flex items-center gap-2 border-t border-brass/50 bg-surface-2/40 px-2 py-1.5">
                {bossEntry ? (
                  <FishPortrait biome={biome} species={BOSS_INDEX} rarity={4} mutation={bossEntry.m} className="size-10" />
                ) : (
                  <span className="grid size-10 place-items-center font-serif text-lg text-muted">?</span>
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
                      <span className="block truncate text-sm text-muted">??? — the boss of {place.name}</span>
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

