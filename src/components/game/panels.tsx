import { useEffect, useRef, useState } from "react";
import {
  AUTO_PRICE,
  BAITS,
  BIOMES,
  biomeDexCount,
  biomeSpeciesCaught,
  BOATS,
  BOSS_CHUM_INDEX,
  BOSS_INDEX,
  bossChumPrice,
  compact,
  dexCount,
  exhibitValue,
  GEAR,
  type GearKind,
  GIFT_PRICES,
  LIGHT_PRICE,
  LINES,
  luckTotal,
  LURES,
  money,
  multOf,
  MUTATIONS,
  PACKS,
  RARITIES,
  rarityOf,
  REELS,
  RODS,
  SHOWCASE_SLOTS,
  SIG_LURES,
  stageOf,
  STAGE_NAMES,
  TANK_TIERS,
  tankExhibitValue,
  tankRatePerHour,
  TONE,
  TOTAL_SPECIES,
  WEATHER,
  xpNeed,
} from "@/game/content";
import { downloadSave, sim, useGame } from "@/game/engine";
import { createRoom, joinRoom, leaveRoom, useCrew } from "@/game/multiplayer";
import { FishPortrait } from "@/components/game/portrait";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { drawFish } from "@/game/fish-draw";
import { biomeArt, fitCanvas } from "@/game/art";

export function Panel() {
  const tab = useGame((s) => s.tab);
  return (
    <div className="px-3 py-3">
      {tab === "cast" ? <CastPanel /> : null}
      {tab === "bag" ? <BagPanel /> : null}
      {tab === "gear" ? <GearPanel /> : null}
      {tab === "lures" ? <LurePanel /> : null}
      {tab === "waters" ? <WatersPanel /> : null}
      {tab === "dex" ? <DexPanel /> : null}
      {tab === "lodge" ? <LodgePanel /> : null}
    </div>
  );
}

