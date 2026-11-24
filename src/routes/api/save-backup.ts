import { createFileRoute } from "@tanstack/react-router";

/* GET /api/save-backup?profile=…  ·  POST {profile, op:"clear"|"restore"} — "Clear my data": one backup
   per profile, restorable for 24 hours (docs/architecture/07 §7). */

const run = async (request: Request) => {
  const [{ serveAccount }, { handleSaveBackup }] = await Promise.all([
    import("@/lib/accounts/http.server"),
    import("@/lib/accounts/backups.server"),
  ]);
  return serveAccount(request, handleSaveBackup);
};

export const Route = createFileRoute("/api/save-backup")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
