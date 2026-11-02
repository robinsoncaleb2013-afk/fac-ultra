import { createFileRoute } from "@tanstack/react-router";

/* GET  /api/events?scope=open[&playerId]   open + upcoming events (writes the schedule on demand)
   GET  /api/events?code=ABCD               one private event by its code
   POST /api/events {op:"create", …}        a private event (docs/architecture/06 §1.2) */

const run = async (request: Request) => {
  const [{ serve }, { handleEvents }] = await Promise.all([
    import("@/lib/tournaments/http.server"),
    import("@/lib/tournaments/events.server"),
  ]);
  return serve(request, handleEvents);
};

export const Route = createFileRoute("/api/events")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
