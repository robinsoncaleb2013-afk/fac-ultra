import {
  AUTO_PRICE,
  BOATS,
  compact,
  GEAR,
  type GearKind,
  money,
  REELS,
  RODS,
} from "@/game/content";
import { useGame } from "@/game/engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";


export function GearPanel() {
  const auto = useGame((s) => s.auto);
  const coins = useGame((s) => s.c);
  const buyAuto = useGame((s) => s.buyAuto);
  return (
    <div className="flex flex-col gap-4">
      {auto ? (
        <p className="text-sm text-muted">Auto-reel is installed. Toggle it from Cast.</p>
      ) : (
        <Button disabled={coins < AUTO_PRICE} onClick={buyAuto}>
          Auto-reel module · {money(AUTO_PRICE)}
        </Button>
      )}
      <GearList kind="rod" title="Rods" hint={(i) => `Zone ${RODS[i].zone}% · luck ${compact(RODS[i].luck)}`} />
      <GearList
        kind="reel"
        title="Reels"
        hint={(i) => `Wait −${REELS[i].speed * 4}% · control +${REELS[i].speed * 7}%`}
      />
      <GearList kind="boat" title="Boats" hint={(i) => `Luck +${BOATS[i].luck} · wait −${i * 4}%`} />
    </div>
  );
}

function GearList({ kind, title, hint }: { kind: GearKind; title: string; hint: (i: number) => string }) {
  const owned = useGame((s) => s[kind]);
  const coins = useGame((s) => s.c);
  const buy = useGame((s) => s.buyGear);
  const items = GEAR[kind];
  return (
    <section>
      <h3 className="mb-2 font-serif text-lg">{title}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item, index) => {
          const equipped = owned === index;
          const have = owned >= index;
          const afford = coins >= item.price;
          return (
            <button
              key={item.name}
              type="button"
              disabled={have || !afford}
              onClick={() => buy(kind, index)}
              className={cn(
                "rounded-2xl border p-3 text-left",
                equipped ? "border-brass bg-surface-2" : "border-line bg-surface",
                !have && afford && "hover:border-brass",
              )}
            >
              <span className="block text-sm font-semibold leading-snug">{item.name}</span>
              <span className="mt-1 block text-xs text-muted">{hint(index)}</span>
              <span className="mt-2 block text-sm text-brass">
                {equipped ? "Equipped" : have ? "Owned" : money(item.price)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

