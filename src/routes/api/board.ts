import { createFileRoute } from "@tanstack/react-router";

/* GET /api/board?eventId&top=25&around=playerId[&final=1]  ·  ?series=… (the weekly's waters added up). Cached 5 s. */

export const Route = createFileRoute("/api/board")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [{ serve }, { handleBoard }] = await Promise.all([
          import("@/lib/tournaments/http.server"),
          import("@/lib/tournaments/board.server"),
        ]);
        return serve(request, handleBoard);
      },
    },
  },
});
