import { useState } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  Drumstick,
  Flame,
  Moon,
  Sun,
  Tent,
} from "lucide-react";
import { BIOMES, WEATHER } from "@/game/content";
import { useGame } from "@/game/engine";
import {
  ARCTIC,
  bestRun,
  clockOf,
  clockText,
  daysSurvived,
  forecastFor,
  hourOf,
  isNight,
  localDate,
  partOfDay,
  SURVIVAL_WATERS,
  vitalWord,
  WATER_BLURB,
  WIN_DAY,
  type RunSummary,
} from "@/game/survival";
import { Button } from "@/components/ui/button";
import { ArtThumb } from "@/components/game/panels/shared";
import { Chip, Sheet } from "@/components/game/trips";
import { useKidOn, useRules } from "@/components/game/use-kid";
import { cn } from "@/lib/cn";

const SKY = [Sun, CloudRain, CloudLightning, CloudFog] as const;

/** A round meter: the ring fills with how well you are doing. The word is always there for screen readers;
    the number only shows on hover and only when Kid Mode is off (05 §5.3). */
function Radial({
  value,
  kind,
  kid,
  compact,
}: {
  value: number;
  kind: "hunger" | "warmth";
  kid: boolean;
  compact?: boolean;
}) {
  const word = vitalWord(kind, value);
  const Icon = kind === "hunger" ? Drumstick : Flame;
  const size = compact ? 36 : 44;
  const r = 15;
  const c = 2 * Math.PI * r;
  const low = value < 25;
  const tone = value < 15 ? "text-[#e4572e]" : value < 40 ? "text-brass" : "text-lagoon";
  return (
    <span
      role="img"
      aria-label={`${kind === "hunger" ? "Food" : "Warmth"}: ${word}`}
      title={kid ? word : `${word} (${Math.round(value)} of 100)`}
      className={cn("relative inline-grid place-items-center", low && "motion-safe:animate-pulse")}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 36 36" width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="rgba(0,0,0,0.45)"
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth="3.5"
          className={tone}
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value / 100)))}
          className={cn(
            tone,
            "transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none",
          )}
        />
      </svg>
      <Icon className={cn("absolute", compact ? "size-3.5" : "size-4", tone)} aria-hidden />
    </span>
  );
}

/** The Survival HUD: food, warmth, the day, the time and the sky (it replaces money and level). */
export function SurvivalHud({ compact }: { compact?: boolean }) {
  const run = useGame((s) => s.survival);
  const kid = useKidOn();
  if (!run) return <p className="text-sm text-fg/90">Pick a water to begin</p>;
  const { day } = clockOf(run.min);
  const Sky = isNight(hourOf(run.min)) ? Moon : (SKY[run.weather] ?? Cloud);
  const lit = run.camp.fire > 0;
  return (
    <div className="pointer-events-auto flex items-center gap-2.5" aria-label="Survival status">
      <Radial value={run.hunger} kind="hunger" kid={kid} compact={compact} />
      <Radial value={run.warmth} kind="warmth" kid={kid} compact={compact} />
      <div className="leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
        <p className={cn("font-serif text-fg", compact ? "text-base" : "text-xl")}>Day {day}</p>
        <p className="flex items-center gap-1 text-xs text-fg/90">
          <Sky className="size-3.5" aria-hidden /> {clockText(run.min)}
          {lit ? <Flame className="size-3.5 text-brass" aria-label="Fire is lit" /> : null}
        </p>
      </div>
    </div>
  );
}

