#!/usr/bin/env node
/**
 * Docs guard: keeps the written docs from silently drifting away from the code.
 *
 * It is cheap (reads text, no build) and runs inside `npm test` through scripts/docs-check.test.mjs.
 * Run it alone with `node scripts/docs-check.mjs`. It checks four things:
 *
 *   1. PATHS      Every `src/...`, `docs/...`, `scripts/...`, `migrations/...`, `public/...`, `art-src/...` or
 *                 `.github/...` path written in backticks in a doc, and every relative markdown link, must exist.
 *                 A line that says the thing was removed ("removed", "deleted", "no longer", "superseded", "~~") is skipped,
 *                 so history can still name files that are gone.
 *   2. ENV VARS   Every variable in the table under "## Environment variables" in docs/README.md must appear in the
 *                 code, and every FAC_* variable the code reads must be in that table.
 *   3. FACTS      Machine-readable markers `<!-- docs-check:NAME value ... -->` in the docs are compared with the code:
 *                 save-version, rules-version, migrations, fixtures, modes, routes. If you change the code, the test
 *                 fails and tells you which doc line to update.
 *   4. NPM        Every `npm run X` named in a doc is a real script in package.json.
 *
 * Not checked on purpose: docs/HOSTING-PLAN.md and docs/website/** (owned elsewhere), AGENTS.md (the sandbox's own
 * contract, full of paths that only exist inside the Grok sandbox), and counts such as "375 species" (brittle).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PATH_PREFIXES = ["src/", "docs/", "scripts/", "migrations/", "public/", "art-src/", ".github/"];
const FILE_EXT = /\.(ts|tsx|mjs|mts|json|md|sql|yml|yaml|sh|css|html|webp|ogg|jpg|png|svg)$/;
/* Paths that name a file in ANOTHER repository. */
const EXTERNAL = new Set(["docs/WEBSITE-BLUEPRINT.md"]);
/* A line that talks about something that is gone may still name it. */
const HISTORY = /\b(removed|deleted|no longer|moved from|superseded)\b|~~/i;
/* Docs that are not ours to police (see the header). */
const SKIP_DOCS = [/^docs\/HOSTING-PLAN\.md$/, /^docs\/website\//, /^AGENTS\.md$/];

function walk(dir, root, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".git") || name === ".output" || name === ".vercel" || name === "screenshots") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, root, out);
    else out.push(relative(root, p).split("\\").join("/"));
  }
  return out;
}

const read = (root, p) => readFileSync(join(root, p), "utf8");

/** Every .md file in the repo that this guard reads. */
export function docFiles(root) {
  return walk(root, root).filter((f) => f.endsWith(".md") && !SKIP_DOCS.some((re) => re.test(f)));
}

/** Paths written in backticks that look like repo files or folders. */
export function pathsIn(text) {
  const found = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (HISTORY.test(line)) return;
    for (const m of line.matchAll(/`([^`\s]+)`/g)) {
      let p = m[1].replace(/^\.\//, "").replace(/:\d+(-\d+)?$/, "").replace(/#.*$/, "");
      if (!PATH_PREFIXES.some((pre) => p.startsWith(pre))) continue;
      if (/[*{}<>[\]$]/.test(p) || p.includes("...") || p.includes("…")) continue;
      if (!p.endsWith("/") && !FILE_EXT.test(p)) continue;
      found.push({ path: p, line: i + 1 });
    }
  });
  return found;
}

function checkPaths(root, problems) {
  for (const doc of docFiles(root)) {
    const text = read(root, doc);
    for (const { path, line } of pathsIn(text)) {
      if (EXTERNAL.has(path)) continue;
      if (!existsSync(join(root, path))) problems.push(`${doc}:${line} names \`${path}\`, which does not exist`);
    }
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const file = target.replace(/#.*$/, "");
      if (!file) continue;
      const abs = resolve(root, dirname(doc), file);
      if (!existsSync(abs)) problems.push(`${doc} links to ${target}, which does not exist`);
    }
  }
}

/** The rows of the environment table: the first backticked name in each table row under the heading. */
export function envTableNames(text) {
  const start = text.indexOf("## Environment variables");
  if (start < 0) return null;
  const rest = text.slice(start + 1);
  const next = rest.search(/\n## /);
  const section = next < 0 ? rest : rest.slice(0, next);
  const names = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cell = line.split("|")[1] ?? "";
    for (const m of cell.matchAll(/`([A-Z][A-Z0-9_]+)`/g)) names.push(m[1]);
  }
  return names;
}

function codeFiles(root) {
  const roots = ["src", "scripts", "server"];
  const files = [];
  for (const r of roots) if (existsSync(join(root, r))) files.push(...walk(join(root, r), root));
  for (const f of ["vite.config.ts", "vercel.json", "startup.sh"]) if (existsSync(join(root, f))) files.push(f);
  return files.filter((f) => /\.(ts|tsx|mjs|mts|js|json|sh)$/.test(f) && !/docs-check/.test(f));
}

