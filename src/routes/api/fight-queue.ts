import { createFileRoute } from "@tanstack/react-router";

/* POST /api/fight-queue {op:"join"|"status"|"leave", playerId, ...} → the fish-fight matchmaker (06 §1.2) */

export const Route = createFileRoute("/api/fight-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ serve }, { handleFightQueue }] = await Promise.all([
          import("@/lib/tournaments/http.server"),
          import("@/lib/tournaments/fightqueue.server"),
        ]);
        return serve(request, handleFightQueue);
      },
    },
  },
});
