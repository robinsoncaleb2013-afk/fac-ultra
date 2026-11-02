/* A throwaway in-memory database for tests: PGLite with migrations/*.sql applied, wrapped in the same
   `Sql` shape as `getSql()` (int8 → number, tagged template and `.query`). Tests use this instead of
   `@/lib/db` because that file is bundler-only (`import.meta.glob`). Not imported by any route. */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "@/lib/db";

const identity = (v: string) => v;

export async function testSql(): Promise<{ sql: Sql; close: () => Promise<void> }> {
  const pg = new PGlite({ parsers: { 20: Number, 1082: identity, 1186: identity } });
  await pg.waitReady;
  const dir = join(process.cwd(), "migrations");
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(dir, name), "utf8"));
  }
  const run = async <T>(text: string, params: unknown[]) => (await pg.query<T>(text, params)).rows;
  const sql = (async <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) => run<T>(text, params);
  return { sql, close: () => pg.close() };
}
