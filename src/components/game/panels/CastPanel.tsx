import { useEffect, useState } from "react";
import {
  AUTO_PRICE,
  BIOMES,
  biomeSpeciesCaught,
  BOSS_CHUM_INDEX,
  BOSS_INDEX,
  bossChumPrice,
  luckTotal,
  LURES,
  money,
  multOf,
  MUTATIONS,
  RARITIES,
  STAGE_NAMES,
  TONE,
} from "@/game/content";
import { useGame } from "@/game/engine";
import { MODES, stageIn } from "@/game/modes";
import { TripBar } from "@/components/game/trips";
import { SurvivalCastCard } from "@/components/game/survival";
import { TournamentPanel } from "@/components/game/tournament";
import { FotdCard } from "@/components/game/fun";
import { useFunOn } from "@/components/game/fun-hooks";
import { RarityMark } from "@/components/game/rarity-mark";
import { rivalById } from "@/game/rivals";
import { DEFAULT_RIG, FAMILY_INFO, familyOf, rigLabel } from "@/game/presentation";
import { resolveSpot } from "@/game/spots";
import { FishPortrait } from "@/components/game/portrait";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ArtThumb, Stat, Badge } from "@/components/game/panels/shared";

/** Lair, lure and auto-reel controls. On desktop these live in the Waters drawer. */
export function BossControls() {
  const auto = useGame((s) => s.auto);
  const autoOn = useGame((s) => s.autoOn);
  const toggleAuto = useGame((s) => s.toggleAuto);
  const lure = useGame((s) => s.lure);
  const box = useGame((s) => s.box);
  const mode = useGame((s) => s.mode);
  const rules = MODES[mode];
  return (
    <div className="flex flex-col gap-3">
      <TripBar />
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
      ) : !rules.economy ? null : (
        <p className="text-sm text-muted">Auto-reel is in Gear for {money(AUTO_PRICE)}. It banks fish at 40% value.</p>
      )}
    </div>
  );
}

