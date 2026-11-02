import { createFileRoute } from "@tanstack/react-router";

/* POST /api/catch {eventId, playerId, envelope} → verdict, the server's replay, score, rank (06 §1.2–1.5).
   The server re-rolls the cast and replays the fight with src/game/replay.ts; it never trusts the client's numbers. */

export const Route = createFileRoute("/api/catch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ serve }, { handleCatch }] = await Promise.all([
          import("@/lib/tournaments/http.server"),
          import("@/lib/tournaments/entries.server"),
        ]);
        return serve(request, handleCatch);
      },
    },
  },
});
