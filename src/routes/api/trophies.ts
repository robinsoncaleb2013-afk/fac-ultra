import { createFileRoute } from "@tanstack/react-router";

/* GET /api/trophies?playerId=…  The player's finished events with medals (WP-8). Finalizes events that ended since the last visit. */

export const Route = createFileRoute("/api/trophies")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [{ serve }, { handleTrophies }] = await Promise.all([
          import("@/lib/tournaments/http.server"),
          import("@/lib/tournaments/awards.server"),
        ]);
        return serve(request, handleTrophies);
      },
    },
  },
});
