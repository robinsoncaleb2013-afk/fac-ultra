#!/usr/bin/env node
/**
 * One test command that is honest everywhere.
 *
 * `npm test` used to list files by hand and included the Grok sandbox's own
 * tooling tests — which read `.grok/skills/...` and the sandbox's baked
 * `site.json`, so outside the sandbox fourteen of them fail for reasons that
 * have nothing to do with the game. This runner picks the right set:
 *
 *   - game tests:       src/** /*.test.ts            (always)
 *   - portable tooling: scripts/<name>.test.mjs      (always; listed below)
 *   - sandbox tooling:  scripts/<name>.test.mjs      (only when .grok/ exists)
 *
 * Add a game test by creating `*.test.ts` next to the code. Nothing to register.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const inSandbox = existsSync(join(root, ".grok"));

/* Tooling tests that only make sense inside the Grok sandbox. */
const SANDBOX_ONLY = new Set([
  "brand-check.test.mjs",
  "check-auth-invariant.test.mjs",
  "grok-pwa-plugin.test.mjs",
  "with-app-env.test.mjs",
  "write-atomic.test.mjs",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const gameTests = walk(join(root, "src"));
const scriptTests = readdirSync(join(root, "scripts"))
  .filter((n) => /\.test\.mjs$/.test(n))
  .filter((n) => inSandbox || !SANDBOX_ONLY.has(n))
  .map((n) => join(root, "scripts", n));

const files = [...gameTests, ...scriptTests];
const skipped = inSandbox ? 0 : SANDBOX_ONLY.size;
console.log(`[test] ${gameTests.length} game test files, ${scriptTests.length} tooling test files` +
  (skipped ? ` (${skipped} sandbox-only files skipped: no .grok/ here)` : ""));

const loader = join(root, "scripts", "alias-loader.mjs");
const r = spawnSync(process.execPath, ["--experimental-strip-types", "--import", loader, "--test", ...files], {
  stdio: "inherit",
  env: { ...process.env, NODE_NO_WARNINGS: "1" },
});
process.exit(r.status ?? 1);
