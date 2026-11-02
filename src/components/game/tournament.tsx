import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { BIOMES } from "@/game/content";
import { tourneyScore, useGame } from "@/game/engine";
import { FAMILIES, FAMILY_INFO } from "@/game/presentation";
import { CATEGORY_INFO, scoreLabel } from "@/game/scoring";
import { MEDAL_NAMES, teamById, titleFor, type ResultRow } from "@/game/social";
import { api, cantCast, castsLeft, clock, msToClose, playerId, secondsLeft, type BoardReply, type TourneyRun } from "@/game/tourney";
import { Button } from "@/components/ui/button";
import { BoardFeed, BoardRows, BoardSheet, LiveBoard, TeamRows } from "@/components/game/board";
import { tickerGap, useLive } from "@/components/game/board-state";
import { EventRoomLink, InviteSection, RoomSection } from "@/components/game/event-social";
import { useTick } from "@/components/game/use-tick";
import { cn } from "@/lib/cn";

/* The event over the water: the ticker, the panel, the results (docs/architecture/06 §3, 09 §7).
   The lobby is in lobby.tsx, the live board in board.tsx, the room and emotes in event-social.tsx. */

export { TournamentLobby } from "@/components/game/lobby";

/** One line under the HUD bar: the clock, your casts, your rank and how far to the next place.
    Phones tap it for the full-screen board; desktops get the board card and can open the panel. */
export function TournamentTicker() {
  const run = useGame((s) => s.tourney);
  const screen = useGame((s) => s.screen);
  const mode = useGame((s) => s.mode);
  const phase = useGame((s) => s.phase);
  const board = useLive((s) => s.board);
  const [panel, setPanel] = useState(false);
  const [sheet, setSheet] = useState(false);
  useTick(500);
  if (!run || mode !== "tournament" || screen !== "game") return null;
  const left = msToClose(run);
  const cat = CATEGORY_INFO[run.event.category];
  const score = tourneyScore(run);
  const done = cantCast(run) !== null && phase === "idle" && run.pending === 0;
  const gap = tickerGap(run, board);
  const team = teamById(run.team);
  return (
    <>
      <BoardFeed />
      <EventRoomLink />
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
          <span className="text-muted">{team ? `${team.emoji} ${team.name}` : cat.name}</span>
        </button>
        <button
          type="button"
          data-testid="rank-ticker"
          onClick={() => setSheet(true)}
          aria-label="Open the board"
          className="pointer-events-auto flex min-h-11 max-w-full items-center gap-2 overflow-hidden rounded-full border border-line bg-bg/75 px-3 py-1 text-xs whitespace-nowrap backdrop-blur-md md:hidden"
        >
          <span className="font-serif text-sm text-brass">{clock(left)}</span>
          <span>{castsLeft(run)} casts</span>
          <span>
            #{run.rank} of {Math.max(run.entrants, 1)}
          </span>
          <span className="truncate text-brass">{gap || scoreLabel(run.event.category, score)}</span>
        </button>
        {run.note ? (
          <p className="rounded-full bg-bg/70 px-3 py-0.5 text-xs text-muted backdrop-blur-sm" aria-live="polite">
            {run.note}
          </p>
        ) : null}
      </div>
      <div className="pointer-events-none absolute top-14 right-4 z-30 max-md:hidden">
        <div className="mt-12">
          <LiveBoard />
        </div>
      </div>
      {panel ? (
        <div className="pointer-events-auto absolute top-28 left-1/2 z-30 max-h-[70dvh] w-[min(26rem,94vw)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-brass bg-surface p-3 max-md:hidden">
          <TournamentPanel />
        </div>
      ) : null}
      {sheet ? <BoardSheet onClose={() => setSheet(false)} /> : null}
      {done ? <TournamentResults run={run} /> : null}
    </>
  );
}

