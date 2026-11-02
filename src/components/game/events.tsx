/* The long-play events on screen (docs/architecture/11): the announcement banner, the countdown chip and the Lodge's
   "Events" list. The rules live in src/game/events.ts; these only read state. */

import { useEffect, useState } from "react";
import { useGame } from "@/game/engine";
import { activeEvent, countdown, eventOfMutation, effectLine, eventModeOn, EVENT_RARITIES, EVENTS, eventTitle, mutationOfEvent, mutationTitle, nextChanceHint, requirementLine, type EventDef } from "@/game/events";
import { MODES } from "@/game/modes";
import { useKidOn } from "@/components/game/use-kid";
import { useMutationText } from "@/components/game/use-mutation";
import { useTick } from "@/components/game/use-tick";
import { FishPortrait } from "@/components/game/portrait";
import { cn } from "@/lib/cn";

const BANNER_MS = 9000;

const hue = (e: EventDef, a = 1) => `hsl(${e.look.hue} ${e.look.sat}% ${Math.max(45, e.look.light)}% / ${a})`;

/** The corner chip (always there while an event runs) and the announcement banner (first few seconds). */
export function EventLayer({ className }: { className?: string }) {
  const events = useGame((s) => s.events);
  const banner = useGame((s) => s.eventBanner);
  const dismiss = useGame((s) => s.dismissEventBanner);
  const motion = useGame((s) => s.motion);
  const kid = useKidOn();
  useTick(1000);
  const act = activeEvent(events, Date.now());
  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(dismiss, BANNER_MS);
    return () => window.clearTimeout(t);
  }, [banner, dismiss]);
  if (!act) return null;
  const { def, leftMs } = act;
  const r = EVENT_RARITIES[def.rarity];
  const showBanner = banner?.id === def.id;
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-2 px-4", className)}>
      {showBanner ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="event-banner"
          className={cn("pointer-events-auto max-w-md rounded-2xl border-2 bg-surface/95 px-4 py-3 text-center shadow-2xl backdrop-blur", motion && "fac-rise")}
          style={{ borderColor: hue(def) }}
          onClick={dismiss}
        >
          <p className={cn("text-xs font-semibold tracking-wide uppercase", r.tone)}>
            <span aria-hidden>{def.look.glyph} </span>
            {r.name} event
          </p>
          <p className="font-serif text-2xl leading-tight">{eventTitle(def, kid)}</p>
          <p className="text-sm text-muted">{def.announce}</p>
          <p className="mt-1 text-sm font-semibold">{effectLine(def, kid)} on some fish</p>
        </div>
      ) : null}
      <div
        data-testid="event-chip"
        className="pointer-events-auto flex items-center gap-2 rounded-full border bg-black/55 px-3 py-1 text-sm text-[#fff4d6] backdrop-blur-sm"
        style={{ borderColor: hue(def) }}
        title={`${effectLine(def, kid)} on some fish`}
      >
        <span aria-hidden style={{ color: hue(def) }}>
          {def.look.glyph}
        </span>
        <span className="font-serif">{eventTitle(def, kid)}</span>
        <span className="tabular-nums" aria-label={`${countdown(leftMs)} left`}>
          {countdown(leftMs)}
        </span>
      </div>
    </div>
  );
}

/** A small preview fish wearing the event's mutation (a plain dark silhouette until the event has been seen). */
function Preview({ e, seen, className }: { e: EventDef; seen: boolean; className?: string }) {
  return (
    <span className={cn("block", className)}>
      <FishPortrait biome={0} species={9} rarity={2} mutation={seen ? mutationOfEvent(e) : 0} className={cn("size-full", !seen && "opacity-40 brightness-0")} />
    </span>
  );
}

