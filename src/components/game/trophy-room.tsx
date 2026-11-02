import { useState } from "react";
import { BIOMES, MUTATIONS, RARITIES, TONE } from "@/game/content";
import { useGame } from "@/game/engine";
import { dateLine, inWater, plaques, wallOfFame, type Plaque } from "@/game/pbroom";
import { KIDS_BOOK_LINE } from "@/game/difficulty";
import { FishPortrait } from "@/components/game/portrait";
import { RarityMark } from "@/components/game/rarity-mark";
import { cn } from "@/lib/cn";

/* The Trophy Room (docs/architecture/12 §8) and the Kids book (§1): two Lodge rooms built on records the game already keeps. */

function Plate({ p, big }: { p: Plaque; big?: boolean }) {
  return (
    <figure
      data-testid="plaque"
      className={cn("flex flex-col overflow-hidden rounded-2xl border border-brass/70 bg-surface-2/60", big ? "min-w-[11rem]" : "")}
    >
      <FishPortrait biome={p.biome} species={p.species} rarity={p.rarity} mutation={p.mutation} className={cn("w-full", big ? "h-28" : "h-20")} />
      <figcaption className="flex flex-col gap-0.5 border-t border-line p-2.5 text-sm">
        <span className={cn("text-xs font-semibold tracking-wide uppercase", TONE[p.rarity])}>
          <RarityMark rarity={p.rarity} className="mr-1" />
          {RARITIES[p.rarity].name}
          {p.mutation ? ` · ${MUTATIONS[p.mutation].name}` : ""}
        </span>
        <span className="font-serif text-base leading-tight">{p.name}</span>
        <span>
          {p.weight} lb · about {p.length} in
        </span>
        <span className="text-xs text-muted">{p.at ? `${dateLine(p.at)} · ${p.story.split(" · ").slice(1).join(" · ")}` : `${p.water} · caught ${p.caught}`}</span>
      </figcaption>
    </figure>
  );
}

export function PbRoom() {
  const records = useGame((s) => s.records);
  const dex = useGame((s) => s.dex);
  const [water, setWater] = useState<number | null>(null);
  const all = plaques(records, dex);
  if (!all.length) return <p className="text-muted">Nothing on the wall yet. Land a fish and your best of each kind will be hung here.</p>;
  const wall = wallOfFame(all, 5);
  const waters = [...new Set(all.map((p) => p.biome))].sort((a, b) => a - b);
  const pick = water !== null && waters.includes(water) ? water : waters[0];
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Biggest fish">
        <h3 className="font-serif text-lg">Your biggest</h3>
        <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
          {wall.map((p) => (
            <div key={p.key} className="w-44 shrink-0">
              <Plate p={p} big />
            </div>
          ))}
        </div>
      </section>
      <section aria-label="Best of each kind">
        <h3 className="font-serif text-lg">Best of each kind</h3>
        <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Water">
          {waters.map((b) => (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={pick === b}
              onClick={() => setWater(b)}
              className={cn("min-h-10 rounded-full border px-3 text-sm", pick === b ? "border-brass text-brass" : "border-line text-muted")}
            >
              {BIOMES[b].name}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {inWater(all, pick).map((p) => (
            <Plate key={p.key} p={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function KidsBook() {
  const side = useGame((s) => s.sideDex);
  const mode = useGame((s) => s.mode);
  const kid = useGame((s) => s.kid);
  const list = plaques({}, side);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{KIDS_BOOK_LINE}</p>
      {mode === "tournament" ? null : kid ? null : <p className="text-sm text-muted">Turn on Kid Mode in Settings to fill it.</p>}
      {list.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...list].sort((a, b) => a.biome - b.biome || a.species - b.species).map((p) => (
            <Plate key={p.key} p={{ ...p, at: 0, story: `${p.weight} lb` }} />
          ))}
        </div>
      ) : (
        <p className="text-muted">No fish in the Kids book yet. Catch one in Kid Mode or on Super Easy.</p>
      )}
    </div>
  );
}
