import { createFileRoute } from "@tanstack/react-router";

/* GET /api/google-callback (WP-9): where Google sends the person back. Register this exact address as the
   "Authorised redirect URI" of the Google OAuth client: <your site>/api/google-callback */

export const Route = createFileRoute("/api/google-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [{ serveAccount }, { handleGoogleCallback }] = await Promise.all([
          import("@/lib/accounts/http.server"),
          import("@/lib/accounts/google.server"),
        ]);
        return serveAccount(request, handleGoogleCallback);
      },
    },
  },
});
