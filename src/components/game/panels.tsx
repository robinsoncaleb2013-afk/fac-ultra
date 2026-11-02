import { useEffect, useRef, useState } from "react";
import {
  AUTO_PRICE,
  BIOMES,
  BOATS,
  compact,
  dexCount,
  GEAR,
  type GearKind,
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
  TONE,
  WEATHER,
  xpNeed,
} from "@/game/content";
import { downloadSave, sim, useGame } from "@/game/engine";
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
  const untilBoss = useGame((s) => s.untilBoss);
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
  const tide = untilBoss <= 0 ? "Next cast" : String(untilBoss);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat k="Luck" v={String(luck)} />
        <Stat k="Streak" v={String(streak)} />
        <Stat k="Tide" v={tide} />
      </div>
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
      ) : (
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
              {last.boss ? <Badge>Tide</Badge> : null}
              {last.frenzy ? <Badge>Frenzy</Badge> : null}
            </div>
          </div>
        </article>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-sm text-muted">
          The bank is empty. Cast, hook the bite, then keep the brass mark in the teal band.
        </p>
      )}
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
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={() => sellUpTo(9)}>Sell all</Button>
          <Button variant="ghost" onClick={() => sellUpTo(1)}>
            Sell common and uncommon
          </Button>
        </div>
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
    </div>
  );
}

function WatersPanel() {
  const biome = useGame((s) => s.biome);
  const ub = useGame((s) => s.ub);
  const coins = useGame((s) => s.c);
  const travel = useGame((s) => s.travel);
  const phase = useGame((s) => s.phase);
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
          return (
            <button
              key={place.id}
              type="button"
              disabled={locked || here || (!owned && !afford)}
              onClick={() => travel(index)}
              className={cn(
                "overflow-hidden rounded-2xl border text-left",
                here ? "border-brass" : "border-line",
              )}
            >
              <span className="relative block h-28">
                <img src={`/art/biomes/${place.id}.jpg`} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
                <span className="absolute bottom-2 left-3 font-serif text-lg">{place.name}</span>
              </span>
              <span className="block px-3 py-2 text-sm text-brass">
                {here ? "Here" : owned ? "Travel" : `Unlock ${money(place.price)}`}
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
  const n = dexCount(dex);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-serif text-lg">Dex {n}/200</h3>
        <p className="text-sm text-muted">Each species adds 1% to sale prices and 0.1 luck. Pin up to eight for the tank.</p>
      </div>
      {BIOMES.map((place, biome) => (
        <section key={place.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="relative h-16">
            <img src={`/art/biomes/${place.id}.jpg`} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg/80 to-transparent" />
            <h4 className="absolute bottom-2 left-3 font-serif">{place.name}</h4>
          </div>
          <ul className="flex flex-col">
            {place.fish.map((name, index) => {
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
          </ul>
        </section>
      ))}
    </div>
  );
}

function LodgePanel() {
  const [view, setView] = useState<"record" | "tank" | "settings">("record");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        {(
          [
            ["record", "Record"],
            ["tank", "Tank"],
            ["settings", "Settings"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              "min-h-10 flex-1 rounded-full text-sm",
              view === id ? "bg-brass text-brass-ink" : "bg-surface text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "record" ? <Record /> : null}
      {view === "tank" ? <Tank /> : null}
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
          Perfect hooks {s.perfects} · tide beasts {s.bosses}
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
          earnings reset. Level, dex, and the tank stay. Each rebirth adds 50% sale value and 10 luck.
        </p>
        <p className="mt-2 text-sm">
          Earned {money(s.tot)} / {money(1e7)} · waters {s.ub.length}/10
        </p>
        <Button className="mt-3" disabled={!ready} onClick={rebirth}>
          {s.armRebirth ? "Tap again to rebirth" : "Rebirth"}
        </Button>
      </div>
    </div>
  );
}

function Tank() {
  const pins = useGame((s) => s.pins);
  const dex = useGame((s) => s.dex);
  const biome = useGame((s) => s.biome);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const fish = pins
      .map((key) => {
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
          y: 0.35 + Math.random() * 0.4,
          v: 0.06 + Math.random() * 0.05,
          phase: Math.random() * 6,
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
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
          drawFish(ctx, one.x * w, one.y * h, Math.min(w, h) * 0.28, one.dir, {
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
  }, [pins, dex, biome]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-56 overflow-hidden rounded-2xl border border-line">
        <canvas ref={ref} className="h-full w-full" />
        {pins.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-fg">
            Pin species from the dex. They live here.
          </p>
        ) : null}
      </div>
      <ul className="text-sm text-muted">
        {pins.map((key) => {
          const [b, i] = key.split("-").map(Number);
          return (
            <li key={key}>
              {BIOMES[b].name} · {BIOMES[b].fish[i]}
            </li>
          );
        })}
      </ul>
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
  const file = useRef<HTMLInputElement>(null);
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
        Export ledger
      </Button>
      <Button variant="ghost" onClick={() => file.current?.click()}>
        Import ledger
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