/** The event panel: tackle, standing, board, room. The Cast tab on phones; a card from the ticker on desktops. */
export function TournamentPanel() {
  const run = useGame((s) => s.tourney);
  const phase = useGame((s) => s.phase);
  const setFamily = useGame((s) => s.setFamily);
  const leave = useGame((s) => s.leaveEvent);
  const motion = useGame((s) => s.motion);
  const board = useLive((s) => s.board);
  useTick(1000);
  if (!run) return <p className="p-4 text-sm text-muted">Pick an event from the main menu to start.</p>;
  const cat = CATEGORY_INFO[run.event.category];
  const why = cantCast(run);
  const team = teamById(run.team);
  return (
    <div className="flex flex-col gap-3" data-testid="tourney-panel">
      <section className="rounded-2xl border border-line bg-surface p-3">
        <p className="text-xs text-muted">
          {BIOMES[run.water].name} · {team ? "Team Total Weight" : cat.name}
          {team ? ` · ${team.emoji} ${team.name}` : ""}
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
        {board?.teams?.length ? <TeamRows teams={board.teams} /> : null}
        {board && board.rows.length ? <BoardRows rows={board.rows} category={run.event.category} motion={motion} /> : <p className="text-sm text-muted">No catches on the board yet.</p>}
        <p className="mt-1 text-xs text-muted">
          Scores come from the server, which checks every catch. Updates every few seconds.
          {board?.rows.some((r) => r.rival) ? " Regulars are computer anglers who keep a short board company." : ""}
        </p>
      </section>
      <RoomSection />
      <InviteSection />
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

/** When the clock, the casts or the fishing time run out: where you finished, and what it earned. */
function TournamentResults({ run }: { run: TourneyRun }) {
  const [shown, setShown] = useState(true);
  const [board, setBoard] = useState<BoardReply | null>(null);
  const [won, setWon] = useState<ResultRow | null>(null);
  const leave = useGame((s) => s.leaveEvent);
  const sync = useGame((s) => s.syncTrophies);
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
        /* The event is over: the server has written the final standings. File the medal in the cabinet. */
        if (over && alive) {
          const r = await api.trophies(playerId());
          const mine = r.status === 200 ? r.body.results.find((x) => x.id === eventId) : undefined;
          if (alive && mine) {
            setWon(mine);
            void sync(false);
          }
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
  }, [eventId, over, sync]);
  if (!shown) return null;
  const me = board?.me;
  const cat = run.event.category;
  const team = teamById(run.team);
  const title = won ? titleFor(won) : null;
  const teams = board?.teams;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-3 max-md:p-0" data-testid="tourney-results">
      <div role="dialog" aria-label="Event results" className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-brass bg-surface p-5 max-md:max-h-dvh max-md:h-dvh max-md:max-w-none max-md:rounded-none max-md:border-0">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brass uppercase">
          <Flag className="size-4" aria-hidden /> {over ? "Final results" : "Your fishing is done"}
        </p>
        <h2 className="mt-1 font-serif text-2xl leading-tight">{run.event.title}</h2>
        <p className="mt-2 text-sm">
          You finished <span className="font-serif text-xl text-brass">#{me?.rank ?? run.rank}</span> of {board?.entrants ?? run.entrants} with{" "}
          <span className="text-brass">{scoreLabel(cat, me?.score ?? run.score)}</span>.
        </p>
        {me && me.bestWeight > 0 ? <p className="text-sm text-muted">Your best fish: {me.bestWeight.toFixed(1)} lb.</p> : null}
        {won && won.medal ? (
          <div className="mt-3 rounded-2xl border border-brass bg-brass/10 p-3" data-testid="results-medal">
            <p className="font-serif text-lg">
              {["", "🥇", "🥈", "🥉"][won.medal]} {MEDAL_NAMES[won.medal]} medal{team ? ` for ${team.emoji} ${team.name}` : ""}!
            </p>
            <p className="text-sm text-muted">It&apos;s on your Trophy Shelf in the Lodge, and the {MEDAL_NAMES[won.medal]} bobber skin is yours to wear.</p>
            {title ? <p className="mt-1 text-sm text-brass">New title: {title}</p> : null}
          </div>
        ) : over ? (
          <p className="mt-3 text-sm text-muted" data-testid="results-nomedal">
            No medal this time. The top three get one. Have another go!
          </p>
        ) : null}
        {teams?.length ? (
          <div className="mt-3">
            <h3 className="font-serif text-lg">Teams</h3>
            <TeamRows teams={teams} />
          </div>
        ) : null}
        {board?.rows.length ? (
          <div className="mt-3">
            <h3 className="font-serif text-lg">Top of the board</h3>
            <BoardRows rows={board.rows.slice(0, 3)} category={cat} motion={false} />
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