function checkEnv(root, problems) {
  const docPath = "docs/README.md";
  if (!existsSync(join(root, docPath))) return void problems.push("docs/README.md is missing (it holds the environment table)");
  const names = envTableNames(read(root, docPath));
  if (!names || names.length === 0) return void problems.push("docs/README.md has no '## Environment variables' table");
  const files = codeFiles(root);
  const body = files.filter((f) => !/\.test\.(ts|mjs)$/.test(f)).map((f) => read(root, f)).join("\n");
  for (const n of names) {
    if (!new RegExp(`\\b${n}\\b`).test(body)) problems.push(`${docPath} documents ${n}, but no code reads it`);
  }
  const used = new Set();
  for (const m of body.matchAll(/\bFAC_[A-Z][A-Z0-9_]*\b/g)) used.add(m[0]);
  for (const n of used) if (!names.includes(n)) problems.push(`the code reads ${n}, but it is not in the environment table in ${docPath}`);
}

/** `<!-- docs-check:NAME a b c -->` markers: { name, values, doc }. */
export function markersIn(root) {
  const out = [];
  for (const doc of docFiles(root)) {
    for (const m of read(root, doc).matchAll(/<!--\s*docs-check:([a-z-]+)\s*([^>]*?)\s*-->/g)) {
      out.push({ name: m[1], values: m[2].split(/\s+/).filter(Boolean), doc });
    }
  }
  return out;
}

/** What the code says for each fact. */
export function factsFromCode(root) {
  const facts = {};
  const engine = read(root, "src/game/engine.ts");
  facts["save-version"] = [/const SAVE_VERSION = (\d+);/.exec(engine)?.[1] ?? "?"];
  facts["rules-version"] = [/export const RULES_VERSION = (\d+);/.exec(read(root, "src/game/line-wear.ts"))?.[1] ?? "?"];
  facts.migrations = readdirSync(join(root, "migrations"))
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .map((f) => f.slice(0, 4))
    .sort();
  if (existsSync(join(root, "migrations/auth"))) {
    facts.migrations = [...readdirSync(join(root, "migrations/auth")).filter((f) => /^\d{4}_.*\.sql$/.test(f)).map((f) => f.slice(0, 4)), ...facts.migrations];
  }
  facts.fixtures = readdirSync(join(root, "src/game/__fixtures__"))
    .map((f) => /^save-v(\d+)\.json$/.exec(f)?.[1])
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));
  const list = /export const MODE_LIST: readonly Mode\[\] = \[([^\]]*)\]/.exec(read(root, "src/game/modes.ts"))?.[1] ?? "";
  facts.modes = [...list.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  facts.routes = readdirSync(join(root, "src/routes/api"))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.replace(/\.ts$/, ""))
    .sort();
  return facts;
}

function checkFacts(root, problems) {
  const facts = factsFromCode(root);
  const markers = markersIn(root);
  const seen = new Set(markers.map((m) => m.name));
  for (const name of Object.keys(facts)) {
    if (!seen.has(name)) problems.push(`no <!-- docs-check:${name} ... --> marker in any doc (expected: ${facts[name].join(" ")})`);
  }
  for (const m of markers) {
    const want = facts[m.name];
    if (!want) {
      problems.push(`${m.doc}: unknown docs-check marker "${m.name}"`);
      continue;
    }
    const sorted = (a) => (m.name === "routes" || m.name === "migrations" ? [...a].sort() : a);
    if (sorted(m.values).join(" ") !== sorted(want).join(" ")) {
      problems.push(`${m.doc}: docs-check:${m.name} says "${m.values.join(" ")}" but the code says "${want.join(" ")}". Update the doc.`);
    }
  }
}

function checkNpm(root, problems) {
  const scripts = JSON.parse(read(root, "package.json")).scripts ?? {};
  for (const doc of docFiles(root)) {
    read(root, doc).split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/\bnpm run ([a-z][a-z0-9:_-]*)/g)) {
        if (!(m[1] in scripts)) problems.push(`${doc}:${i + 1} says \`npm run ${m[1]}\`, which is not a script in package.json`);
      }
    });
  }
}

/** Run every check; returns a list of plain-English problems (empty = the docs match the code). */
export function checkDocs(root) {
  const problems = [];
  checkPaths(root, problems);
  checkEnv(root, problems);
  checkFacts(root, problems);
  checkNpm(root, problems);
  return problems;
}

const here = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === here) {
  const root = resolve(dirname(here), "..");
  const problems = checkDocs(root);
  if (problems.length === 0) {
    console.log(`[docs-check] ${docFiles(root).length} docs match the code.`);
  } else {
    console.error(`[docs-check] ${problems.length} problem(s):\n - ${problems.join("\n - ")}`);
    process.exit(1);
  }
}
