/**
 * Where the embedded PGLite database lives. Kept apart from db.ts (which pulls in
 * the bundler's glob import) so it can be unit-tested.
 *
 * - `DATABASE_URL` set          -> a real Postgres; this is not consulted.
 * - `FAC_DATA_DIR` set          -> PGLite persisted to that folder (self-hosting).
 * - neither                     -> in-memory PGLite, as before (wiped on restart).
 */
export function pgliteDataDir(env: Record<string, string | undefined>): string | undefined {
  const dir = env.FAC_DATA_DIR?.trim();
  return dir ? dir : undefined;
}