function CastPanel() {
  const luck = useGame((s) => Math.round(luckTotal(s, s.lure)));
  const streak = useGame((s) => s.streak);
  const last = useGame((s) => s.lastCatch);
  const mult = useGame((s) => multOf(s.dex, s.rb));
  const contracts = useGame((s) => s.contracts);
  const claim = useGame((s) => s.claim);
  const taught = useGame((s) => s.taught);
  const auto = useGame((s) => s.auto);
  const autoOn = useGame((s) => s.autoOn);
  const toggleAuto = useGame((s) => s.toggleAuto);
  const lure = useGame((s) => s.lure);
  const box = useGame((s) => s.box);
  const mode = useGame((s) => s.mode);
  const stage = useGame((s) => stageOf(s.dex, s.biome));
  const derby = useGame((s) => s.derby);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat k="Luck" v={String(luck)} />
        <Stat k="Streak" v={String(streak)} />
        <Stat k="Stage" v={STAGE_NAMES[stage]} />
      </div>
      {derby ? <DerbyBanner /> : null}
      <BossCard />
      {lure >= 0 ? (
        <p className="text-sm text-muted">
          {LURES[lure].name} · {box[String(lure)] || 0} left. The cast you spend still gets the bonus.
        </p>
      ) : (
        <p className="text-sm text-muted">No lure. Packs live under Lures.</p>
      )}
      {auto ? (
        <Button variant={autoOn ? "primary" : "ghost"} aria-pressed={autoOn} onClick={toggleAuto}>
          {autoOn ? "Auto-reel running" : "Auto-reel off"}
        </Button>
      ) : mode === "sandbox" ? null : (
        <p className="text-sm text-muted">Auto-reel is in Gear for {money(AUTO_PRICE)}. It banks fish at 40% value.</p>
      )}
      {last ? (
        <article className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="relative h-40 bg-surface-2">
            <img
              src={`/art/biomes/${BIOMES[last.biome].id}.jpg`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
            <FishPortrait
              biome={last.biome}
              species={last.species}
              rarity={last.rarity}
              mutation={last.mutation}
              className="relative h-40 w-full"
            />
          </div>
          <div className="flex flex-col gap-1 p-3">
            <p className={cn("text-xs font-semibold tracking-wide uppercase", TONE[last.rarity])}>
              {RARITIES[last.rarity].name}
              {last.mutation ? ` · ${MUTATIONS[last.mutation].name}` : ""}
            </p>
            <h2 className="font-serif text-2xl leading-tight">{last.name}</h2>
            <p className="text-sm text-muted">
              {BIOMES[last.biome].name} · {last.weight} lb · worth {money(Math.round(last.value * mult))}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {last.discovered ? <Badge>New species</Badge> : null}
              {last.perfect ? <Badge>Perfect hook</Badge> : null}
              {last.boss ? <Badge>Boss</Badge> : null}
              {last.frenzy ? <Badge>Frenzy</Badge> : null}
            </div>
          </div>
        </article>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-sm text-muted">
          The bank is empty. Cast, hook the bite, then keep the brass mark in the teal band.
        </p>
      )}
      {contracts.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-serif text-lg">Bounties</h3>
          {contracts.map((c) => {
            const ready = c.prog >= c.goal;
            return (
              <div key={c.id} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">{c.label}</p>
                  <p className="text-sm text-brass">{money(c.reward)}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-lagoon"
                    style={{ width: `${Math.min(100, (c.prog / c.goal) * 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted">
                    {Math.min(c.prog, c.goal)}/{c.goal}
                  </p>
                  <Button className="min-h-10 px-3 py-2 text-sm" disabled={!ready} onClick={() => claim(c.id)}>
                    Claim
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}
      {taught ? null : (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
          <li>Cast and watch the bobber.</li>
          <li>Hook as soon as it bites. A fast hook is worth more.</li>
          <li>Tap Reel only while the brass mark is inside the teal band. Misses strain the line.</li>
        </ol>
      )}
    </div>
  );
}

function BossCard() {
  const biome = useGame((s) => s.biome);
  const caught = useGame((s) => biomeSpeciesCaught(s.dex, s.biome));
  const stage = useGame((s) => stageOf(s.dex, s.biome));
  const lair = useGame((s) => s.lair);
  const setLair = useGame((s) => s.setLair);
  const mastered = useGame((s) => s.mastered.includes(s.biome));
  const chum = useGame((s) => s.baitBox[String(BOSS_CHUM_INDEX)] || 0);
  const buyBait = useGame((s) => s.buyBait);
  const coins = useGame((s) => s.c);
  const rush = useGame((s) => s.rush);
  const bossName = BIOMES[biome].fish[BOSS_INDEX];
  const price = bossChumPrice(biome);
  const open = stage >= 3 || !!rush;

  return (
    <section className={cn("rounded-2xl border p-3", open ? "border-brass bg-surface" : "border-line bg-surface")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-lg">{mastered ? `${bossName} — Mastered` : `Boss: ${bossName}`}</h3>
        <span className="text-sm text-brass">{caught}/24</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brass" style={{ width: `${Math.min(100, (caught / 24) * 100)}%` }} />
      </div>
      {open ? (
        <>
          <p className="mt-2 text-sm text-muted">
            {rush
              ? "Boss Rush: the Lair is open and the chum is on the house."
              : "The Lair is open. Arm it, then cast — each attempt eats one Boss Chum. Three phases: strike, fake-outs, the run."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant={lair ? "primary" : "ghost"} aria-pressed={lair} onClick={() => setLair(!lair)}>
              {lair ? "Lair armed — cast!" : "Arm the Lair"}
            </Button>
            {!rush ? (
              <Button variant="ghost" disabled={coins < price} onClick={() => buyBait(BOSS_CHUM_INDEX)}>
                Boss Chum {money(price)} · have {chum}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Catch every other species in {BIOMES[biome].name} to open the Boss Lair. {24 - caught} still hiding.
        </p>
      )}
    </section>
  );
}

function DerbyBanner() {
  const derby = useGame((s) => s.derby);
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!derby) return null;
  const left = Math.max(0, Math.ceil((derby.endsAt - Date.now()) / 1000));
  const mins = Math.floor(left / 60);
  const secs = String(left % 60).padStart(2, "0");
  const standings = [...derby.rivals.map((r) => ({ n: r.n, s: r.s })), { n: "You", s: Math.floor(derby.score) }].sort(
    (a, b) => b.s - a.s,
  );
  return (
    <section className="rounded-2xl border border-brass bg-surface p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg">Derby</h3>
        <span className="text-sm text-brass">
          {mins}:{secs}
        </span>
      </div>
      <ul className="mt-1 text-sm">
        {standings.map((row) => (
          <li key={row.n} className="flex justify-between border-b border-line py-0.5 last:border-0">
            <span className={row.n === "You" ? "text-brass" : "text-muted"}>{row.n}</span>
            <span>{money(row.s)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-2 py-2 text-center">
      <p className="text-xs text-muted">{k}</p>
      <p className="font-serif text-lg leading-tight">{v}</p>
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return <span className="rounded-full bg-surface-2 px-2 py-1 text-xs text-brass">{children}</span>;
}

function BagPanel() {
  const inv = useGame((s) => s.inv);
  const mult = useGame((s) => multOf(s.dex, s.rb));
  const sellOne = useGame((s) => s.sellOne);
  const sellUpTo = useGame((s) => s.sellUpTo);
  const mode = useGame((s) => s.mode);
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
        <p className="font-serif text-xl">{money(Math.round(worth * mult))}</p>
        <p className="text-sm text-muted">
          {inv.length} on the bank · sale multiplier ×{mult.toFixed(2)}
        </p>
        {mode === "sandbox" ? (
          <p className="mt-2 text-sm text-muted">Zen Waters: fish are kept, never sold.</p>
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
              onClick={() => sellOne(index)}
              className="flex w-full items-center gap-3 border-b border-line py-2 text-left"
            >
              <FishPortrait
                biome={fish.b}
                species={fish.i}
                rarity={fish.t}
                mutation={fish.m}
                className="size-12 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate", TONE[fish.t])}>{fish.name}</span>
                <span className="block text-xs text-muted">
                  {BIOMES[fish.b].name} · {fish.w} lb
                </span>
              </span>
              <span className="text-sm">{money(Math.round(fish.v * mult))}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Tap a fish to sell it. The newest 60 of this filter are listed.</p>
    </div>
  );
}

function Filter({ on, children, onClick }: { on: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 shrink-0 rounded-full border px-3 text-sm",
        on ? "border-brass bg-surface-2 text-fg" : "border-line text-muted",
      )}
    >
      {children}
    </button>
  );
}

function GearPanel() {
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
      <GearList kind="line" title="Lines" hint={(i) => `Strain ${compact(LINES[i].hold)}`} />
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

function LurePanel() {
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
              Luck {compact(LURES[index].luck)} · haste {compact(LURES[index].speed)} · ×{box[String(index)]}
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
              <span className="mt-1 block text-xs text-muted">Have {count}</span>
              <span className="mt-2 flex gap-2">
                <Button
                  className="min-h-10 px-3 py-1 text-sm"
                  disabled={coins < price}
                  onClick={() => buyBait(index)}
                >
                  Buy {money(price)}
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-10 px-3 py-1 text-sm"
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

function WatersPanel() {
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
                <img src={`/art/biomes/${place.id}.jpg`} alt="" className="h-full w-full object-cover" />
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

function DexPanel() {
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
              <img src={`/art/biomes/${place.id}.jpg`} alt="" className="h-full w-full object-cover" />
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
                        "min-h-10 rounded-full px-3 text-xs",
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

function LodgePanel() {
  const view = useGame((s) => s.lodgeView);
  const setView = useGame((s) => s.setLodgeView);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 overflow-x-auto">
        {(
          [
            ["record", "Record"],
            ["tank", "Aquarium"],
            ["derby", "Derby"],
            ["crew", "Crew"],
            ["settings", "Settings"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              "min-h-10 flex-1 shrink-0 rounded-full px-2 text-sm",
              view === id ? "bg-brass text-brass-ink" : "bg-surface text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "record" ? <Record /> : null}
      {view === "tank" ? <Aquarium /> : null}
      {view === "derby" ? <DerbyView /> : null}
      {view === "crew" ? <CrewView /> : null}
      {view === "settings" ? <Settings /> : null}
    </div>
  );
}

function Record() {
  const s = useGame();
  const rebirth = useGame((st) => st.rebirth);
  const ready = s.tot >= 1e7 && s.ub.length === BIOMES.length && (s.phase === "idle" || sim.phase === "idle");
  const parts = [
    ["Rod", RODS[s.rod].luck],
    ["Boat", BOATS[s.boat].luck],
    ["Lure", s.lure >= 0 ? LURES[s.lure].luck : 0],
    ["Weather", WEATHER[s.weather].luck],
    ["Level", s.lv * 0.4],
    ["Rebirth", s.rb * 10],
    ["Dex", dexCount(s.dex) * 0.1],
  ] as const;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-surface p-3 text-sm leading-6">
        <p>
          Level {s.lv} · {s.xp}/{xpNeed(s.lv)} xp
        </p>
        <p>Caught {s.caught}</p>
        <p>Earned this run {money(s.tot)}</p>
        <p>Sale multiplier ×{multOf(s.dex, s.rb).toFixed(2)}</p>
        <p>Luck {Math.round(luckTotal(s, s.lure))}</p>
        <p>
          Rebirths {s.rb} · streak best {s.bestStreak}
        </p>
        <p>
          Perfect hooks {s.perfects} · bosses landed {s.bosses} · waters mastered {s.mastered.length}/15
        </p>
        <p>
          Derbies won {s.derbiesWon}
          {s.rushBest ? ` · best Boss Rush ${Math.round(s.rushBest / 1000)}s` : ""}
        </p>
      </div>
      <ul className="rounded-2xl border border-line bg-surface p-3 text-sm">
        {parts.map(([label, value]) => (
          <li key={label} className="flex justify-between border-b border-line py-1 last:border-0">
            <span className="text-muted">{label}</span>
            <span>{compact(value)}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Rebirth</h3>
        <p className="mt-1 text-sm text-muted">
          Needs {money(1e7)} earned this run and every water unlocked. Coins, gear, lures, waters, and this run’s
          earnings reset. Level, dex, mastered waters, signature lures, and the aquarium stay. Each rebirth adds
          50% sale value and 10 luck.
        </p>
        <p className="mt-2 text-sm">
          Earned {money(s.tot)} / {money(1e7)} · waters {s.ub.length}/{BIOMES.length}
        </p>
        <Button className="mt-3" disabled={!ready} onClick={rebirth}>
          {s.armRebirth ? "Tap again to rebirth" : "Rebirth"}
        </Button>
      </div>
    </div>
  );
}

function Aquarium() {
  const tank = useGame((s) => s.tank);
  const dex = useGame((s) => s.dex);
  const biome = useGame((s) => s.biome);
  const coins = useGame((s) => s.c);
  const mode = useGame((s) => s.mode);
  const addExhibit = useGame((s) => s.addExhibit);
  const removeExhibit = useGame((s) => s.removeExhibit);
  const togglePed = useGame((s) => s.togglePed);
  const autoStock = useGame((s) => s.autoStock);
  const feedTank = useGame((s) => s.feedTank);
  const buyTankTier = useGame((s) => s.buyTankTier);
  const buyGift = useGame((s) => s.buyGift);
  const buyLight = useGame((s) => s.buyLight);
  const [showPicker, setShowPicker] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);

  const tier = TANK_TIERS[tank.tier];
  const now = Date.now();
  const rate = tankRatePerHour(tank, dex, now);
  const totalValue = tankExhibitValue(tank, dex);
  const feedLeft = Math.max(0, Math.ceil((tank.feedUntil - now) / 60000));
  const nextTier = TANK_TIERS[tank.tier + 1];
  const giftPrice = GIFT_PRICES[tank.gift];

  const swimmers = tank.exhibits.slice(0, 14);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const fish = swimmers
      .map((key, n) => {
        const [b, i] = key.split("-").map(Number);
        const entry = dex[key];
        if (!entry) return null;
        return {
          b,
          i,
          rarity: rarityOf(i),
          m: entry.m,
          x: Math.random(),
          dir: Math.random() < 0.5 ? -1 : 1,
          y: 0.3 + ((n * 29) % 45) / 100,
          v: 0.05 + ((n * 13) % 5) * 0.012,
          phase: Math.random() * 6,
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row);
    let raf = 0;
    let last = performance.now();
    const loop = (tNow: number) => {
      const dt = Math.min(0.05, (tNow - last) / 1000);
      last = tNow;
      const box = fitCanvas(canvas);
      if (box) {
        const { ctx, w, h } = box;
        const img = biomeArt(biome);
        if (img) {
          ctx.drawImage(img, 0, 0, w, h);
          ctx.fillStyle = "rgba(12, 26, 34, 0.35)";
          ctx.fillRect(0, 0, w, h);
        } else {
          ctx.fillStyle = "#12343c";
          ctx.fillRect(0, 0, w, h);
        }
        for (const one of fish) {
          one.x += one.v * one.dir * dt;
          one.phase += dt;
          if (one.x > 1.1) one.dir = -1;
          if (one.x < -0.1) one.dir = 1;
          drawFish(ctx, one.x * w, one.y * h, Math.min(w, h) * 0.26, one.dir, {
            biome: one.b,
            species: one.i,
            rarity: one.rarity,
            mutation: one.m,
            wag: Math.sin(one.phase * 6) * 0.35,
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tank.exhibits.join(","), biome]);

  const candidates = Object.keys(dex)
    .filter((k) => dex[k]?.c && !tank.exhibits.includes(k))
    .map((k) => {
      const [b, i] = k.split("-").map(Number);
      return { k, b, i, v: exhibitValue(dex[k], b, i) };
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, 40);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-serif text-xl">{tier.name}</h3>
          <span className="text-sm text-brass">{money(Math.round(rate))}/hr</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Exhibits {tank.exhibits.length}/{tier.slots} · glass worth {money(totalValue)} · offline cap {tier.capHours}h
          {tank.gift ? ` · gift shop +${tank.gift * 25}%` : ""}
          {mode === "sandbox" ? " · Zen Waters exhibits are for the love of it — no rent" : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button disabled={feedLeft > 0 || tank.exhibits.length === 0} onClick={feedTank}>
            {feedLeft > 0 ? `Fed · +50% for ${feedLeft}m` : "Feed the tank"}
          </Button>
          <Button variant="ghost" onClick={autoStock}>
            Stock the best
          </Button>
          <Button variant="ghost" onClick={() => setShowPicker((v) => !v)}>
            {showPicker ? "Hide choices" : "Choose exhibits"}
          </Button>
        </div>
      </div>

      <div className="relative h-56 overflow-hidden rounded-2xl border border-line">
        <canvas ref={ref} className="h-full w-full" />
        {tank.exhibits.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-fg">
            The glass is empty. Stock your best fish and they will earn while you sleep.
          </p>
        ) : null}
      </div>

      {tank.exhibits.length ? (
        <ul className="flex flex-col">
          {tank.exhibits.map((key) => {
            const [b, i] = key.split("-").map(Number);
            const entry = dex[key];
            if (!entry) return null;
            const onPed = tank.ped.includes(key);
            const lit = tank.lights.includes(b);
            const v = exhibitValue(entry, b, i);
            return (
              <li key={key} className="flex items-center gap-2 border-b border-line py-2">
                <FishPortrait biome={b} species={i} rarity={rarityOf(i)} mutation={entry.m} className="size-12 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {entry.m ? `${MUTATIONS[entry.m].name} ` : ""}
                    {BIOMES[b].fish[i]}
                  </span>
                  <span className="block text-xs text-muted">
                    {BIOMES[b].name} · glass {money(v)}
                    {onPed ? " · showcase ×3" : ""}
                    {lit ? " · lit ×1.5" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => togglePed(key)}
                  className={cn(
                    "min-h-10 rounded-full px-3 text-xs",
                    onPed ? "bg-brass text-brass-ink" : "text-muted",
                  )}
                >
                  Showcase
                </button>
                <button type="button" onClick={() => removeExhibit(key)} className="min-h-10 rounded-full px-3 text-xs text-muted">
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {showPicker ? (
        <div className="flex flex-col gap-1">
          <h4 className="font-serif">Add exhibits ({tank.exhibits.length}/{tier.slots})</h4>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted">Nothing else caught yet — or the tank is full.</p>
          ) : (
            candidates.map(({ k, b, i, v }) => (
              <button
                key={k}
                type="button"
                disabled={tank.exhibits.length >= tier.slots}
                onClick={() => addExhibit(k)}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5 text-left enabled:hover:border-brass disabled:opacity-50"
              >
                <FishPortrait biome={b} species={i} rarity={rarityOf(i)} mutation={dex[k].m} className="size-10 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{BIOMES[b].fish[i]}</span>
                  <span className="block text-xs text-muted">{BIOMES[b].name}</span>
                </span>
                <span className="text-sm text-brass">{money(v)}</span>
              </button>
            ))
          )}
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h4 className="font-serif text-lg">Upgrades</h4>
        {nextTier ? (
          <Button disabled={coins < nextTier.price} onClick={buyTankTier}>
            {nextTier.name} · {nextTier.slots} slots · {nextTier.capHours}h cap · {money(nextTier.price)}
          </Button>
        ) : (
          <p className="text-sm text-muted">The Grand Dome is as grand as it gets.</p>
        )}
        {giftPrice != null ? (
          <Button variant="ghost" disabled={coins < giftPrice} onClick={buyGift}>
            Gift Shop level {tank.gift + 1} · +25% income · {money(giftPrice)}
          </Button>
        ) : (
          <p className="text-sm text-muted">Gift shop fully stocked (+75% income).</p>
        )}
        <p className="text-sm text-muted">
          Lighting rigs boost exhibits from one water by 50% ({money(LIGHT_PRICE)} each). Showcase pedestals (×3)
          hold {SHOWCASE_SLOTS}.
        </p>
        <div className="flex flex-wrap gap-1">
          {BIOMES.map((place, b) =>
            tank.lights.includes(b) ? null : (
              <button
                key={place.id}
                type="button"
                disabled={coins < LIGHT_PRICE}
                onClick={() => buyLight(b)}
                className="min-h-10 rounded-full border border-line px-3 text-xs text-muted enabled:hover:border-brass disabled:opacity-50"
              >
                Light: {place.name}
              </button>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function DerbyView() {
  const derby = useGame((s) => s.derby);
  const startDerby = useGame((s) => s.startDerby);
  const derbiesWon = useGame((s) => s.derbiesWon);
  const bosses = useGame((s) => s.bosses);
  const mastered = useGame((s) => s.mastered);
  const rush = useGame((s) => s.rush);
  const startRush = useGame((s) => s.startRush);
  const rushBest = useGame((s) => s.rushBest);
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Derby</h3>
        <p className="mt-1 text-sm text-muted">
          Ten minutes against three rival anglers. Most catch value wins the purse — prizes are money and bragging
          rights, never power. Derbies won: {derbiesWon}.
        </p>
        {derby ? (
          <p className="mt-2 text-sm text-brass">A derby is running — watch the Cast tab for live standings.</p>
        ) : (
          <Button className="mt-3" onClick={startDerby}>
            Start derby
          </Button>
        )}
      </section>
      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Boss Rush</h3>
        <p className="mt-1 text-sm text-muted">
          Every boss you have mastered, back to back, against the clock. Boss Chum is free during a rush.
          {rushBest ? ` Best clear: ${Math.floor(rushBest / 60000)}:${String(Math.floor((rushBest / 1000) % 60)).padStart(2, "0")}.` : ""}
        </p>
        <p className="mt-2 text-sm">
          Bosses landed {bosses} · waters mastered {mastered.length}
        </p>
        {rush ? (
          <p className="mt-2 text-sm text-brass">
            Rush in progress — boss {rush.pos + 1} of {rush.list.length} waits in {BIOMES[rush.list[rush.pos]].name}.
          </p>
        ) : (
          <Button className="mt-3" disabled={bosses < 3 || mastered.length === 0} onClick={startRush}>
            {bosses < 3 ? `Locked — land 3 bosses (${bosses}/3)` : "Start Boss Rush"}
          </Button>
        )}
      </section>
    </div>
  );
}

function CrewView() {
  const status = useCrew((s) => s.status);
  const code = useCrew((s) => s.code);
  const isHost = useCrew((s) => s.isHost);
  const peers = useCrew((s) => s.peers);
  const feed = useCrew((s) => s.feed);
  const error = useCrew((s) => s.error);
  const notify = useGame((s) => s.notify);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Online co-op</h3>
        <p className="mt-1 text-sm text-muted">
          Fish the same water with friends, browser to browser. The room creator sets the weather; everyone sees
          each other's boats and catches. Saves and dex stay your own — no trading, nothing to cheat.
        </p>
        {status === "off" ? (
          <div className="mt-3 flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your angler name"
              maxLength={24}
              className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-muted"
            />
            <Button
              onClick={async () => {
                const created = await createRoom(name || "Angler");
                if (created) notify(`Room ${created} — share the code.`);
              }}
            >
              Create a room
            </Button>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={8}
                className="min-h-11 w-28 rounded-xl border border-line bg-surface-2 px-3 text-center font-serif text-lg tracking-widest text-fg placeholder:text-muted"
              />
              <Button variant="ghost" className="flex-1" onClick={() => void joinRoom(joinCode, name || "Angler")}>
                Join with code
              </Button>
            </div>
            {error ? <p className="text-sm text-brass">{error}</p> : null}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm">
              Room <span className="font-serif text-xl tracking-widest text-brass">{code}</span>{" "}
              <span className="text-muted">
                {status === "joining" ? "· joining…" : isHost ? "· you host the weather" : "· connected"}
              </span>
            </p>
            <ul className="text-sm">
              {peers.length === 0 ? (
                <li className="text-muted">Waiting for partners — share the code.</li>
              ) : (
                peers.map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-line py-1 last:border-0">
                    <span>{p.name || "Partner"}</span>
                    <span className="text-muted">
                      {p.connectionState}
                      {p.rttMs != null ? ` · ${p.rttMs}ms` : ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
            <Button variant="ghost" onClick={leaveRoom}>
              Leave room
            </Button>
          </div>
        )}
      </section>
      {feed.length ? (
        <section className="rounded-2xl border border-line bg-surface p-3">
          <h4 className="font-serif">On the water</h4>
          <ul className="mt-1 flex flex-col gap-1 text-sm text-muted">
            {[...feed].reverse().map((f) => (
              <li key={f.id}>{f.text}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Settings() {
  const sound = useGame((s) => s.sound);
  const motion = useGame((s) => s.motion);
  const flash = useGame((s) => s.flash);
  const toggle = useGame((s) => s.toggleSetting);
  const wipe = useGame((s) => s.wipe);
  const armed = useGame((s) => s.armReset);
  const notify = useGame((s) => s.notify);
  const importSave = useGame((s) => s.importSave);
  const exportCode = useGame((s) => s.exportCode);
  const importCode = useGame((s) => s.importCode);
  const mode = useGame((s) => s.mode);
  const file = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [codeOut, setCodeOut] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <Toggle on={sound} onClick={() => toggle("sound")}>
        Sound
      </Toggle>
      <Toggle on={motion} onClick={() => toggle("motion")}>
        Motion and shake
      </Toggle>
      <Toggle on={flash} onClick={() => toggle("flash")}>
        Flashes
      </Toggle>
      <Button variant="ghost" onClick={downloadSave}>
        Export ledger (file)
      </Button>
      <Button variant="ghost" onClick={() => file.current?.click()}>
        Import ledger (file)
      </Button>
      <input
        ref={file}
        type="file"
        accept="application/json"
        className="sr-only"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (!picked) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const ok = importSave(JSON.parse(String(reader.result)));
              if (!ok) notify("That file is not a ledger.");
            } catch {
              notify("That file is not a ledger.");
            }
          };
          reader.readAsText(picked);
        }}
      />
      <div className="rounded-2xl border border-line bg-surface p-3">
        <h4 className="font-serif">Save code</h4>
        <p className="mt-1 text-sm text-muted">
          One code carries this mode's whole ledger ({mode}). Paste it on another device to pick up where you left
          off — importing replaces this slot's save.
        </p>
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => {
            setCodeOut(exportCode());
            notify("Save code ready below.");
          }}
        >
          Make my save code
        </Button>
        {codeOut ? (
          <textarea
            readOnly
            value={codeOut}
            rows={3}
            onFocus={(e) => e.target.select()}
            className="mt-2 w-full rounded-xl border border-line bg-surface-2 p-2 text-xs text-fg"
          />
        ) : null}
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={3}
          placeholder="Paste a save code here…"
          className="mt-2 w-full rounded-xl border border-line bg-surface-2 p-2 text-xs text-fg placeholder:text-muted"
        />
        <Button
          className="mt-2"
          disabled={!code.trim()}
          onClick={() => {
            if (importCode(code)) setCode("");
            else notify("That code is not a ledger.");
          }}
        >
          Import this code
        </Button>
      </div>
      <Button variant="ghost" onClick={wipe}>
        {armed ? "Tap again to erase" : "Erase this ledger"}
      </Button>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="flex min-h-12 items-center justify-between rounded-2xl border border-line bg-surface px-3"
    >
      <span>{children}</span>
      <span className={on ? "text-brass" : "text-muted"}>{on ? "On" : "Off"}</span>
    </button>
  );
}
