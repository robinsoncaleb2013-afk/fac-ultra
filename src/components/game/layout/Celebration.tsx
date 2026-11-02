import { CatchEventLine } from "@/components/game/events";
import { useMutationText } from "@/components/game/use-mutation";
import { useEffect, useRef } from "react";
import { BIOMES, money, multOf, RARITIES, TONE } from "@/game/content";
import { STEWARD_SPECIES } from "@/game/keep";
import { recordLine } from "@/game/records";
import { useGame } from "@/game/engine";
import { moneyWords } from "@/game/kid";
import { canKeep, canRelease, MODES } from "@/game/modes";
import { SpeakButton } from "@/components/game/kid";
import { useKidOn } from "@/components/game/use-kid";
import { confettiFor } from "@/game/graphics";
import { rarityColors } from "@/game/rarity";
import { RarityMark } from "@/components/game/rarity-mark";
import { FishPortrait } from "@/components/game/portrait";
import { ArtThumb, Badge } from "@/components/game/panels/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const HOLD_MS = 6000;

/** Confetti from the top edge of the card, 1.2 s, in the rarity colour. Pooled on one small canvas. */
function Confetti({ count, color }: { count: number; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !count) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);
    const x = new Float32Array(count);
    const y = new Float32Array(count);
    const vx = new Float32Array(count);
    const vy = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      x[i] = Math.random() * w;
      y[i] = 0;
      vx[i] = (Math.random() - 0.5) * 120;
      vy[i] = 40 + Math.random() * 160;
    }
    let t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      const age = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        vy[i] += 260 * dt;
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        ctx.globalAlpha = Math.max(0, 1 - age / 1.2);
        ctx.fillRect(x[i], y[i], 5, 3);
      }
      if (age < 1.2) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    const start = performance.now();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count, color]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full w-full" />;
}

/**
 * Desktop: a card that rises bottom-right. Phone: a bottom sheet, 55 % high.
 * Keep or Release (K / R). Nothing stalls: after 6 s it keeps the fish by itself, and a click,
 * Space, Esc or a swipe down also keeps it (04 §6).
 */
