import { createFileRoute } from "@tanstack/react-router";

/* GET /api/friends?playerId=…  ·  POST {op:"hello"|"add"|"remove"|"invite"|"dismiss", playerId, …}
   Friends by code, presence and invites (WP-8). The player id is a secret; friends see each other by friend code only. */

export const Route = createFileRoute("/api/friends")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [{ serve }, { handleFriends }] = await Promise.all([
          import("@/lib/tournaments/http.server"),
          import("@/lib/tournaments/friends.server"),
        ]);
        return serve(request, handleFriends);
      },
      POST: async ({ request }) => {
        const [{ serve }, { handleFriends }] = await Promise.all([
          import("@/lib/tournaments/http.server"),
          import("@/lib/tournaments/friends.server"),
        ]);
        return serve(request, handleFriends);
      },
    },
  },
});
