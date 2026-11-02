import { createFileRoute } from "@tanstack/react-router";

/* GET /api/save?profile=…[&mode=…]  ·  POST {profile, mode, baseRev, data} (WP-9). Cloud saves; every upload is sanitised on the server. */

const run = async (request: Request) => {
  const [{ serveAccount, SAVE_BODY_MAX }, { handleSave }] = await Promise.all([
    import("@/lib/accounts/http.server"),
    import("@/lib/accounts/saves.server"),
  ]);
  return serveAccount(request, handleSave, SAVE_BODY_MAX);
};

export const Route = createFileRoute("/api/save")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
