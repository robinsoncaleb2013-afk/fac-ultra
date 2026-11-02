import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { tourneyScore, useGame } from "@/game/engine";
import { scoreLabel } from "@/game/scoring";
import { teamById, type TeamRow } from "@/game/social";
import { useLive } from "@/components/game/board-state";
import { api, playerId, type BoardRow, type TourneyRun } from "@/game/tourney";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/* The live board (docs/architecture/06 §3.2, 09 §7): one poller, many readers.

   Desktop: a collapsible card top-right under the HUD bar. Phone: a one-line rank ticker (in tournament.tsx)
   and this same board as a full-screen sheet. Rows slide when ranks change. The server's board is the truth;
   Regulars (computer anglers) are marked so nobody mistakes them for people. */

/** Poll the board for the event you are in: every 10 s, and sooner right after a catch is judged. */
export function BoardFeed() {
  const eventId = useGame((s) => s.tourney?.event.id);
  const pending = useGame((s) => s.tourney?.pending ?? 0);
  useEffect(() => {
    if (!eventId) {
      useLive.setState({ board: null, at: 0 });
      return;
    }
    let alive = true;
    const pull = async () => {
      try {
        const { status, body } = await api.board(eventId, playerId(), fetch, { top: 10 });
        if (alive && status === 200) useLive.setState({ board: body, at: Date.now() });
      } catch {
        /* the board is a nicety: keep the last one */
      }
    };
    void pull();
    const t = window.setInterval(() => void pull(), 10_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [eventId]);
  /* A verdict just landed: refresh sooner than the next tick. */
  useEffect(() => {
    if (!eventId || pending !== 0 || Date.now() - useLive.getState().at < 3000) return;
    void api
      .board(eventId, playerId(), fetch, { top: 10 })
      .then(({ status, body }) => status === 200 && useLive.setState({ board: body, at: Date.now() }))
      .catch(() => undefined);
  }, [eventId, pending]);
  return null;
}

const MEDAL = ["🥇", "🥈", "🥉"];

/** Keep rows where they were and slide them to their new place when the order changes (FLIP). */
function useFlip(motion: boolean) {
  const refs = useRef(new Map<string, HTMLElement>());
  const prev = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    refs.current.forEach((el, k) => {
      const top = el.offsetTop;
      next.set(k, top);
      const was = prev.current.get(k);
      if (motion && was !== undefined && was !== top) {
        el.style.transition = "none";
        el.style.transform = `translateY(${was - top}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 450ms ease";
          el.style.transform = "";
        });
      }
    });
    prev.current = next;
  });
  return (key: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(key, el);
    else refs.current.delete(key);
  };
}

export function BoardRows({ rows, category, motion = true }: { rows: BoardRow[]; category: TourneyRun["event"]["category"]; motion?: boolean }) {
  const track = useFlip(motion);
  const seen = new Map<string, number>();
  return (
    <ol className="relative flex flex-col text-sm" data-testid="board-rows">
      {rows.map((r, i) => {
        const base = `${r.rival ? "r" : "h"}:${r.name}`;
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const key = `${base}#${n}`;
        const gap = i > 0 && r.rank - rows[i - 1].rank > 1 && !(r.rank <= 3);
        const team = teamById(r.team);
        return (
          <li
            key={key}
            ref={track(key)}
            data-you={r.you ? "" : undefined}
            className={cn(
              "flex items-center justify-between gap-2 border-b border-line py-1 last:border-0",
              r.you && "rounded-lg bg-brass/15 px-1 text-brass",
              gap && "mt-1 border-t border-dashed",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="inline-block w-7 shrink-0 text-center text-muted">{r.rank <= 3 && r.score > 0 ? MEDAL[r.rank - 1] : `#${r.rank}`}</span>
              {r.rival ? <span aria-hidden>{r.portrait}</span> : null}
              {team ? <span aria-label={team.name}>{team.emoji}</span> : null}
              <span className="truncate">
                {r.name}
                {r.you ? " (you)" : ""}
              </span>
              {r.rival ? (
                <span className="shrink-0 rounded-full border border-line px-1.5 text-[10px] text-muted" title="A Regular is a computer angler who keeps the board company.">
                  Regular
                </span>
              ) : null}
            </span>
            <span className="shrink-0 tabular-nums">{scoreLabel(category, r.score)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function TeamRows({ teams }: { teams: TeamRow[] }) {
  return (
    <ol className="mb-2 flex flex-col gap-1 text-sm" aria-label="Teams" data-testid="team-rows">
      {teams.map((t) => (
        <li key={t.team} className={cn("flex items-center justify-between rounded-lg border border-line px-2 py-1", t.you && "border-brass text-brass")}>
          <span>
            {t.rank <= 3 && t.score > 0 ? MEDAL[t.rank - 1] : `#${t.rank}`} {t.emoji} {t.name}
            <span className="text-muted"> · {t.members}</span>
          </span>
          <span className="tabular-nums">{t.score.toFixed(1)} lb</span>
        </li>
      ))}
    </ol>
  );
}

/** Desktop: the board over the water, under the HUD bar, 280 px wide, collapsible (06 §3.2). */
export function LiveBoard() {
  const run = useGame((s) => s.tourney);
  const mode = useGame((s) => s.mode);
  const motion = useGame((s) => s.motion);
  const board = useLive((s) => s.board);
  const [open, setOpen] = useState(true);
  if (!run || mode !== "tournament") return null;
  return (
    <section
      data-testid="live-board"
      aria-label="Live board"
      className="pointer-events-auto w-[280px] max-w-full rounded-2xl border border-line bg-bg/80 p-2 backdrop-blur-md"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-9 w-full items-center justify-between gap-2 px-1 text-left"
      >
        <span className="font-serif text-base">The board</span>
        <span className="flex items-center gap-1 text-xs text-muted">
          #{run.rank} of {Math.max(run.entrants, 1)}
          {open ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
        </span>
      </button>
      {open ? (
        <div className="mt-1 max-h-[46dvh] overflow-y-auto px-1">
          {board?.teams?.length ? <TeamRows teams={board.teams} /> : null}
          {board && board.rows.length ? (
            <BoardRows rows={board.rows} category={run.event.category} motion={motion} />
          ) : (
            <p className="py-2 text-sm text-muted">No catches yet. Be the first on the board.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Phone: the board as a full-screen sheet (09 §7). */
export function BoardSheet({ onClose }: { onClose: () => void }) {
  const run = useGame((s) => s.tourney);
  const motion = useGame((s) => s.motion);
  const board = useLive((s) => s.board);
  if (!run) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg safe-x" role="dialog" aria-label="The board" data-testid="board-sheet">
      <div className="safe-top flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-serif text-xl leading-tight">The board</h2>
          <p className="text-xs text-muted">{run.event.title}</p>
        </div>
        <Button variant="quiet" className="min-h-11 px-3 py-2 text-sm" onClick={onClose} aria-label="Close the board">
          <X className="size-5" aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-2 text-sm">
          You are <span className="text-brass">#{run.rank}</span> of {Math.max(run.entrants, 1)} ·{" "}
          <span className="text-brass">{scoreLabel(run.event.category, tourneyScore(run))}</span>
        </p>
        {board?.teams?.length ? <TeamRows teams={board.teams} /> : null}
        {board && board.rows.length ? <BoardRows rows={board.rows} category={run.event.category} motion={motion} /> : <p className="text-sm text-muted">No catches yet.</p>}
        <p className="mt-2 text-xs text-muted">Scores come from the server, which checks every catch. Updates every few seconds.</p>
      </div>
    </div>
  );
}
