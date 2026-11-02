/**
 * Node ESM resolver hook so tests can import game code that uses the app's
 * `@/` path alias (tsconfig `paths` → `src/`). Registered by run-tests.mjs via
 * `--import`; Vite handles the alias in the browser, this handles it in Node.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { existsSync } from "node:fs";
      const root = ${JSON.stringify(pathToFileURL(process.cwd() + "/src/").href)};
      const exts = ["", ".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts", "/index.tsx"];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith("@/")) {
          const base = new URL(spec.slice(2), root);
          for (const ext of exts) {
            const url = new URL(base.href + ext);
            if (existsSync(url)) return { url: url.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
  import.meta.url,
);
