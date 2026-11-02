import { useState } from "react";
import { ArtThumb } from "@/components/game/panels/shared";
import {
  BIOMES,
  BOSS_INDEX,
  dexCount,
  SPECIES_PER_BIOME,
  MUTATIONS,
  rarityOf,
  TONE,
  TOTAL_SPECIES,
} from "@/game/content";
import { useGame } from "@/game/engine";
import { habitOf, habitSentences } from "@/game/habits";
import { MODES } from "@/game/modes";
import { SURVIVAL_WATERS } from "@/game/survival";
import { whereToFind } from "@/game/match";
import { STEWARD_SPECIES, STEWARD_WATER, waterReleased } from "@/game/keep";
import { recordLine } from "@/game/records";
import { FishPortrait } from "@/components/game/portrait";
import { RarityMark } from "@/components/game/rarity-mark";
import { useFunOn } from "@/components/game/fun-hooks";
import { frameId, pageFill, pageId, PAGE_CELLS } from "@/game/stickers";
import { cn } from "@/lib/cn";

/** What a species does and where to find it, in plain sentences (04 §3.6). */
function HabitCard({ biome, index }: { biome: number; index: number }) {
  const lines = habitSentences(habitOf(biome, index));
  const spots = whereToFind(biome, index);
  const key = `${biome}-${index}`;
  const rec = useGame((s) => s.records[key]);
  const best = useGame((s) => s.dex[key]?.w ?? 0);
  const gone = useGame((s) => s.released[key] ?? 0);
  const steward = useGame((s) => s.stewards.species.includes(key));
  return (
    <div className="mx-2 mb-2 flex flex-col gap-1 rounded-xl bg-surface-2/50 px-3 py-2 text-sm">
      <p>
        <span className="text-brass">Your best: </span>
        {rec ? recordLine(rec, biome) : `${best} lb`}
      </p>
      <p className="text-muted">
        {steward
          ? `Steward. You have let ${gone} go.`
          : gone
            ? `Let go ${gone} of ${STEWARD_SPECIES} to be its Steward.`
            : `Let ${STEWARD_SPECIES} go to be its Steward.`}
      </p>
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

/** One cell of a water's sticker page: a grey silhouette until the species is caught, then its painted sticker. */
function Cell({
  biome,
  index,
  selected,
  onPick,
}: {
  biome: number;
  index: number;
  selected: boolean;
  onPick: () => void;
}) {
  const key = `${biome}-${index}`;
  const entry = useGame((s) => s.dex[key]);
  const shiny = useGame((s) => s.shiny.includes(key));
  const framed = useGame((s) => s.stickers.includes(frameId(key)));
  const fresh = useGame((s) => s.motion && s.lastCatch?.discovered === true && `${s.lastCatch.biome}-${s.lastCatch.species}` === key);
  const boss = index === BOSS_INDEX;
  const rarity = rarityOf(index);
  const foil = !!entry && entry.m > 0;
  const label = entry ? `${BIOMES[biome].fish[index]}${shiny ? ", shiny" : ""}${foil ? ", " + MUTATIONS[entry.m].name : ""}` : "Not found yet";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onPick}
      className={cn("relative aspect-square min-h-11 rounded-xl p-[2px]", foil ? "fac-foil" : "bg-transparent")}
    >
      <span
        className={cn(
          "relative block h-full w-full overflow-hidden rounded-[10px] border",
          boss ? "border-brass/70" : "border-line",
          framed && "ring-2 ring-brass",
          selected && "outline-2 outline-offset-1 outline-lagoon",
          entry ? "bg-surface-2" : "bg-surface",
          fresh && "fac-peel",
        )}
      >
        {entry || !boss ? (
          <FishPortrait
            biome={biome}
            species={index}
            rarity={rarity}
            mutation={entry?.m ?? 0}
            className={cn("h-full w-full", entry ? "" : "brightness-0 opacity-30")}
          />
        ) : (
          <span className="grid h-full w-full place-items-center font-serif text-xl text-muted">?</span>
        )}
        {entry ? <RarityMark rarity={boss ? 4 : rarity} className="absolute top-1 left-1 size-3" /> : null}
        {shiny ? (
          <span aria-hidden className="fac-twinkle absolute top-0.5 right-1 text-sm text-brass">
            ✦
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function DexPanel() {
  const [open, setOpen] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const dex = useGame((s) => s.dex);
  const pins = useGame((s) => s.pins);
  const pin = useGame((s) => s.pin);
  const mastered = useGame((s) => s.mastered);
  const stewards = useGame((s) => s.stewards);
  const stickers = useGame((s) => s.stickers);
  const released = useGame((s) => s.released);
  const shinyCount = useGame((s) => s.shiny.length);
  const here = useGame((s) => s.biome);
  const n = dexCount(dex);
  const survival = useGame((s) => !!MODES[s.mode].survival);
  const relaxed = useGame((s) => s.mode === "recreational");
  const fun = useFunOn();
  const shown = open ?? here;
  const pages = stickers.filter((x) => x.startsWith("page-")).length;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-serif text-lg">
          {survival ? `Survival dex ${n}/${SURVIVAL_WATERS.length * 24}` : `Dex ${n}/${TOTAL_SPECIES}`}
        </h3>
        <p className="text-sm text-muted">
          {survival
            ? "Your own collection, just for Survival. It does not touch your Expedition book. Tap a fish to see where to find it."
            : relaxed
              ? "Each water has a page of 25 stickers. Catch a fish to stick it in. Nothing you catch here counts toward your Expedition."
              : "Each water has a page of 25 stickers. Catch a fish to stick it in. Finish a page for a page sticker. Each species adds 1% to sale prices and 0.1 luck."}
        </p>
        {fun ? (
          <p className="mt-1 text-sm text-brass">
            Page stickers {pages}/{BIOMES.length} · Shiny fish {shinyCount}
          </p>
        ) : null}
      </div>
      {BIOMES.map((place, biome) => {
        if (survival && !SURVIVAL_WATERS.includes(biome)) return null;
        const isOpen = shown === biome;
        const fill = pageFill(dex, biome);
        const done = stickers.includes(pageId(biome));
        const isMastered = mastered.includes(biome);
        return (
          <section key={place.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => {
                setOpen(isOpen ? -1 : biome);
                setPick(null);
              }}
              className="relative block h-16 min-h-11 w-full text-left"
            >
              <ArtThumb id={place.id} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-bg/80 to-transparent" />
              <h4 className="absolute bottom-2 left-3 font-serif">{place.name}</h4>
              <span className="absolute right-3 bottom-2 text-xs text-fg">
                {done && !survival ? "Page sticker · " : ""}
                {isMastered ? "Mastered · " : ""}
                {waterReleased(released, biome) > 0
                  ? stewards.waters.includes(biome)
                    ? "Bigger fish · "
                    : `let go ${waterReleased(released, biome)}/${STEWARD_WATER} · `
                  : ""}
                {fill}/25
              </span>
            </button>
            {isOpen ? (
              <div className="p-2">
                <div className="grid grid-cols-5 gap-1.5">
                  {PAGE_CELLS.map((index) => (
                    <Cell
                      key={index}
                      biome={biome}
                      index={index}
                      selected={pick === `${biome}-${index}`}
                      onPick={() => setPick(pick === `${biome}-${index}` ? null : `${biome}-${index}`)}
                    />
                  ))}
                </div>
                {pick && pick.startsWith(`${biome}-`) ? (
                  <Detail biome={biome} index={Number(pick.split("-")[1])} kept={pins.includes(pick)} pin={pin} stewards={stewards.species.includes(pick)} />
                ) : (
                  <p className="px-1 pt-2 text-xs text-muted">
                    Tap a sticker to read about the fish.
                    {done && !survival ? " This page is complete!" : ` ${SPECIES_PER_BIOME - fill} still hiding.`}
                  </p>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function Detail({
  biome,
  index,
  kept,
  pin,
  stewards,
}: {
  biome: number;
  index: number;
  kept: boolean;
  pin: (key: string) => void;
  stewards: boolean;
}) {
  const key = `${biome}-${index}`;
  const entry = useGame((s) => s.dex[key]);
  const shiny = useGame((s) => s.shiny.includes(key));
  const framed = useGame((s) => s.stickers.includes(frameId(key)));
  const boss = index === BOSS_INDEX;
  if (!entry) {
    return (
      <p className="px-1 pt-2 text-sm text-muted">
        {boss
          ? `??? The boss of ${BIOMES[biome].name}. Catch the other 24 to wake it.`
          : "Undiscovered. Catch one to stick it in the book."}
      </p>
    );
  }
  return (
    <div className="mt-2 rounded-xl bg-surface-2/50 py-1">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm", TONE[boss ? 4 : rarityOf(index)])}>
            {entry.m ? `${MUTATIONS[entry.m].name} ` : ""}
            {BIOMES[biome].fish[index]}
            {shiny ? " ✦" : ""}
          </span>
          <span className="block text-xs text-muted">
            {boss ? "Boss · " : ""}
            {entry.w} lb · ×{entry.c}
            {stewards ? " · Steward" : ""}
            {shiny ? " · Shiny" : ""}
            {framed ? " · Gold frame" : ""}
          </span>
        </span>
        <button
          type="button"
          onClick={() => pin(key)}
          className={cn("min-h-11 rounded-full px-3 text-xs", kept ? "bg-brass text-brass-ink" : "text-muted")}
        >
          {kept ? "Kept" : "Keep"}
        </button>
      </div>
      <HabitCard biome={biome} index={index} />
    </div>
  );
}
