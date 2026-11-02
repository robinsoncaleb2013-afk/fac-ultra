import { ArtThumb } from "@/components/game/panels/shared";
import {
  BIOMES,
  biomeSpeciesCaught,
  money,
  stageOf,
  STAGE_NAMES,
} from "@/game/content";
import { useGame } from "@/game/engine";
import { cn } from "@/lib/cn";

export function WatersPanel() {
  const biome = useGame((s) => s.biome);
  const ub = useGame((s) => s.ub);
  const coins = useGame((s) => s.c);
  const travel = useGame((s) => s.travel);
  const phase = useGame((s) => s.phase);
  const dex = useGame((s) => s.dex);
  const mastered = useGame((s) => s.mastered);
  const locked = phase !== "idle";
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-serif text-lg">Waters</h3>
      {locked ? <p className="text-sm text-muted">Land or lose this fish before you travel.</p> : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BIOMES.map((place, index) => {
          const owned = ub.includes(index);
          const here = biome === index;
          const afford = coins >= place.price;
          const caught = biomeSpeciesCaught(dex, index);
          const stage = stageOf(dex, index);
          const isMastered = mastered.includes(index);
          return (
            <button
              key={place.id}
              type="button"
              disabled={locked || here || (!owned && !afford)}
              onClick={() => travel(index)}
              className={cn("overflow-hidden rounded-2xl border text-left", here ? "border-brass" : "border-line")}
            >
              <span className="relative block h-28">
                <ArtThumb id={place.id} className="h-full w-full object-cover" />
                <span className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
                <span className="absolute bottom-2 left-3 font-serif text-lg">{place.name}</span>
                {isMastered ? (
                  <span className="absolute top-2 right-2 rounded-full bg-brass px-2 py-0.5 text-xs text-brass-ink">
                    Mastered
                  </span>
                ) : null}
              </span>
              <span className="block px-3 py-2">
                <span className="block text-sm text-brass">
                  {here ? "Here" : owned ? "Travel" : `Unlock ${money(place.price)}`}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {STAGE_NAMES[stage]} · boss {caught}/24
                </span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full bg-lagoon" style={{ width: `${(caught / 24) * 100}%` }} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

