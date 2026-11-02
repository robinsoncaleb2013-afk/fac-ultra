/* The docs must match the code (scripts/docs-check.mjs). The first test is the real guard; the rest prove the guard
   can actually see a problem, so it cannot go quietly blind. */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocs, envTableNames, pathsIn } from "./docs-check.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the docs match the code (paths, env vars, versions, migrations, routes, npm scripts)", () => {
  const problems = checkDocs(root);
  assert.deepEqual(problems, [], `\n - ${problems.join("\n - ")}\nFix the doc named in each line (or the marker), then re-run npm test.`);
});

test("pathsIn finds repo paths in backticks and skips globs, history lines and other prefixes", () => {
  const text = [
    "See `src/game/engine.ts` and `docs/architecture/` and `src/game/engine.ts:123`.",
    "Skip `src/game/*.ts`, `public/audio/*.ogg` and `.output/server/index.mjs` and `npm run build`.",
    "The old `src/components/game/menu.tsx` was removed in WP-10.",
  ].join("\n");
  assert.deepEqual(
    pathsIn(text).map((p) => p.path),
    ["src/game/engine.ts", "docs/architecture/", "src/game/engine.ts"],
  );
});

test("envTableNames reads the first name of each table row under the heading", () => {
  const text = "# T\n\n## Environment variables\n\n| Variable | What |\n|---|---|\n| `FAC_A` | x |\n| `B_KEY`, `B_ID` | y `NOT_ME` |\n\n## Next\n| `FAC_Z` | no |\n";
  assert.deepEqual(envTableNames(text), ["FAC_A", "B_KEY", "B_ID"]);
});

function miniRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), "docs-check-"));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), body);
  }
  return dir;
}

const BASE = {
  "package.json": JSON.stringify({ scripts: { build: "x", test: "y" } }),
  "src/game/engine.ts": "const SAVE_VERSION = 3;\n",
  "src/game/line-wear.ts": "export const RULES_VERSION = 2;\n",
  "src/game/modes.ts": 'export const MODE_LIST: readonly Mode[] = ["a", "b"];\n',
  "src/game/__fixtures__/save-v3.json": "{}",
  "src/routes/api/save.ts": "",
  "migrations/0007_x.sql": "",
  "src/lib/thing.ts": "const a = process.env.FAC_ONE;\n",
};
const MARKERS =
  "<!-- docs-check:save-version 3 -->\n<!-- docs-check:rules-version 2 -->\n<!-- docs-check:migrations 0007 -->\n<!-- docs-check:fixtures 3 -->\n<!-- docs-check:modes a b -->\n<!-- docs-check:routes save -->\n";
const GOOD_README = `# Docs\n\n${MARKERS}\n## Environment variables\n\n| Variable | What |\n|---|---|\n| \`FAC_ONE\` | one |\n\nRun \`npm run build\`. See \`src/game/engine.ts\`.\n`;

test("a consistent mini repo has no problems", () => {
  const dir = miniRepo({ ...BASE, "docs/README.md": GOOD_README });
  try {
    assert.deepEqual(checkDocs(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("it reports a missing path, a stale version marker, an undocumented env var and a fake npm script", () => {
  const dir = miniRepo({
    ...BASE,
    "src/lib/other.ts": "const b = process.env.FAC_TWO;\n",
    "docs/README.md": GOOD_README.replace("docs-check:save-version 3", "docs-check:save-version 2") + "\nGone: `src/nope/missing.ts`. Try `npm run nothing`.\n",
  });
  try {
    const text = checkDocs(dir).join("\n");
    assert.match(text, /src\/nope\/missing\.ts/);
    assert.match(text, /save-version says "2" but the code says "3"/);
    assert.match(text, /FAC_TWO/);
    assert.match(text, /npm run nothing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