/** Desktop: one small chip per bounty; a finished one turns into a Claim button. */
export function BountyChips() {
  const contracts = useGame((s) => s.contracts);
  const claim = useGame((s) => s.claim);
  if (!contracts.length) return null;
  return (
    <ul className="flex flex-wrap justify-end gap-1.5" aria-label="Bounties">
      {contracts.map((c) => {
        const ready = c.prog >= c.goal;
        return (
          <li key={c.id}>
            <button
              type="button"
              disabled={!ready}
              onClick={() => claim(c.id)}
              title={`${c.label} — ${money(c.reward)}`}
              className={cn(
                "pointer-events-auto min-h-8 rounded-full border px-3 py-1 text-xs backdrop-blur-sm",
                ready ? "border-brass bg-brass text-brass-ink" : "border-line bg-bg/70 text-fg",
              )}
            >
              {ready ? `Claim ${money(c.reward)}` : `${c.label} ${Math.min(c.prog, c.goal)}/${c.goal}`}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Open bounties with a Claim button each. */
export function Bounties() {
  const contracts = useGame((s) => s.contracts);
  const claim = useGame((s) => s.claim);
  if (!contracts.length) return null;
  return (
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
                  <Button className="min-h-11 px-3 py-2 text-sm" disabled={!ready} onClick={() => claim(c.id)}>
                    Claim
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
  );
}

/** Where the line is aimed and how it is rigged, so the Cast tab says it in words too. */
function SpotCard() {
  const biome = useGame((s) => s.biome);
  const spot = useGame((s) => resolveSpot(s.biome, s.lastSpot[s.biome]));
  const rig = useGame((s) => s.rig[s.biome]) ?? DEFAULT_RIG;
  const family = useGame((s) => familyOf({ lure: s.lure, sig: s.sig, bait: s.bait }));
  return (
    <section className="rounded-2xl border border-line bg-surface p-3" aria-label={`Fishing spot in ${BIOMES[biome].name}`}>
      <p className="text-xs text-muted">You are fishing</p>
      <h3 className="font-serif text-lg leading-tight">{spot.name}</h3>
      <p className="text-sm text-muted">{spot.tip}</p>
      <p className="mt-1 text-sm">
        <span className="text-brass">{rigLabel(rig)}</span>
        <span className="text-muted"> · {FAMILY_INFO[family].label}</span>
      </p>
    </section>
  );
}

export function CastPanel() {
  if (useGame((s) => s.mode === "tournament")) return <TournamentPanel />;
  return <CastPanelCareer />;
}

function CastPanelCareer() {
  const luck = useGame((s) => Math.round(luckTotal(s, s.lure)));
  const streak = useGame((s) => s.streak);
  const last = useGame((s) => s.lastCatch);
  const mult = useGame((s) => multOf(s.dex, s.rb));
  const taught = useGame((s) => s.taught);
  const stage = useGame((s) => stageIn(MODES[s.mode], s.dex, s.biome));
  const derby = useGame((s) => s.derby);
  const survival = useGame((s) => !!MODES[s.mode].survival);
  const fun = useFunOn();

  return (
    <div className="flex flex-col gap-3">
      {survival ? <SurvivalCastCard /> : null}
      {fun ? <FotdCard /> : null}
      <div className={cn("grid grid-cols-3 gap-2", survival && "hidden")}>
        <Stat k="Luck" v={String(luck)} />
        <Stat k="Streak" v={String(streak)} />
        <Stat k="Stage" v={STAGE_NAMES[stage]} />
      </div>
      <SpotCard />
      {derby ? <DerbyBanner /> : null}
      {survival ? null : <BossControls />}
      {last ? (
        <article className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="relative h-40 bg-surface-2">
            <ArtThumb id={BIOMES[last.biome].id} className="absolute inset-0 h-full w-full object-cover opacity-60" />
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
              <RarityMark rarity={last.rarity} className="mr-1" />
              {RARITIES[last.rarity].name}
              {last.mutation ? ` · ${MUTATIONS[last.mutation].name}` : ""}
            </p>
            <h2 className="font-serif text-2xl leading-tight">{last.name}</h2>
            <p className="text-sm text-muted">
              {BIOMES[last.biome].name} · {last.weight} lb{survival ? "" : ` · worth ${money(Math.round(last.value * mult))}`}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {last.discovered ? <Badge>New species</Badge> : null}
              {last.perfect ? <Badge>Perfect hook</Badge> : null}
              {last.boss ? <Badge>Boss</Badge> : null}
              {last.frenzy ? <Badge>Frenzy</Badge> : null}
              {last.shiny ? <Badge>Shiny</Badge> : null}
              {last.fotd ? <Badge>Fish of the Day</Badge> : null}
            </div>
          </div>
        </article>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-sm text-muted">
          {survival ? "Nothing caught yet. Cast, hook the bite, and hold the reel while the needle stays green." : "The bank is empty. Cast, hook the bite, then keep the brass mark in the teal band."}
        </p>
      )}
      <Bounties />
      {taught || survival ? null : (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
          <li>Cast and watch the bobber.</li>
          <li>Hook as soon as it bites. A fast hook is worth more.</li>
          <li>Tap Reel only while the brass mark is inside the teal band. Misses strain the line.</li>
        </ol>
      )}
    </div>
  );
}

export function BossCard() {
  const biome = useGame((s) => s.biome);
  const caught = useGame((s) => biomeSpeciesCaught(s.dex, s.biome));
  const stage = useGame((s) => stageIn(MODES[s.mode], s.dex, s.biome));
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

export function DerbyBanner() {
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
  const standings = [
    ...derby.rivals.map((r) => {
      const rv = rivalById(r.id);
      return { n: rv ? `${rv.emoji} ${rv.name}` : "Rival", s: r.s };
    }),
    { n: "You", s: Math.floor(derby.score) },
  ].sort((a, b) => b.s - a.s);
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
          <li key={row.n} className="flex justify-between gap-3 border-b border-line py-0.5 last:border-0">
            <span className={row.n === "You" ? "text-brass" : "text-muted"}>{row.n}</span>
            <span>{money(row.s)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

