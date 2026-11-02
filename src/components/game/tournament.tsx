import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, Trophy } from "lucide-react";
import { BIOMES } from "@/game/content";
import { tourneyScore, useGame } from "@/game/engine";
import { FAMILIES, FAMILY_INFO } from "@/game/presentation";
import { CATEGORY_INFO, scoreLabel } from "@/game/scoring";
import {
  api,
  cantCast,
  castsLeft,
  clock,
  msToClose,
  playerId,
  playerName,
  savePlayerName,
  secondsLeft,
  type BoardReply,
  type BoardRow,
  type EventInfo,
  type TourneyRun,
} from "@/game/tourney";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Re-render about once a second (countdowns). */
function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((n) => n + 1), ms);
    return () => window.clearInterval(t);
  }, [ms]);
}

/* ── The event list over the menu ─────────────────────────────────────────── */

const kindName: Record<EventInfo["kind"], string> = {
  quick: "Quick",
  daily: "Daily",
  weekly: "Weekly",
  private: "Private",
  survival: "Survival",
};

type Load = { state: "loading" } | { state: "error"; text: string } | { state: "ready"; events: EventInfo[]; offset: number };

/** Pick an event, join it, travel to its water. Open from the Tournaments card on the menu. */
export function TournamentLobby() {
  const open = useGame((s) => s.lobby);
  const close = useGame((s) => s.closeLobby);
  const enter = useGame((s) => s.enterEvent);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [name, setName] = useState(() => playerName());
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [code, setCode] = useState("");
  const [making, setMaking] = useState(false);
  const [water, setWater] = useState(0);
  const [category, setCategory] = useState<"big" | "total" | "sprint" | "value">("total");
  const [minutes, setMinutes] = useState(15);
  useTick();

  const refresh = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const t0 = Date.now();
      const { status, body } = await api.events(playerId());
      const t1 = Date.now();
      if (status !== 200) throw new Error(body.error ?? String(status));
      setLoad({ state: "ready", events: body.events, offset: body.serverNow - (t0 + t1) / 2 });
    } catch {
      setLoad({ state: "error", text: "Couldn't reach the event board. Check your connection and try again." });
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  if (!open) return null;

  const who = name.trim();
  const join = async (eventId: string) => {
    setBusy(eventId);
    setProblem("");
    try {
      if (who) savePlayerName(who);
      const t0 = Date.now();
      const { status, body } = await api.join(eventId, playerId(), who);
      const t1 = Date.now();
      if (status !== 200) {
        setProblem(joinProblem(body.error ?? "", status));
        return;
      }
      enter(body, body.serverNow - (t0 + t1) / 2);
    } catch {
      setProblem("Couldn't join. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const byCode = async () => {
    setProblem("");
    const c = code.trim().toUpperCase();
    if (c.length !== 4) return setProblem("A room code has four letters.");
    const { status, body } = await api.byCode(c);
    if (status !== 200) return setProblem(status === 404 ? "No event has that code." : "That code doesn't look right.");
    await join(body.event.id);
  };

  const create = async () => {
    setProblem("");
    setBusy("create");
    try {
      if (who) savePlayerName(who);
      const { status, body } = await api.create({ playerId: playerId(), name: who, water, category, minutes, castBudget: 40 });
      if (status !== 200) return setProblem(joinProblem(body.error ?? "", status));
      await join(body.event.id);
    } catch {
      setProblem("Couldn't make the event. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const events = load.state === "ready" ? load.events : [];
  const now = Date.now() + (load.state === "ready" ? load.offset : 0);
  const live = events.filter((e) => now >= e.startsAt && now < e.endsAt && e.kind !== "survival");
  const soon = events.filter((e) => now < e.startsAt && e.kind !== "survival");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-3" data-testid="lobby">
      <div role="dialog" aria-label="Tournaments" className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-2xl border border-brass bg-surface">
        <div className="flex items-start justify-between gap-3 p-5 pb-2">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brass uppercase">
              <Trophy className="size-4" aria-hidden /> Tournaments
            </p>
            <h2 className="font-serif text-2xl leading-tight">Pick an event</h2>
            <p className="mt-1 text-sm text-muted">
              Everybody fishes the same water with the same tackle. The server checks every catch.
            </p>
          </div>
          <Button variant="quiet" className="min-h-11 px-3 py-2 text-sm" onClick={close}>
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <label className="mt-2 block text-sm text-muted" htmlFor="tourney-name">
            Your name on the board
          </label>
          <input
            id="tourney-name"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="Angler"
            className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-fg"
          />
          <p className="mt-1 text-xs text-muted">No sign-in yet, so anyone can pick any name.</p>

          {load.state === "loading" ? (
            <p className="mt-4 text-sm text-muted" role="status">
              Finding the water…
            </p>
          ) : null}
          {load.state === "error" ? (
            <div className="mt-4">
              <p className="text-sm text-[#e4572e]" role="alert">
                {load.text}
              </p>
              <Button variant="ghost" className="mt-2" onClick={refresh}>
                Try again
              </Button>
            </div>
          ) : null}
          {problem ? (
            <p className="mt-3 text-sm text-[#e4572e]" role="alert">
              {problem}
            </p>
          ) : null}

          {live.length ? <h3 className="mt-5 font-serif text-lg">On now</h3> : null}
          <ul className="mt-1 flex flex-col gap-2">
            {live.map((e) => (
              <EventRow key={e.id} e={e} now={now} busy={busy === e.id} onJoin={() => join(e.id)} />
            ))}
          </ul>
          {soon.length ? <h3 className="mt-5 font-serif text-lg">Coming up</h3> : null}
          <ul className="mt-1 flex flex-col gap-2">
            {soon.map((e) => (
              <EventRow key={e.id} e={e} now={now} busy={busy === e.id} onJoin={() => join(e.id)} />
            ))}
          </ul>

          <h3 className="mt-5 font-serif text-lg">With friends</h3>
          <p className="text-sm text-muted">Make a private event, or type a friend&apos;s four-letter code.</p>
          <div className="mt-2 flex gap-2">
            <input
              aria-label="Room code"
              value={code}
              maxLength={4}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              className="min-h-11 w-28 rounded-xl border border-line bg-surface-2 px-3 text-center font-serif text-lg tracking-widest text-fg"
            />
            <Button variant="ghost" className="min-h-11 py-2" disabled={code.length !== 4 || !!busy} onClick={byCode}>
              Join with code
            </Button>
            <Button variant="ghost" className="min-h-11 py-2" aria-expanded={making} onClick={() => setMaking(!making)}>
              {making ? "Never mind" : "Make one"}
            </Button>
          </div>
          {making ? (
            <div className="mt-3 grid gap-2 rounded-2xl border border-line p-3">
              <label className="text-sm text-muted" htmlFor="mk-water">
                Water
              </label>
              <select id="mk-water" value={water} onChange={(e) => setWater(Number(e.target.value))} className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-fg">
                {BIOMES.map((b, i) => (
                  <option key={b.id} value={i}>
                    {b.name}
                  </option>
                ))}
              </select>
              <label className="text-sm text-muted" htmlFor="mk-cat">
                Winner is
              </label>
              <select id="mk-cat" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-fg">
                {(["total", "big", "sprint", "value"] as const).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_INFO[c].name}: {CATEGORY_INFO[c].blurb}
                  </option>
                ))}
              </select>
              <label className="text-sm text-muted" htmlFor="mk-min">
                How long
              </label>
              <select id="mk-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-fg">
                {[10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
              <Button disabled={!!busy} onClick={create}>
                Make it and join
              </Button>
              <p className="text-xs text-muted">Up to 16 anglers. Share the four-letter code that appears.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function joinProblem(error: string, status: number): string {
  switch (error) {
    case "event_over":
      return "That event is over.";
    case "not_started":
      return "It hasn't started yet. Come back a minute before.";
    case "event_full":
      return "That event is full.";
    case "banned":
      return "You're sitting out for a while. Come back later.";
    case "too_many_events":
      return "You already have three events running.";
    case "slow_down":
      return "Easy there. Try again in a moment.";
    default:
      return status >= 500 ? "The event board had a hiccup. Try again." : "Couldn't do that. Try again.";
  }
}

function EventRow({ e, now, busy, onJoin }: { e: EventInfo; now: number; busy: boolean; onJoin: () => void }) {
  const live = now >= e.startsAt;
  const toStart = e.startsAt - now;
  const canJoin = toStart <= 60_000;
  const info = CATEGORY_INFO[e.category];
  return (
    <li className="rounded-2xl border border-line bg-bg/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {kindName[e.kind]} · {e.waterName} · {e.entrants} {e.entrants === 1 ? "angler" : "anglers"}
          </p>
          <p className="font-serif text-lg leading-tight">{info.name}</p>
          <p className="text-sm text-muted">{info.blurb}</p>
          <p className="mt-1 text-sm text-brass">
            {live ? `${clock(e.endsAt - now)} left` : `Starts in ${clock(toStart)}`}
            <span className="text-muted"> · {e.castBudget} casts</span>
          </p>
        </div>
        <Button className="min-h-11 shrink-0 px-4 py-2 text-sm" disabled={!canJoin || busy} onClick={onJoin} aria-label={`${e.joined ? "Go back to" : "Join"} ${e.title}`}>
          {busy ? "Joining…" : e.joined ? "Resume" : "Join"}
        </Button>
      </div>
    </li>
  );
}

/* ── The event over the water ─────────────────────────────────────────────── */

function useBoard(run: TourneyRun | null, every = 10_000): BoardReply | null {
  const [board, setBoard] = useState<BoardReply | null>(null);
  const eventId = run?.event.id;
  const pending = run?.pending ?? 0;
  const last = useRef(0);
  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    const pull = async () => {
      try {
        const { status, body } = await api.board(eventId, playerId());
        if (alive && status === 200) setBoard(body);
        last.current = Date.now();
      } catch {
        /* the board is a nicety: keep the last one */
      }
    };
    void pull();
    const t = window.setInterval(() => void pull(), every);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [eventId, every]);
  /* A verdict just landed: refresh sooner than the next tick. */
  useEffect(() => {
    if (!eventId || pending !== 0 || Date.now() - last.current < 3000) return;
    void api.board(eventId, playerId()).then(({ status, body }) => status === 200 && setBoard(body)).catch(() => undefined);
  }, [eventId, pending]);
  return board;
}

/** One line over the water: the clock, your casts, your rank. Phones get this line; desktops can open the panel. */
export function TournamentTicker() {
  const run = useGame((s) => s.tourney);
  const screen = useGame((s) => s.screen);
  const mode = useGame((s) => s.mode);
  const phase = useGame((s) => s.phase);
  const [panel, setPanel] = useState(false);
  useTick(500);
  if (!run || mode !== "tournament" || screen !== "game") return null;
  const left = msToClose(run);
  const cat = CATEGORY_INFO[run.event.category];
  const score = tourneyScore(run);
  const done = cantCast(run) !== null && phase === "idle" && run.pending === 0;
  return (
    <>
      <div
        data-testid="tourney-ticker"
        className="pointer-events-none absolute top-14 left-1/2 z-30 flex max-w-[96vw] -translate-x-1/2 flex-col items-center gap-1 max-md:top-[7.25rem]"
      >
        <button
          type="button"
          onClick={() => setPanel(!panel)}
          aria-expanded={panel}
          aria-label="Event details"
          className="pointer-events-auto flex max-w-full min-h-11 items-center gap-x-3 gap-y-0 overflow-hidden rounded-full border border-line bg-bg/75 px-4 py-1 text-xs backdrop-blur-md max-md:hidden md:text-sm"
        >
          <span className="font-serif text-base text-brass">{clock(left)}</span>
          <span>{castsLeft(run)} casts left</span>
          <span>
            #{run.rank} of {Math.max(run.entrants, 1)}
          </span>
          <span className="text-brass">{scoreLabel(run.event.category, score)}</span>
          <span className="text-muted">{cat.name}</span>
        </button>
        <div className="pointer-events-none flex items-center gap-3 whitespace-nowrap rounded-full border border-line bg-bg/75 px-3 py-1 text-xs backdrop-blur-md md:hidden">
          <span className="font-serif text-sm text-brass">{clock(left)}</span>
          <span>{castsLeft(run)} casts</span>
          <span>
            #{run.rank}/{Math.max(run.entrants, 1)}
          </span>
          <span className="text-brass">{scoreLabel(run.event.category, score)}</span>
        </div>
        {run.note ? (
          <p className="rounded-full bg-bg/70 px-3 py-0.5 text-xs text-muted backdrop-blur-sm" aria-live="polite">
            {run.note}
          </p>
        ) : null}
      </div>
      {panel ? (
        <div className="pointer-events-auto absolute top-28 left-1/2 z-30 max-h-[70dvh] w-[min(26rem,94vw)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-brass bg-surface p-3 max-md:hidden">
          <TournamentPanel />
        </div>
      ) : null}
      {done ? <TournamentResults run={run} /> : null}
    </>
  );
}

function Rows({ rows, category }: { rows: BoardRow[]; category: TourneyRun["event"]["category"] }) {
  return (
    <ol className="flex flex-col text-sm">
      {rows.map((r, i) => (
        <li
          key={`${r.rank}-${r.name}-${i}`}
          className={cn("flex items-center justify-between gap-3 border-b border-line py-1 last:border-0", r.you && "text-brass")}
        >
          <span className="min-w-0 truncate">
            <span className="inline-block w-7 text-muted">{r.rank <= 3 ? ["1st", "2nd", "3rd"][r.rank - 1] : `#${r.rank}`}</span>
            {r.name}
            {r.you ? " (you)" : ""}
          </span>
          <span className="shrink-0">{scoreLabel(category, r.score)}</span>
        </li>
      ))}
    </ol>
  );
}

/** The event panel: tackle, standing, board. The Cast tab on phones; a card from the ticker on desktops. */
export function TournamentPanel() {
  const run = useGame((s) => s.tourney);
  const phase = useGame((s) => s.phase);
  const setFamily = useGame((s) => s.setFamily);
  const leave = useGame((s) => s.leaveEvent);
  const board = useBoard(run);
  useTick(1000);
  if (!run) return <p className="p-4 text-sm text-muted">Pick an event from the main menu to start.</p>;
  const cat = CATEGORY_INFO[run.event.category];
  const why = cantCast(run);
  return (
    <div className="flex flex-col gap-3" data-testid="tourney-panel">
      <section className="rounded-2xl border border-line bg-surface p-3">
        <p className="text-xs text-muted">
          {BIOMES[run.water].name} · {cat.name}
        </p>
        <h3 className="font-serif text-lg leading-tight">{run.event.title}</h3>
        <p className="text-sm text-muted">{cat.blurb}</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Stat k="Time" v={clock(msToClose(run))} />
          <Stat k="Casts" v={String(castsLeft(run))} />
          <Stat k="Fishing" v={clock(secondsLeft(run) * 1000)} />
        </div>
        <p className="mt-2 text-sm">
          You are <span className="text-brass">#{run.rank}</span> of {Math.max(run.entrants, 1)} ·{" "}
          <span className="text-brass">{scoreLabel(run.event.category, tourneyScore(run))}</span>
        </p>
        {why ? <p className="mt-1 text-sm text-muted">{why}</p> : null}
        <p className="mt-1 text-xs text-muted">
          Same tackle for everybody. Helping Hand and Kid Mode&apos;s help are off here so it&apos;s fair. Tap the water to pick a
          spot and use the Rig control for depth and speed.
        </p>
      </section>
      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Your bait or lure</h3>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Bait or lure">
          {FAMILIES.map((f) => (
            <button
              key={f}
              type="button"
              disabled={phase !== "idle"}
              aria-pressed={run.family === f}
              onClick={() => setFamily(f)}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm disabled:opacity-60",
                run.family === f ? "border-brass bg-brass text-brass-ink" : "border-line bg-surface-2 text-muted",
              )}
            >
              {FAMILY_INFO[f].label}
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">The board</h3>
        {board && board.rows.length ? <Rows rows={board.rows} category={run.event.category} /> : <p className="text-sm text-muted">No catches on the board yet.</p>}
        <p className="mt-1 text-xs text-muted">Scores come from the server, which checks every catch. Updates every few seconds.</p>
      </section>
      <Button variant="ghost" disabled={phase !== "idle"} onClick={leave}>
        Back to the main menu
      </Button>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-1">
      <p className="text-[10px] text-muted uppercase">{k}</p>
      <p className="font-serif text-lg leading-tight">{v}</p>
    </div>
  );
}

/** When the clock, the casts or the fishing time run out: where you finished. */
function TournamentResults({ run }: { run: TourneyRun }) {
  const [shown, setShown] = useState(true);
  const [board, setBoard] = useState<BoardReply | null>(null);
  const leave = useGame((s) => s.leaveEvent);
  const eventId = run.event.id;
  const over = msToClose(run) === 0;
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const { status, body } = await api.board(eventId, playerId(), fetch, { final: over, top: 3 });
        if (alive && status === 200) setBoard(body);
        else if (alive && over) {
          const alt = await api.board(eventId, playerId(), fetch, { top: 3 });
          if (alive && alt.status === 200) setBoard(alt.body);
        }
      } catch {
        /* offline: the sheet still shows your own numbers */
      }
    };
    void pull();
    const t = window.setInterval(() => void pull(), over ? 60_000 : 8000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [eventId, over]);
  if (!shown) return null;
  const me = board?.me;
  const cat = run.event.category;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-3" data-testid="tourney-results">
      <div role="dialog" aria-label="Event results" className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-brass bg-surface p-5">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brass uppercase">
          <Flag className="size-4" aria-hidden /> {over ? "Final results" : "Your fishing is done"}
        </p>
        <h2 className="mt-1 font-serif text-2xl leading-tight">{run.event.title}</h2>
        <p className="mt-2 text-sm">
          You finished <span className="font-serif text-xl text-brass">#{me?.rank ?? run.rank}</span> of {board?.entrants ?? run.entrants} with{" "}
          <span className="text-brass">{scoreLabel(cat, me?.score ?? run.score)}</span>.
        </p>
        {me && me.bestWeight > 0 ? <p className="text-sm text-muted">Your best fish: {me.bestWeight.toFixed(1)} lb.</p> : null}
        {board?.rows.length ? (
          <div className="mt-3">
            <h3 className="font-serif text-lg">Top of the board</h3>
            <Rows rows={board.rows.slice(0, 3)} category={cat} />
          </div>
        ) : null}
        {!over ? <p className="mt-2 text-xs text-muted">The board is final when the clock runs out. Scores can still move.</p> : null}
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={leave}>
            Main menu
          </Button>
          <Button variant="ghost" onClick={() => setShown(false)}>
            Look around
          </Button>
        </div>
      </div>
    </div>
  );
}
