import {
  BAITS,
  BOSS_CHUM_INDEX,
  bossChumPrice,
  compact,
  LURES,
  money,
  PACKS,
  SIG_LURES,
} from "@/game/content";
import { useGame } from "@/game/engine";
import { FAMILY_INFO } from "@/game/presentation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function LurePanel() {
  const coins = useGame((s) => s.c);
  const box = useGame((s) => s.box);
  const lure = useGame((s) => s.lure);
  const pull = useGame((s) => s.pull);
  const buyPack = useGame((s) => s.buyPack);
  const equip = useGame((s) => s.equipLure);
  const owned = Object.keys(box)
    .map(Number)
    .filter((i) => box[String(i)] > 0)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-serif text-lg">Packs</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {PACKS.map((pack, index) => (
          <button
            key={pack.name}
            type="button"
            disabled={coins < pack.price}
            onClick={() => buyPack(index)}
            className="rounded-2xl border border-line bg-surface p-3 text-left enabled:hover:border-brass"
          >
            <span className="block font-semibold">{pack.name}</span>
            <span className="mt-1 block text-xs text-muted">3 lures, a handful of casts each</span>
            <span className="mt-2 block text-sm text-brass">{money(pack.price)}</span>
          </button>
        ))}
      </div>
      {pull ? <p className="rounded-2xl border border-line bg-surface-2 p-3 text-sm">Pulled {pull}.</p> : null}
      <h3 className="font-serif text-lg">Tackle box</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => equip(-1)}
          className={cn(
            "min-h-16 rounded-2xl border p-3 text-left text-sm",
            lure < 0 ? "border-brass bg-surface-2" : "border-line bg-surface",
          )}
        >
          Bare hook
        </button>
        {owned.map((index) => (
          <button
            key={index}
            type="button"
            onClick={() => equip(index)}
            className={cn(
              "rounded-2xl border p-3 text-left",
              lure === index ? "border-brass bg-surface-2" : "border-line bg-surface",
            )}
          >
            <span className="block text-sm font-semibold leading-snug">{LURES[index].name}</span>
            <span className="mt-1 block text-xs text-muted">
              {FAMILY_INFO[LURES[index].family].label} · luck {compact(LURES[index].luck)} · haste {compact(LURES[index].speed)} · ×{box[String(index)]}
            </span>
          </button>
        ))}
      </div>
      {owned.length === 0 ? <p className="text-sm text-muted">The box is empty.</p> : null}
      <SigSection />
      <BaitSection />
    </div>
  );
}

function SigSection() {
  const coins = useGame((s) => s.c);
  const sigBox = useGame((s) => s.sigBox);
  const sig = useGame((s) => s.sig);
  const buySig = useGame((s) => s.buySig);
  const equipSig = useGame((s) => s.equipSig);
  return (
    <>
      <h3 className="font-serif text-lg">Signature lures</h3>
      <p className="text-sm text-muted">
        Handcrafted, permanent, one effect each. A signature lure rides alongside your tackle-box lure.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => equipSig(-1)}
          className={cn(
            "min-h-16 rounded-2xl border p-3 text-left text-sm",
            sig < 0 ? "border-brass bg-surface-2" : "border-line bg-surface",
          )}
        >
          No signature lure
        </button>
        {SIG_LURES.map((item, index) => {
          const have = sigBox.includes(index);
          const equipped = sig === index;
          return (
            <button
              key={item.name}
              type="button"
              disabled={!have && coins < item.price}
              onClick={() => (have ? equipSig(index) : buySig(index))}
              className={cn(
                "rounded-2xl border p-3 text-left",
                equipped ? "border-brass bg-surface-2" : "border-line bg-surface",
                !have && coins >= item.price && "hover:border-brass",
              )}
            >
              <span className="block text-sm font-semibold leading-snug">{item.name}</span>
              <span className="mt-1 block text-xs text-muted">{item.desc}</span>
              <span className="mt-1 block text-xs text-lagoon">{FAMILY_INFO[item.family].label}</span>
              <span className="mt-2 block text-sm text-brass">
                {equipped ? "Equipped" : have ? "Equip" : money(item.price)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function BaitSection() {
  const coins = useGame((s) => s.c);
  const biome = useGame((s) => s.biome);
  const baitBox = useGame((s) => s.baitBox);
  const bait = useGame((s) => s.bait);
  const buyBait = useGame((s) => s.buyBait);
  const equipBait = useGame((s) => s.equipBait);
  return (
    <>
      <h3 className="font-serif text-lg">Bait</h3>
      <p className="text-sm text-muted">One bait, one cast. Equipped bait is spent when you cast.</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => equipBait(-1)}
          className={cn(
            "min-h-16 rounded-2xl border p-3 text-left text-sm",
            bait < 0 ? "border-brass bg-surface-2" : "border-line bg-surface",
          )}
        >
          No bait
        </button>
        {BAITS.map((item, index) => {
          const count = baitBox[String(index)] || 0;
          const price = index === BOSS_CHUM_INDEX ? bossChumPrice(biome) : item.price;
          const equipped = bait === index;
          return (
            <div
              key={item.name}
              className={cn("rounded-2xl border p-3", equipped ? "border-brass bg-surface-2" : "border-line bg-surface")}
            >
              <span className="block text-sm font-semibold leading-snug">{item.name}</span>
              <span className="mt-1 block text-xs text-muted">{item.desc}</span>
              <span className="mt-1 block text-xs text-lagoon">{FAMILY_INFO[item.family].label}</span>
              <span className="mt-1 block text-xs text-muted">Have {count}</span>
              <span className="mt-2 flex gap-2">
                <Button
                  className="min-h-11 px-3 py-1 text-sm"
                  disabled={coins < price}
                  onClick={() => buyBait(index)}
                >
                  Buy {money(price)}
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-11 px-3 py-1 text-sm"
                  disabled={count <= 0}
                  onClick={() => equipBait(index)}
                >
                  {equipped ? "Equipped" : "Equip"}
                </Button>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

