import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { loadArt, wantedSize } from "@/game/art";
import { biomeSpeciesCaught, BIOMES, BOSS_INDEX, STAGE_NAMES, stageOf, WEATHER } from "@/game/content";
import { MODES } from "@/game/modes";
import { creelLine } from "@/game/trips";
import { act, frame, reelDown, reelUp, sim, useGame, windowFor } from "@/game/engine";
import { WINDOW_INFO } from "@/game/presentation";
import { nearestSpot } from "@/game/spots";
import { FpsMeter, governorStep, shouldSkipFrame, TIERS } from "@/game/graphics";
import { paint } from "@/components/game/stage-paint";
import { cn } from "@/lib/cn";

type StageProps = {
  /** Menu backdrop: same living water, no line, bobber or ring, and the small painting. */
  menu?: boolean;
  /** Bigger fight ring for a thumb (09 §3.1). */
  big?: boolean;
  className?: string;
  /** Show this water instead of the player's (menu preview swipes). */
  biomeOverride?: number;
  /** What a tap on the water does when it is not a fight. Default: act() (cast / hook). While reeling, a press always holds the reel. */
  onWater?: () => void;
  children?: ReactNode;
};

const LIGHTER = "Switched to lighter graphics for a smoother game — change it in Settings.";

export function Stage({ menu = false, big = false, className, biomeOverride, onWater, children }: StageProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const playerBiome = useGame((s) => s.biome);
  const biome = biomeOverride ?? playerBiome;
  const tier = useGame((s) => s.tier);
  const idle = useGame((s) => s.phase === "idle");
  const view = useRef({ tier, big, menu, biome });
  view.current = { tier, big, menu, biome };

  /* Paintings: the water you are in first, then its neighbours when idle. */
  useEffect(() => {
    const canvas = ref.current;
    const width = canvas?.clientWidth || window.innerWidth;
    const dpr = Math.min(TIERS[tier].dprCap, window.devicePixelRatio || 1);
    const size = menu ? 800 : wantedSize(width, dpr, TIERS[tier].art);
    void loadArt(biome, { size, neighbors: !menu, unlocked: useGame.getState().ub });
  }, [biome, tier, menu]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    let last = performance.now();
    let frameNo = 0;
    let gov = { lowFor: 0 };
    const meter = new FpsMeter();
    const hidden = () => document.hidden || document.visibilityState === "hidden";
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const st = useGame.getState();
      frameNo++;
      if (shouldSkipFrame(st.tier, now - sim.lastInput, st.phase, frameNo)) return;
      const real = (now - last) / 1000;
      last = now;
      const dt = Math.min(0.05, real);
      frame(dt);
      paint(canvas, { ...view.current, dt });
      meter.push(Math.min(0.25, real));
      const step = governorStep(gov, {
        fps: meter.fps,
        dt: real,
        ready: meter.full,
        pinned: st.gfx !== "auto",
        tier: st.tier,
      });
      gov = step.gov;
      if (step.down) {
        meter.reset();
        useGame.setState({ tier: step.down });
        useGame.getState().notify(LIGHTER);
      }
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      if (!hidden()) raf = requestAnimationFrame(loop);
    };
    /* A hidden tab runs nothing at all; coming back gets one capped dt, no catch-up. */
    const onVisibility = () => {
      if (hidden()) cancelAnimationFrame(raf);
      else start();
    };
    const touch = () => {
      sim.lastInput = performance.now();
    };
    sim.lastInput = performance.now();
    start();
    /* Lifting the finger anywhere gives line, even if it slid off the water. */
    window.addEventListener("pointerup", reelUp);
    window.addEventListener("pointercancel", reelUp);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerup", reelUp);
      window.removeEventListener("pointercancel", reelUp);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, []);

  return (
    <div
      ref={box}
      className={cn(
        "touch-manipulation select-none overflow-hidden",
        !menu && idle && "cursor-pointer",
        className,
      )}
      onPointerDown={
        menu
          ? undefined
          : (e) => {
              /* Aim first: a tap on a spot's ring picks that spot, then the tap does its usual job. */
              const st = useGame.getState();
              if (st.phase === "idle") {
                const r = e.currentTarget.getBoundingClientRect();
                const spot = nearestSpot(st.biome, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r.width, r.height, big);
                if (spot) st.setSpot(spot.id);
              }
              /* In the fight, press and hold anywhere on the water is the reel (09 §3.1). */
              if (st.phase === "reel") {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                reelDown();
              } else if (onWater) onWater();
              else act();
            }
      }
      onPointerMove={(e) => {
        if (menu || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        sim.hover = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      }}
      onPointerLeave={() => {
        sim.hover = null;
      }}
    >
      <canvas ref={ref} data-stage={menu ? undefined : ""} className="absolute inset-0 h-full w-full touch-none" />
      {children}
    </div>
  );
}

/** The time-of-day window the fish are feeding in, kept fresh once a minute. */
function useWindow() {
  const weather = useGame((s) => s.weather);
  const follow = useGame((s) => s.followClock);
  const trip = useGame((s) => s.trip);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return windowFor({ trip, followClock: follow, weather }, now);
}

export function StageChips({ className, style }: { className?: string; style?: CSSProperties }) {
  const biome = useGame((s) => s.biome);
  const weather = useGame((s) => s.weather);
  const frenzy = useGame((s) => s.frenzyLeft);
  const stage = useGame((s) => stageOf(s.dex, s.biome));
  const lair = useGame((s) => s.lair);
  const boss = useGame((s) => biomeSpeciesCaught(s.dex, s.biome));
  const slot = useWindow();
  const inCreel = useGame((s) => (MODES[s.mode].trips && s.trip ? s.inv : null));
  return (
    <div style={style} className={cn("pointer-events-none flex flex-wrap gap-1.5", className)}>
      <Chip>{WEATHER[weather].name}</Chip>
      <Chip>{WINDOW_INFO[slot].label}</Chip>
      <Chip>{BIOMES[biome].name}</Chip>
      <Chip>{lair ? "Boss Lair" : STAGE_NAMES[stage]}</Chip>
      <Chip>
        {BIOMES[biome].fish[BOSS_INDEX]} {boss}/{BOSS_INDEX}
      </Chip>
      {inCreel ? <Chip>{creelLine(inCreel.length, inCreel.reduce((n, f) => n + f.w, 0))}</Chip> : null}
      {frenzy > 0 ? <Chip brass>Frenzy {Math.ceil(frenzy)}s</Chip> : null}
    </div>
  );
}

function Chip({ children, brass }: { children: ReactNode; brass?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border border-line bg-bg/70 px-2.5 py-1 text-xs backdrop-blur-sm",
        brass ? "text-brass" : "text-fg",
      )}
    >
      {children}
    </span>
  );
}