export function Celebration({ mobile }: { mobile?: boolean }) {
  const cel = useGame((s) => s.celebration);
  const mut = useMutationText();
  const keep = useGame((s) => s.keepCatch);
  const release = useGame((s) => s.releaseCatch);
  const eatNow = useGame((s) => s.campEat);
  const larder = useGame((s) => s.survival?.larder.length ?? 0);
  const records = useGame((s) => s.records);
  const released = useGame((s) => s.released);
  const stewards = useGame((s) => s.stewards);
  const motion = useGame((s) => s.motion);
  const tier = useGame((s) => s.tier);
  const cb = useGame((s) => s.cb);
  const mult = useGame((s) => multOf(s.dex, s.rb));
  const rules = useGame((s) => MODES[s.mode]);
  const kid = useKidOn();
  const at = cel?.at;
  const startY = useRef(0);

  /* Auto-Keep: the fish is already in the bag, so letting the card go is the Keep. */
  useEffect(() => {
    if (at === undefined) return;
    const timer = window.setTimeout(keep, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [at, keep]);

  if (!cel) return null;
  const c = cel.catch;
  const confetti = motion ? confettiFor(tier, c.rarity) : 0;
  const color = rarityColors(cb)[c.rarity] ?? rarityColors(cb)[0];
  const key = `${c.biome}-${c.species}`;
  const rec = records[key];
  const newBest = c.record && rec && rec.w === c.weight ? rec : null;
  const gone = released[key] ?? 0;
  const isSteward = stewards.species.includes(key);
  const toSteward = Math.max(0, STEWARD_SPECIES - gone);
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={keep}
      onTouchStart={(e) => {
        startY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (e.changedTouches[0].clientY - startY.current > 60) keep();
      }}
      className={cn(
        "safe-x absolute z-40 overflow-hidden border border-line bg-surface shadow-2xl",
        motion && "fac-rise",
        mobile
          ? "inset-x-0 bottom-0 flex h-[55%] flex-col rounded-t-3xl"
          : "right-4 bottom-4 flex h-[392px] w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-3xl",
      )}
    >
      <div className="relative h-36 shrink-0 bg-surface-2">
        <ArtThumb id={BIOMES[c.biome].id} className="absolute inset-0 h-full w-full object-cover opacity-50 blur-sm" />
        <FishPortrait
          biome={c.biome}
          species={c.species}
          rarity={c.rarity}
          mutation={c.mutation}
          className="relative h-full w-full"
        />
        {c.discovered ? (
          <span
            className={cn(
              "absolute top-3 right-4 rounded-lg border-4 border-brass px-3 py-0.5 font-serif text-[48px] leading-none font-bold tracking-wide text-brass",
              motion && "fac-stamp",
            )}
            style={{ transform: "rotate(-12deg)" }}
          >
            NEW!
          </span>
        ) : null}
        {c.shiny ? (
          <span aria-hidden className={cn("absolute bottom-3 left-4 text-3xl text-brass", motion && "fac-twinkle")}>
            ✦
          </span>
        ) : null}
        {c.record ? (
          <span className="absolute top-3 left-0 bg-lagoon px-3 py-1 text-xs font-bold tracking-wider text-bg uppercase">
            Personal best
          </span>
        ) : null}
        <Confetti count={confetti} color={color} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 p-4">
        <p className={cn("text-xs font-semibold tracking-wide uppercase", TONE[c.rarity])}>
          <RarityMark rarity={c.rarity} className="mr-1" />
          {RARITIES[c.rarity].name}
          {c.mutation ? ` · ${mut.name(c.mutation)}` : ""}
        </p>
        <h2 className="font-serif text-[32px] leading-tight">{c.name}</h2>
        <CatchEventLine mutation={c.mutation} />
        <p className="text-sm text-muted">
          {BIOMES[c.biome].name} · {c.weight} lb
          {rules.economy ? (
            <span title={kid ? moneyWords(Math.round(c.value * mult)) : undefined}>
              {" "}
              · worth {money(Math.round(c.value * mult))}
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {c.discovered ? <Badge>New species</Badge> : null}
          {c.perfect ? <Badge>Perfect hook</Badge> : null}
          {c.record ? <Badge>Record</Badge> : null}
          {c.boss ? <Badge>Boss</Badge> : null}
          {c.frenzy ? <Badge>Frenzy</Badge> : null}
          {c.shiny ? <Badge>Shiny</Badge> : null}
          {c.fotd ? <Badge>Fish of the Day: double XP</Badge> : null}
          {c.page ? <Badge>Page sticker</Badge> : null}
        </div>
        {newBest ? (
          <p className="text-xs leading-snug text-lagoon">New best · {recordLine(newBest, c.biome)}</p>
        ) : null}
        <div className="mt-auto flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
          {kid ? (
            <SpeakButton
              text={`${c.name}. ${RARITIES[c.rarity].name}. ${c.weight} pounds. Caught in ${BIOMES[c.biome].name}.${c.discovered ? " A new kind of fish for you!" : ""}`}
              className="size-12"
            />
          ) : null}
          {canKeep(rules) ? (
            <Button className="min-h-12 flex-1" onClick={keep}>
              {rules.survival ? "To the larder" : "Keep"}
              {mobile ? null : <kbd className="ml-1.5 text-xs opacity-70">K</kbd>}
            </Button>
          ) : null}
          {rules.survival ? (
            <Button
              variant="ghost"
              className="min-h-12 flex-1"
              disabled={larder < 1}
              onClick={() => {
                eatNow(larder - 1, "raw");
                keep();
              }}
            >
              Eat it raw
            </Button>
          ) : null}
          {canRelease(rules) ? (
            <Button variant="ghost" className="min-h-12 flex-1" onClick={release}>
              Release{mobile ? null : <kbd className="ml-1.5 text-xs opacity-70">R</kbd>}
            </Button>
          ) : null}
        </div>
        <p className="text-center text-xs text-muted">
          {rules.survival
            ? "It is in your larder. Cook it at camp, or eat it raw (sometimes it is bad)."
            : isSteward
            ? `Release for 20% more XP. You are this fish's Steward.`
            : `Release for 20% more XP · ${toSteward} more to be its Steward`}
        </p>
        {motion ? <span aria-hidden className="fac-drain absolute inset-x-0 bottom-0 h-1 bg-brass/60" /> : null}
      </div>
    </div>
  );
}
