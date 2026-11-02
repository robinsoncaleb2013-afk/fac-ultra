import { useEffect, useRef, useState } from "react";
import { BIOMES, MUTATIONS, money, multOf, RARITIES, TONE } from "@/game/content";
import { useGame } from "@/game/engine";
import { confettiFor, RARITY_COLORS } from "@/game/graphics";
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
 * Auto-closes after 6 s (hover on desktop keeps it), click / Space / Esc / swipe down closes it.
 */
export function Celebration({ mobile }: { mobile?: boolean }) {
  const cel = useGame((s) => s.celebration);
  const dismiss = useGame((s) => s.dismissCelebration);
  const motion = useGame((s) => s.motion);
  const tier = useGame((s) => s.tier);
  const mult = useGame((s) => multOf(s.dex, s.rb));
  const [hover, setHover] = useState(false);
  const at = cel?.at;
  const startY = useRef(0);

  useEffect(() => {
    if (at === undefined || hover) return;
    const timer = window.setTimeout(dismiss, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [at, hover, dismiss]);

  if (!cel) return null;
  const c = cel.catch;
  const confetti = motion ? confettiFor(tier, c.rarity) : 0;
  const color = RARITY_COLORS[c.rarity] ?? RARITY_COLORS[0];
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={dismiss}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onTouchStart={(e) => {
        startY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (e.changedTouches[0].clientY - startY.current > 60) dismiss();
      }}
      className={cn(
        "safe-x absolute z-40 overflow-hidden border border-line bg-surface shadow-2xl",
        motion && "fac-rise",
        mobile
          ? "inset-x-0 bottom-0 flex h-[55%] flex-col rounded-t-3xl"
          : "right-4 bottom-4 flex h-[300px] w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-3xl",
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
        {c.record ? (
          <span className="absolute top-3 left-0 bg-lagoon px-3 py-1 text-xs font-bold tracking-wider text-bg uppercase">
            Personal best
          </span>
        ) : null}
        <Confetti count={confetti} color={color} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 p-4">
        <p className={cn("text-xs font-semibold tracking-wide uppercase", TONE[c.rarity])}>
          {RARITIES[c.rarity].name}
          {c.mutation ? ` · ${MUTATIONS[c.mutation].name}` : ""}
        </p>
        <h2 className="font-serif text-[32px] leading-tight">{c.name}</h2>
        <p className="text-sm text-muted">
          {BIOMES[c.biome].name} · {c.weight} lb · worth {money(Math.round(c.value * mult))}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {c.discovered ? <Badge>New species</Badge> : null}
          {c.perfect ? <Badge>Perfect hook</Badge> : null}
          {c.record ? <Badge>Record</Badge> : null}
          {c.boss ? <Badge>Boss</Badge> : null}
          {c.frenzy ? <Badge>Frenzy</Badge> : null}
        </div>
        {mobile ? (
          <Button className="mt-auto min-h-12" onClick={dismiss}>
            Nice!
          </Button>
        ) : null}
      </div>
    </div>
  );
}
