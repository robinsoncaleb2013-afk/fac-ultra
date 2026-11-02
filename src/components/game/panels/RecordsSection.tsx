import { BIOMES, TONE, rarityOf } from "@/game/content";
import { useGame } from "@/game/engine";
import { STEWARD_SPECIES, STEWARD_WATER, WATER_SIZE, waterReleased } from "@/game/keep";
import { recordLine, speciesKey, topRecords } from "@/game/records";
import { FishPortrait } from "@/components/game/portrait";
import { cn } from "@/lib/cn";

/** Your heaviest fish, each with how you caught it (04 §7). */
export function RecordBook() {
  const records = useGame((s) => s.records);
  const rows = topRecords(records, 5);
  const total = Object.keys(records).length;
  return (
    <section className="rounded-2xl border border-line bg-surface p-3" aria-label="Personal bests">
      <h3 className="font-serif text-lg">Personal bests</h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-muted">
          Land a fish heavier than your best and it goes in the book, with the spot, the rig and the weather.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            {total} {total === 1 ? "kind of fish has" : "kinds of fish have"} a record. Your five heaviest:
          </p>
          <ul className="mt-2 flex flex-col">
            {rows.map(({ key, rec }) => {
              const sk = speciesKey(key);
              if (!sk) return null;
              const rarity = rarityOf(sk.i);
              return (
                <li key={key} className="flex items-center gap-2 border-t border-line py-2 first:border-0">
                  <FishPortrait biome={sk.b} species={sk.i} rarity={rarity} mutation={0} className="size-12 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", TONE[rarity])}>{BIOMES[sk.b].fish[sk.i]}</span>
                    <span className="block text-xs leading-snug text-muted">{recordLine(rec, sk.b)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Fish you let go, and what letting them go has earned (04 §6). */
export function Stewardship() {
  const released = useGame((s) => s.released);
  const stewards = useGame((s) => s.stewards);
  const total = Object.values(released).reduce((a, b) => a + b, 0);
  const waters = BIOMES.map((b, i) => ({ b, i, n: waterReleased(released, i) })).filter((w) => w.n > 0);
  return (
    <section className="rounded-2xl border border-line bg-surface p-3" aria-label="Stewardship">
      <h3 className="font-serif text-lg">Stewardship</h3>
      <p className="text-sm text-muted">
        Let a fish go and you earn 20% more XP for it. Let one kind go {STEWARD_SPECIES} times and you are its
        Steward. Let {STEWARD_WATER} go in one water and its fish grow {Math.round((WATER_SIZE - 1) * 100)}% bigger,
        for good.
      </p>
      <p className="mt-2 text-sm">
        Let go: {total} · Steward of {stewards.species.length} {stewards.species.length === 1 ? "kind" : "kinds"} ·{" "}
        {stewards.waters.length} {stewards.waters.length === 1 ? "water" : "waters"} with bigger fish
      </p>
      {waters.length ? (
        <ul className="mt-2 flex flex-col gap-2">
          {waters.map(({ b, i, n }) => {
            const done = stewards.waters.includes(i);
            return (
              <li key={b.id}>
                <div className="flex justify-between text-sm">
                  <span>{b.name}</span>
                  <span className={done ? "text-lagoon" : "text-muted"}>
                    {done ? "Bigger fish" : `${Math.min(n, STEWARD_WATER)}/${STEWARD_WATER}`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-lagoon"
                    style={{ width: `${Math.min(100, (n / STEWARD_WATER) * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
