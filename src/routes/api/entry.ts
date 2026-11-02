import { createFileRoute } from "@tanstack/react-router";

/* POST /api/entry {op:"join", eventId, playerId, name} → seed, rules, serverNow, nextCast (06 §1.2) */

export const Route = createFileRoute("/api/entry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ serve }, { handleEntry }] = await Promise.all([
          import("@/lib/tournaments/http.server"),
          import("@/lib/tournaments/entries.server"),
        ]);
        return serve(request, handleEntry);
      },
    },
  },
});
