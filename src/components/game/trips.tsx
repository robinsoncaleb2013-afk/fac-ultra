import { useState } from "react";
import { BookOpen, Flag } from "lucide-react";
import { BIOMES, WEATHER } from "@/game/content";
import { useGame } from "@/game/engine";
import { WINDOWS, WINDOW_INFO } from "@/game/presentation";
import {
  creelLine,
  PICKABLE_WEATHER,
  tripHeadline,
  tripTitle,
  type Trip,
  type TripWindow,
} from "@/game/trips";
import { Button } from "@/components/ui/button";
import { useRules } from "@/components/game/use-kid";
import { cn } from "@/lib/cn";

function Chip({ on, children, onClick }: { on: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-3 text-sm",
        on ? "border-brass bg-brass text-brass-ink" : "border-line bg-surface-2 text-muted",
      )}
    >
      {children}
    </button>
  );
}

function Sheet({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-3">
      <div
        role="dialog"
        aria-label={label}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-brass bg-surface p-5"
      >
        {children}
      </div>
    </div>
  );
}

/** "Plan your trip": shown in Recreational whenever there is no trip going. */
export function TripStart() {
  const rules = useRules();
  const screen = useGame((s) => s.screen);
  const trip = useGame((s) => s.trip);
  const card = useGame((s) => s.tripCard);
  const hydrated = useGame((s) => s.hydrated);
  const tab = useGame((s) => s.tab);
  const biome = useGame((s) => s.biome);
  const begin = useGame((s) => s.beginTrip);
  const setScreen = useGame((s) => s.setScreen);
  const [water, setWater] = useState<number | null>(null);
  const [when, setWhen] = useState<TripWindow>("clock");
  const [weather, setWeather] = useState(-1);
  /* The Lodge (Logbook, Settings) can be browsed between trips; the sheet comes back on the next tab. */
  if (!rules.trips || screen !== "game" || trip || card || !hydrated || tab === "lodge") return null;
  const pick = water ?? biome;
  return (
    <Sheet label="Plan your trip">
      <h2 className="font-serif text-2xl">Plan your trip</h2>
      <p className="mt-1 text-sm text-muted">Pick where to fish, when, and what the sky is doing.</p>
      <label className="mt-4 block text-sm text-muted" htmlFor="trip-water">
        Where
      </label>
      <select
        id="trip-water"
        value={pick}
        onChange={(e) => setWater(Number(e.target.value))}
        className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-fg"
      >
        {BIOMES.map((b, i) => (
          <option key={b.id} value={i}>
            {b.name}
          </option>
        ))}
      </select>
      <p className="mt-4 text-sm text-muted">When</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <Chip on={when === "clock"} onClick={() => setWhen("clock")}>
          Real time
        </Chip>
        {WINDOWS.map((w) => (
          <Chip key={w} on={when === w} onClick={() => setWhen(w)}>
            {WINDOW_INFO[w].label}
          </Chip>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">Weather</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <Chip on={weather === -1} onClick={() => setWeather(-1)}>
          Whatever comes
        </Chip>
        {PICKABLE_WEATHER.map((w) => (
          <Chip key={w} on={weather === w} onClick={() => setWeather(w)}>
            {WEATHER[w].name}
          </Chip>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 flex gap-2 bg-surface px-5 pt-2 pb-5">
        <Button className="flex-1" onClick={() => begin(pick, when, weather)}>
          Start fishing
        </Button>
        <Button variant="ghost" onClick={() => setScreen("menu")}>
          Back
        </Button>
      </div>
    </Sheet>
  );
}

/** The trip card: what you caught, what was new, and what is in the creel before it empties. */
export function TripCard() {
  const card = useGame((s) => s.tripCard);
  const dismiss = useGame((s) => s.dismissTripCard);
  const setScreen = useGame((s) => s.setScreen);
  const setLodgeView = useGame((s) => s.setLodgeView);
  if (!card) return null;
  const t = card.trip;
  return (
    <Sheet label="Trip card">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brass uppercase">
        <Flag className="size-4" aria-hidden /> Trip card
      </p>
      <h2 className="mt-1 font-serif text-2xl">{tripTitle(t)}</h2>
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {card.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {t.fresh.length ? (
        <p className="mt-3 text-sm">
          <span className="text-muted">New to you: </span>
          {t.fresh.join(", ")}
        </p>
      ) : null}
      {t.recs.length ? (
        <p className="mt-1 text-sm">
          <span className="text-muted">Personal bests: </span>
          {t.recs.join(", ")}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted">The creel is emptied and this trip is saved in your Logbook.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button className="col-span-2" onClick={dismiss}>
          Plan another trip
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            dismiss();
            setLodgeView("logbook");
          }}
        >
          Logbook
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            dismiss();
            setScreen("menu");
          }}
        >
          Menu
        </Button>
      </div>
    </Sheet>
  );
}

/** On the Cast tab in Recreational: this trip so far, the creel, and a way to pack up. */
export function TripBar() {
  const rules = useRules();
  const trip = useGame((s) => s.trip);
  const inv = useGame((s) => s.inv);
  const phase = useGame((s) => s.phase);
  const end = useGame((s) => s.endTrip);
  if (!rules.trips || !trip) return null;
  const lb = inv.reduce((n, f) => n + f.w, 0);
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="font-serif text-lg leading-tight">{tripTitle(trip)}</p>
      <p className="mt-1 text-sm text-muted">{creelLine(inv.length, lb)}</p>
      <Button variant="ghost" className="mt-2 min-h-11 w-full" disabled={phase !== "idle"} onClick={end}>
        End trip
      </Button>
    </div>
  );
}

function when(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TripRow({ trip }: { trip: Trip }) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-3">
      <p className="font-serif leading-tight">{tripTitle(trip)}</p>
      <p className="text-xs text-muted">{when(trip.start)}</p>
      <p className="mt-1 text-sm">{tripHeadline(trip)}</p>
    </li>
  );
}

/** Lodge → Logbook: every finished trip (the last 50), newest first. */
export function Logbook() {
  const trips = useGame((s) => s.trips);
  const trip = useGame((s) => s.trip);
  const inv = useGame((s) => s.inv);
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 font-serif text-xl">
        <BookOpen className="size-5 text-brass" aria-hidden /> Logbook
      </p>
      {trip ? (
        <div className="rounded-2xl border border-brass bg-surface p-3">
          <p className="text-xs font-semibold tracking-wide text-brass uppercase">On now</p>
          <p className="font-serif leading-tight">{tripTitle(trip)}</p>
          <p className="mt-1 text-sm">{tripHeadline(trip)}</p>
          <p className="text-sm text-muted">{creelLine(inv.length, inv.reduce((n, f) => n + f.w, 0))}</p>
        </div>
      ) : null}
      {trips.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing here yet. Every trip you finish goes in the logbook, so you can look back at the day you caught that
          big one.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {trips.map((t) => (
            <TripRow key={t.start} trip={t} />
          ))}
        </ul>
      )}
    </div>
  );
}
