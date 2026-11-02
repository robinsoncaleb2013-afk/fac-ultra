import { createFileRoute } from "@tanstack/react-router";

/* Signaling relay for the WebRTC room engine (src/lib/multiplayer/p2p.ts).
   Deliberately dumb: it only introduces peers and ferries SDP/ICE envelopes.
   All game data flows browser-to-browser after the handshake.

   Rooms and signals live in the `rooms` / `signals` tables (migrations/0007_tournaments.sql),
   so the relay works across server instances and cold starts (docs/architecture/06 §1.2).
   The wire contract is unchanged; the logic is in src/lib/tournaments/rtc.server.ts. */

const run = async (request: Request) => {
  const [{ serve }, { handleRtc }] = await Promise.all([
    import("@/lib/tournaments/http.server"),
    import("@/lib/tournaments/rtc.server"),
  ]);
  return serve(request, handleRtc, 48 * 1024);
};

export const Route = createFileRoute("/api/rtc")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
