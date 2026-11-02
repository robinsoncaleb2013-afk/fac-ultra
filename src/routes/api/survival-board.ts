import { createFileRoute } from "@tanstack/react-router";

/* GET /api/survival-board?date&water      today's longest runs
   POST /api/survival-board {playerId, name, date, water, run, log}   a run, replayed from the daily seed and its log */

const run = async (request: Request) => {
  const [{ serve }, { handleSurvivalBoard }, { MAX_LOG_BYTES }] = await Promise.all([
    import("@/lib/tournaments/http.server"),
    import("@/lib/tournaments/board.server"),
    import("@/lib/tournaments/common.server"),
  ]);
  return serve(request, handleSurvivalBoard, MAX_LOG_BYTES);
};

export const Route = createFileRoute("/api/survival-board")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
