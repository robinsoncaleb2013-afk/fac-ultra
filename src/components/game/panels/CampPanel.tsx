import { Flame, Hammer, Moon, Trees } from "lucide-react";
import { useGame } from "@/game/engine";
import {
  clockOf,
  clockText,
  craftBlock,
  forecastFor,
  HOOK_NAMES,
  hourOf,
  isForcedCamp,
  LINE_NAMES,
  mealInfo,
  RECIPES,
  SHELTER_NAMES,
  SLEEP_HOUR,
  WAKE_HOUR,
  type LarderItem,
  type SurvivalRun,
} from "@/game/survival";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Flame;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-3">
      <h3 className="flex items-center gap-2 font-serif text-lg">
        {Icon ? <Icon className="size-4 text-brass" aria-hidden /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Pile({ k, v }: { k: string; v: number }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-1.5 text-center">
      <p className="text-xs text-muted">{k}</p>
      <p className="font-serif text-lg leading-tight">{v}</p>
    </div>
  );
}

function Fish({ f, i, run }: { f: LarderItem; i: number; run: SurvivalRun }) {
  const eatFish = useGame((s) => s.campEat);
  const smoke = useGame((s) => s.campSmoke);
  const raw = mealInfo(run, i, "raw");
  const cook = mealInfo(run, i, "cook");
  const left = f.expiresDay - clockOf(run.min).day;
  return (
    <li className="rounded-xl border border-line bg-surface-2/60 p-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm">
          {f.name} <span className="text-muted">· {f.w} lb</span>
        </p>
        <span
          className={cn(
            "shrink-0 text-xs",
            f.smoked ? "text-lagoon" : left <= 0 ? "text-[#e4572e]" : "text-muted",
          )}
        >
          {f.smoked ? "Smoked" : left <= 0 ? "Eat today" : "Fresh"}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {f.smoked ? (
          <Button className="min-h-11 px-3 py-2 text-sm" onClick={() => eatFish(i, "raw")}>
            Eat (+{raw.gain})
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              className="min-h-11 px-3 py-2 text-sm"
              onClick={() => eatFish(i, "raw")}
            >
              Eat raw (+{raw.gain})
            </Button>
            <Button
              className="min-h-11 px-3 py-2 text-sm"
              disabled={!cook.ok}
              onClick={() => eatFish(i, "cook")}
            >
              Cook (+{cook.gain})
            </Button>
            {run.camp.smoker ? (
              <Button
                variant="ghost"
                className="min-h-11 px-3 py-2 text-sm"
                disabled={run.camp.fire <= 0}
                onClick={() => smoke(i)}
              >
                Smoke
              </Button>
            ) : null}
          </>
        )}
      </div>
      {!f.smoked ? (
        <p className="mt-1 text-xs text-muted">
          Raw fish can be bad now and then. Cooked is safe and fills you more
          {cook.ok ? "" : " (light the fire first)"}.
        </p>
      ) : null}
    </li>
  );
}

/** The camp (05 §5.3): the larder, the fire, crafting, sleep, and the last things that happened. */
export function CampPanel() {
  const run = useGame((s) => s.survival);
  const log = useGame((s) => s.campLog);
  const gather = useGame((s) => s.campGather);
  const sleepNow = useGame((s) => s.campSleep);
  const make = useGame((s) => s.campCraft);
  const busy = useGame((s) => s.phase !== "idle");
  if (!run) return <p className="text-sm text-muted">Start a run to set up camp.</p>;
  const f = forecastFor(run);
  const h = hourOf(run.min);
  const canSleep = h >= SLEEP_HOUR || h < WAKE_HOUR;
  const dark = isForcedCamp(run);
  const fireHours = Math.ceil(run.camp.fire / 60);
  return (
    <div className="flex flex-col gap-3">
      <Card title="Camp" icon={Trees}>
        <p className="text-sm text-muted">
          Day {clockOf(run.min).day} · {clockText(run.min)} · {SHELTER_NAMES[run.camp.shelter]} ·{" "}
          {HOOK_NAMES[run.gear.hook]} · {LINE_NAMES[run.gear.line]}
        </p>
        {f ? <p className="mt-1 text-sm text-brass">{f.text}</p> : null}
        {busy ? (
          <p className="mt-1 text-sm text-brass">Finish the fish on your line first.</p>
        ) : null}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Pile k="Driftwood" v={run.camp.driftwood} />
          <Pile k="Bone" v={run.camp.bone} />
          <Pile k="Gut" v={run.camp.gut} />
        </div>
      </Card>

      <Card title="Larder">
        {run.larder.length === 0 ? (
          <p className="mt-1 text-sm text-muted">
            Empty. Fish you catch are kept here. Eat before you get too hungry.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {run.larder.map((item, i) => (
              <Fish key={`${item.name}-${i}-${item.w}`} f={item} i={i} run={run} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Fire" icon={Flame}>
        <p className="mt-1 text-sm text-muted">
          {run.camp.fire > 0
            ? `The fire is lit. About ${fireHours} ${fireHours === 1 ? "hour" : "hours"} of wood in it. A fire keeps you warm and cooks fish.`
            : "The fire is out. A fire keeps you warm and cooks fish. Each log burns for an hour."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button className="min-h-11 flex-1" disabled={run.camp.driftwood < 1} onClick={log}>
            {run.camp.fire > 0 ? "Add a log" : "Light the fire"}
          </Button>
          <Button variant="ghost" className="min-h-11 flex-1" disabled={dark} onClick={gather}>
            Look for driftwood
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted">
          Driftwood washes up each morning, and twice as much after a storm.
        </p>
      </Card>

      <Card title="Make things" icon={Hammer}>
        <ul className="mt-2 flex flex-col gap-2">
          {RECIPES.map((r) => {
            const why = craftBlock(run, r.id);
            const cost = Object.entries(r.cost)
              .map(([k, n]) => `${n} ${k}`)
              .join(", ");
            return (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{r.name}</p>
                  <p className="text-xs text-muted">{r.blurb}</p>
                  <p className="text-xs text-muted">{why ?? `Costs ${cost}.`}</p>
                </div>
                <Button
                  variant="ghost"
                  className="min-h-11 shrink-0 px-3 py-2 text-sm"
                  disabled={!!why}
                  onClick={() => make(r.id)}
                >
                  Make
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Sleep" icon={Moon}>
        <p className="mt-1 text-sm text-muted">
          {dark
            ? "It is too dark to fish. Sleep until morning."
            : canSleep
              ? "Sleep until morning. Eat and warm up first: you get hungry and cold while you sleep."
              : "You are not tired yet. You can sleep from 5 pm."}
        </p>
        <Button className="mt-2 min-h-11 w-full" disabled={!canSleep} onClick={sleepNow}>
          Sleep until morning
        </Button>
      </Card>

      <Card title="What happened">
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
          {[...run.log]
            .reverse()
            .slice(0, 8)
            .map((line, i) => (
              <li key={`${run.log.length}-${i}`} className={i === 0 ? "text-fg" : undefined}>
                {line}
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