/** "Pick where to start": a water, and today's daily challenge or a free run. */
export function SurvivalStart() {
  const rules = useRules();
  const screen = useGame((s) => s.screen);
  const run = useGame((s) => s.survival);
  const hydrated = useGame((s) => s.hydrated);
  const tab = useGame((s) => s.tab);
  const meta = useGame((s) => s.sMeta);
  const begin = useGame((s) => s.beginRun);
  const setScreen = useGame((s) => s.setScreen);
  const [water, setWater] = useState<number | null>(null);
  const [daily, setDaily] = useState(true);
  if (!rules.survival || screen !== "game" || run || !hydrated || tab === "lodge") return null;
  const pick = water ?? meta.lastWater;
  const best = bestRun(meta.history);
  const date = new Date();
  return (
    <Sheet label="Start a survival run">
      <h2 className="font-serif text-2xl">Survival</h2>
      <p className="mt-1 text-sm text-muted">
        You wash up with a hand line and nothing else. Catch fish to eat, keep warm, and last as
        many days as you can. If you last {WIN_DAY - 1} days, a boat finds you.
      </p>
      {best ? (
        <p className="mt-2 text-sm text-brass">
          Your best: {best.days} {best.days === 1 ? "day" : "days"} on the {BIOMES[best.water].name}
          .
        </p>
      ) : null}
      <p className="mt-4 text-sm text-muted">Where</p>
      <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {SURVIVAL_WATERS.map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={pick === b}
            onClick={() => setWater(b)}
            className={cn(
              "flex min-h-14 items-center gap-2 rounded-2xl border p-1.5 text-left",
              pick === b ? "border-brass bg-surface-2" : "border-line bg-surface",
            )}
          >
            <ArtThumb id={BIOMES[b].id} className="size-11 shrink-0 rounded-xl object-cover" />
            <span className="min-w-0">
              <span className="block font-serif leading-tight">{BIOMES[b].name}</span>
              <span
                className={cn(
                  "block text-xs leading-tight",
                  b === ARCTIC ? "text-[#e4572e]" : "text-muted",
                )}
              >
                {WATER_BLURB[b]}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">Which run</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <Chip on={daily} onClick={() => setDaily(true)}>
          Daily challenge
        </Chip>
        <Chip on={!daily} onClick={() => setDaily(false)}>
          Free run
        </Chip>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {daily
          ? `Today is ${date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}. Everyone who plays today's ${BIOMES[pick].name} gets the same sky and the same fish (${localDate(date)}).`
          : "Your own sky and your own fish. It does not count for the daily challenge."}
      </p>
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 flex gap-2 bg-surface px-5 pt-2 pb-5">
        <Button className="flex-1" onClick={() => begin(pick, daily)}>
          Start the run
        </Button>
        <Button variant="ghost" onClick={() => setScreen("menu")}>
          Back
        </Button>
      </div>
    </Sheet>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 px-2 py-2 text-center">
      <p className="text-xs text-muted">{k}</p>
      <p className="font-serif text-lg leading-tight">{v}</p>
    </div>
  );
}

/** The end of a run: how it went, in plain words, and what to do next (05 §5.3). */
export function SurvivalEnd() {
  const rules = useRules();
  const run = useGame((s) => s.survival);
  const screen = useGame((s) => s.screen);
  const retry = useGame((s) => s.retryRun);
  const leave = useGame((s) => s.leaveRun);
  const keep = useGame((s) => s.continueRun);
  const setScreen = useGame((s) => s.setScreen);
  if (!rules.survival || screen !== "game" || !run?.over) return null;
  const won = run.over.kind === "won";
  return (
    <Sheet label={won ? "Rescued" : "The run is over"}>
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brass uppercase">
        <Tent className="size-4" aria-hidden /> {run.daily ? "Daily challenge" : "Free run"} ·{" "}
        {BIOMES[run.water].name}
      </p>
      <h2 className="mt-1 font-serif text-2xl">{won ? "Rescued!" : "Your run is over"}</h2>
      <p className="mt-2 text-sm">{run.over.cause}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Fact k="Days survived" v={String(daysSurvived(run))} />
        <Fact k="Fish caught" v={String(run.fish)} />
        <Fact k="Fish eaten" v={String(run.eaten)} />
        <Fact k="Biggest fish" v={run.biggest ? `${run.biggest.w} lb` : "none"} />
      </div>
      {run.biggest ? (
        <p className="mt-2 text-center text-xs text-muted">{run.biggest.name}</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2">
        {won ? (
          <>
            <Button onClick={keep}>Keep going</Button>
            <Button variant="ghost" onClick={leave}>
              I am done. New run
            </Button>
          </>
        ) : (
          <>
            <Button onClick={retry}>Try again (same sky)</Button>
            <Button variant="ghost" onClick={leave}>
              New run
            </Button>
          </>
        )}
        <Button variant="quiet" onClick={() => setScreen("menu")}>
          Main menu
        </Button>
      </div>
    </Sheet>
  );
}

/** The Cast tab in Survival: where you stand, tomorrow's sky, and a way into camp. */
export function SurvivalCastCard() {
  const run = useGame((s) => s.survival);
  const setTab = useGame((s) => s.setTab);
  const kid = useKidOn();
  if (!run) return null;
  const f = forecastFor(run);
  const { day } = clockOf(run.min);
  return (
    <section className="rounded-2xl border border-line bg-surface p-3" aria-label="Where you are">
      <p className="text-xs text-muted">
        {BIOMES[run.water].name} · {partOfDay(run.min)}
      </p>
      <h3 className="font-serif text-lg leading-tight">
        Day {day} · {clockText(run.min)}
      </h3>
      <p className="text-sm text-muted">
        {WEATHER[run.weather].name} now.{" "}
        {kid ? vitalWord("hunger", run.hunger) : `${vitalWord("hunger", run.hunger)} food`} ·{" "}
        {vitalWord("warmth", run.warmth).toLowerCase()}
      </p>
      {f ? <p className="mt-1 text-sm text-brass">{f.text}</p> : null}
      <p className="mt-1 text-sm">
        {run.larder.length
          ? `${run.larder.length} ${run.larder.length === 1 ? "fish" : "fish"} in the larder.`
          : "The larder is empty. Catch a fish!"}{" "}
        {run.camp.fire > 0 ? "The fire is lit." : ""}
      </p>
      <Button variant="ghost" className="mt-2 min-h-11 w-full" onClick={() => setTab("camp")}>
        Go to camp
      </Button>
    </section>
  );
}

function when(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function RunRow({ r }: { r: RunSummary }) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-3">
      <p className="font-serif leading-tight">
        {r.days} {r.days === 1 ? "day" : "days"} · {BIOMES[r.water].name}
        {r.won ? " · Rescued" : ""}
      </p>
      <p className="text-xs text-muted">
        {r.daily ? `Daily challenge, ${when(r.date)}` : `Free run, ${when(r.date)}`}
      </p>
      <p className="mt-1 text-sm">
        {r.fish} caught · {r.eaten} eaten{r.biggest ? ` · biggest ${r.biggest} lb` : ""}
      </p>
      {r.cause ? <p className="text-xs text-muted">{r.cause}</p> : null}
    </li>
  );
}

/** Lodge → Runs: every finished run, newest first, and the best one on top. */
export function RunsLog() {
  const meta = useGame((s) => s.sMeta);
  const run = useGame((s) => s.survival);
  const best = bestRun(meta.history);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-serif text-xl">Your runs</p>
      {run && !run.over ? (
        <div className="rounded-2xl border border-brass bg-surface p-3">
          <p className="text-xs font-semibold tracking-wide text-brass uppercase">On now</p>
          <p className="font-serif leading-tight">
            Day {clockOf(run.min).day} · {BIOMES[run.water].name}
          </p>
          <p className="text-sm">
            {run.fish} caught · {run.eaten} eaten
          </p>
        </div>
      ) : null}
      {best ? (
        <p className="text-sm text-brass">
          Longest run: {best.days} days, {BIOMES[best.water].name}.
        </p>
      ) : null}
      {meta.history.length === 0 ? (
        <p className="text-sm text-muted">Nothing here yet. Every run you finish is saved here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {meta.history.map((r, i) => (
            <RunRow key={`${r.date}-${i}`} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
