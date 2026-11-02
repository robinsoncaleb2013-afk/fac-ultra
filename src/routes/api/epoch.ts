import { createFileRoute } from "@tanstack/react-router";

/* GET /api/epoch → {epoch, reset}: which build the server is, and whether the test-phase reset switch is on.
   The browser asks so an old cached tab learns about a new server, and so FAC_TEST_RESET on the server
   (not only the build) decides. Touches no database. docs/TEST-PHASE.md. */
export const Route = createFileRoute("/api/epoch")({
  server: {
    handlers: {
      GET: async () => {
        const { currentEpoch, resetSwitchOn } = await import("@/lib/test-phase");
        return new Response(JSON.stringify({ epoch: currentEpoch(process.env), reset: resetSwitchOn(process.env) }), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
