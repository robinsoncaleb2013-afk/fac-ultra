import { createFileRoute } from "@tanstack/react-router";

/* GET /api/google-start (WP-9): begin "Sign in with Google". Does nothing unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. */

export const Route = createFileRoute("/api/google-start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [{ serveAccount }, { handleGoogleStart }] = await Promise.all([
          import("@/lib/accounts/http.server"),
          import("@/lib/accounts/google.server"),
        ]);
        return serveAccount(request, handleGoogleStart);
      },
    },
  },
});
