import { create } from "zustand";
import { tourneyScore } from "@/game/engine";
import { gapLine } from "@/game/social";
import type { BoardReply, TourneyRun } from "@/game/tourney";

type LiveState = { board: BoardReply | null; at: number };
export const useLive = create<LiveState>(() => ({ board: null, at: 0 }));

/** The phone ticker's tail: "2.3 lb behind #3", worked out from the rows the board sent. */
export function tickerGap(run: TourneyRun, board: BoardReply | null): string {
  if (!board) return "";
  const mine = tourneyScore(run);
  const rows = board.rows;
  const at = rows.findIndex((r) => r.you);
  const ahead = at > 0 ? rows[at - 1] : at < 0 ? [...rows].reverse().find((r) => r.rank < run.rank) : null;
  const behind = at >= 0 ? rows[at + 1] : null;
  return gapLine(run.event.category, run.rank, mine, ahead ? { rank: ahead.rank, score: ahead.score } : null, behind ? { score: behind.score } : null);
}

