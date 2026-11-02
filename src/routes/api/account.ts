import { createFileRoute } from "@tanstack/react-router";

/* GET /api/account  ·  POST {op:"request"|"verify"|"logout"|"delete"}  ·  GET ?export=1 (WP-9). Optional accounts: sign-in by emailed link. */

const run = async (request: Request) => {
  const [{ serveAccount }, { handleAccount }] = await Promise.all([
    import("@/lib/accounts/http.server"),
    import("@/lib/accounts/accounts.server"),
  ]);
  return serveAccount(request, handleAccount);
};

export const Route = createFileRoute("/api/account")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