/** The Lodge's Events list: every event, its rarity, hours needed, mutation and effect. Locked until first seen. */
export function EventsView() {
  const events = useGame((s) => s.events);
  const mode = useGame((s) => s.mode);
  const kid = useKidOn();
  const [picked, setPicked] = useState<string>(EVENTS[0].id);
  useTick(5000);
  const on = eventModeOn(MODES[mode]);
  const cur = EVENTS.find((e) => e.id === picked) ?? EVENTS[0];
  const seenOf = (e: EventDef) => (events.seen[e.id] ?? 0) > 0;
  const hint = on ? nextChanceHint(events, Date.now()) : null;
  const hours = Math.floor(events.streakMs / 3_600_000);
  const mins = Math.floor((events.streakMs % 3_600_000) / 60_000);
  const seen = seenOf(cur);
  return (
    <div data-testid="events-view" className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="md:col-span-2">
        {on ? (
          <p className="text-sm text-muted">
            Events are rare. They only happen after you have been fishing for a long time without a long break. Your streak right now:{" "}
            <b className="text-fg">
              {hours} h {mins} min
            </b>
            . {hint ?? "A short break is fine. A long one ends the streak."}
          </p>
        ) : (
          <p className="text-sm text-muted">There are no events in this mode.</p>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2" aria-label="All events">
        {EVENTS.map((e) => {
          const s = seenOf(e);
          const r = EVENT_RARITIES[e.rarity];
          return (
            <li key={e.id}>
              <button
                type="button"
                data-testid={`event-${e.id}`}
                data-seen={s ? "1" : "0"}
                onPointerEnter={(ev) => ev.pointerType === "mouse" && setPicked(e.id)}
                onFocus={() => setPicked(e.id)}
                onClick={() => setPicked(e.id)}
                aria-pressed={picked === e.id}
                className={cn("flex min-h-11 w-full items-center gap-2 rounded-xl border bg-surface-2 p-2 text-left hover:border-brass", picked === e.id ? "border-brass" : "border-line")}
              >
                <Preview e={e} seen={s} className="size-12 shrink-0" />
                <span className="min-w-0">
                  <span className={cn("block text-[11px] font-semibold tracking-wide uppercase", r.tone)}>
                    {r.name} · {e.hours} {e.hours === 1 ? "hr" : "hrs"}
                  </span>
                  <span className="block truncate font-serif text-base leading-tight">{s ? eventTitle(e, kid) : "Not seen yet"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <section aria-live="polite" data-testid="event-detail" className="rounded-2xl border border-line bg-surface-2 p-4">
        <Preview e={cur} seen={seen} className="mx-auto mb-2 h-28 w-40" />
        <p className={cn("text-xs font-semibold tracking-wide uppercase", EVENT_RARITIES[cur.rarity].tone)}>{EVENT_RARITIES[cur.rarity].name} event</p>
        <h3 className="font-serif text-2xl leading-tight">{seen ? eventTitle(cur, kid) : "A secret event"}</h3>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">Needs</dt>
          <dd>{requirementLine(cur)}</dd>
          <dt className="text-muted">Fish become</dt>
          <dd>{seen ? mutationTitle(cur, kid) : "???"}</dd>
          <dt className="text-muted">What it does</dt>
          <dd>{seen ? effectLine(cur, kid) : `${EVENT_RARITIES[cur.rarity].mult}x boost on some fish`}</dd>
          <dt className="text-muted">Times seen</dt>
          <dd>{events.seen[cur.id] ?? 0}</dd>
          <dt className="text-muted">Mutated fish</dt>
          <dd>{events.fish[cur.id] ?? 0}</dd>
        </dl>
        <p className="mt-2 text-sm text-muted">{seen ? cur.blurb : "Keep fishing to find out. It lasts only a few minutes when it comes."}</p>
      </section>
    </div>
  );
}

/** The "Starlight! 2x XP" line under a catch's name; nothing for an ordinary fish. */
export function CatchEventLine({ mutation, className }: { mutation: number; className?: string }) {
  const { line } = useMutationText();
  const text = line(mutation);
  const e = eventOfMutation(mutation);
  if (!text || !e) return null;
  return (
    <p data-testid="catch-event-line" className={cn("text-sm font-semibold", className)} style={{ color: hue(e) }}>
      <span aria-hidden>{e.look.glyph} </span>
      {text}
    </p>
  );
}
