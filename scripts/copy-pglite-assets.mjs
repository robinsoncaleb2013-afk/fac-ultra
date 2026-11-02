#!/usr/bin/env node
/**
 * Self-hosting fix: copy PGLite's runtime files next to the bundled server.
 *
 * A plain `node-server` build bundles PGLite's JavaScript into
 * `.output/server/_libs/electric-sql__pglite.mjs`, but PGLite loads three binary
 * files by a path relative to that module (`pglite.data`, `pglite.wasm`,
 * `initdb.wasm`). The bundler leaves them behind, so with no DATABASE_URL every
 * database route answers 500. This copies them into `_libs/`.
 *
 * It runs at the end of `npm run build` and does nothing when there is no
 * `.output/server/_libs` (the Vercel build, which uses Neon and has no use for it).
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PGLITE_FILES = ["pglite.data", "pglite.wasm", "initdb.wasm"];

/** Copy the files; returns what was copied, or null when this build has no node-server bundle. */
export function copyPgliteAssets(root) {
  const libs = join(root, ".output", "server", "_libs");
  const src = join(root, "node_modules", "@electric-sql", "pglite", "dist");
  if (!existsSync(libs)) return null;
  mkdirSync(libs, { recursive: true });
  const done = [];
  for (const name of PGLITE_FILES) {
    const from = join(src, name);
    if (!existsSync(from)) throw new Error(`[pglite-assets] ${from} is missing; run npm install`);
    copyFileSync(from, join(libs, name));
    done.push(name);
  }
  return done;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const done = copyPgliteAssets(root);
  console.log(done ? `[pglite-assets] copied ${done.join(", ")} into .output/server/_libs` : "[pglite-assets] no node-server bundle here; nothing to do");
}
