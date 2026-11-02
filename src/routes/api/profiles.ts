import { createFileRoute } from "@tanstack/react-router";

/* POST /api/profiles {op:"create"|"rename"|"remove"|"link"} (WP-9). Family profiles, up to four per account. */

const run = async (request: Request) => {
  const [{ serveAccount }, { handleProfiles }] = await Promise.all([
    import("@/lib/accounts/http.server"),
    import("@/lib/accounts/profiles.server"),
  ]);
  return serveAccount(request, handleProfiles);
};

export const Route = createFileRoute("/api/profiles")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
