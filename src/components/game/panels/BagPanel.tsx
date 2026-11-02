import { RarityMark } from "@/components/game/rarity-mark";
import { useState } from "react";
import {
  BIOMES,
  money,
  multOf,
  RARITIES,
  TONE,
} from "@/game/content";
import { useGame } from "@/game/engine";
import { moneyWords } from "@/game/kid";
import { MODES } from "@/game/modes";
import { creelLine } from "@/game/trips";
import { useKidOn } from "@/components/game/use-kid";
import { FishPortrait } from "@/components/game/portrait";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Filter } from "@/components/game/panels/shared";

export function BagPanel() {
  const inv = useGame((s) => s.inv);
  const mult = useGame((s) => multOf(s.dex, s.rb));
  const sellOne = useGame((s) => s.sellOne);
  const sellUpTo = useGame((s) => s.sellUpTo);
  const mode = useGame((s) => s.mode);
  const armSell = useGame((s) => s.armSell);
  const kid = useKidOn();
  const economy = MODES[mode].economy;
  const [filter, setFilter] = useState<number | "all">("all");
  const worth = inv.reduce((sum, fish) => sum + fish.v, 0);
  const rows = inv
    .map((fish, index) => ({ fish, index }))
    .filter(({ fish }) => filter === "all" || fish.t === filter)
    .reverse()
    .slice(0, 60);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-surface p-3">
        {economy ? (
          <>
            <p className="font-serif text-xl" title={kid ? moneyWords(Math.round(worth * mult)) : undefined}>
              {money(Math.round(worth * mult))}
            </p>
            <p className="text-sm text-muted">
              {inv.length} on the bank · sale multiplier ×{mult.toFixed(2)}
            </p>
          </>
        ) : (
          <p className="font-serif text-xl">{creelLine(inv.length, inv.reduce((n, f) => n + f.w, 0))}</p>
        )}
        {!economy ? (
          <p className="mt-2 text-sm text-muted">
            {MODES[mode].title}: fish are kept in the creel, never sold. It empties when you end the trip or change
            water.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => sellUpTo(9)}>Sell all</Button>
            <Button variant="ghost" onClick={() => sellUpTo(1)}>
              Sell common and uncommon
            </Button>
          </div>
        )}
      </div>
      <div className="flex gap-1 overflow-x-auto">
        <Filter on={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Filter>
        {RARITIES.map((rarity, i) => (
          <Filter key={rarity.id} on={filter === i} onClick={() => setFilter(i)}>
            {rarity.name}
          </Filter>
        ))}
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted">Nothing in this cut of the bag.</p> : null}
      <ul>
        {rows.map(({ fish, index }) => (
          <li key={`${index}-${fish.name}`}>
            <button
              type="button"
              disabled={!economy}
              onClick={() => sellOne(index)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-line py-2 text-left disabled:cursor-default",
                armSell === `one:${index}:${fish.name}` && "bg-brass/10",
              )}
            >
              <FishPortrait
                biome={fish.b}
                species={fish.i}
                rarity={fish.t}
                mutation={fish.m}
                className="size-12 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate", TONE[fish.t])}>
                  <RarityMark rarity={fish.t} className="mr-1" />
                  {fish.name}
                </span>
                <span className="block text-xs text-muted">
                  {BIOMES[fish.b].name} · {fish.w} lb
                </span>
              </span>
              {economy ? (
                <span className="text-sm" title={kid ? moneyWords(Math.round(fish.v * mult)) : undefined}>
                  {armSell === `one:${index}:${fish.name}` ? "Sure? Tap again" : money(Math.round(fish.v * mult))}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        {economy ? "Tap a fish to sell it. " : ""}The newest 60 of this filter are listed.
      </p>
    </div>
  );
}

