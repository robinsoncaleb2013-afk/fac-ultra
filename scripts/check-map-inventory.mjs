#!/usr/bin/env node
// MAP-INVENTORY (fleet rule adopted 2026-11-21; this repo adopted it 2026-11-23): every game module,
// UI component file, server file, API route file, migration and tooling script has its own entry in
// docs/relational-map/inventory/, and every entry names something that exists. Entries are one per
// item with a blank line between, so two changes to different items never collide in git. The lists
// below are derived from the filesystem itself, so the map never states how many of each there are.
// Plain Node, no dependencies; run from the repo root.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const INV = 'docs/relational-map/inventory';
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((n) => {
    const p = join(dir, n).split('\\').join('/');
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const lists = [
  { file: 'game.md', items: readdirSync('src/game').filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => `src/game/${f}`) },
  { file: 'components.md', items: walk('src/components').filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\.(ts|tsx)$/.test(p)) },
  { file: 'server.md', items: walk('src/lib').filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\.(ts|tsx)$/.test(p)) },
  { file: 'api.md', items: readdirSync('src/routes/api').filter((f) => f.endsWith('.ts')).map((f) => `src/routes/api/${f}`) },
  { file: 'migrations.md', items: walk('migrations').filter((p) => p.endsWith('.sql')) },
  { file: 'scripts.md', items: readdirSync('scripts').filter((f) => !/\.test\.mjs$/.test(f) && /\.(mjs|mts|html)$/.test(f)).map((f) => `scripts/${f}`) },
];
const problems = [];
for (const l of lists) {
  const path = `${INV}/${l.file}`;
  if (!existsSync(path)) { problems.push(`${path} is missing`); continue; }
  const text = readFileSync(path, 'utf8');
  const named = [...text.matchAll(/^- \*\*[^*]+\*\* \(`([^`]+)`\): (.*)$/gm)].map((m) => ({ path: m[1], desc: m[2].trim() }));
  const have = new Set(named.map((n) => n.path));
  for (const i of l.items) if (!have.has(i)) problems.push(`${l.file}: no entry for ${i} (add "- **name** (\`${i}\`): what it does", with a blank line before it)`);
  for (const n of named) {
    if (!l.items.includes(n.path)) problems.push(`${l.file}: ${n.path} no longer exists; remove its entry`);
    if (n.desc.length < 12) problems.push(`${l.file}: ${n.path} needs a real description`);
  }
  if (/^- \*\*.*\n- \*\*/m.test(text)) problems.push(`${l.file}: keep a blank line between entries`);
}
if (problems.length) { console.error('relational map inventory out of step with the code:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log(`relational map inventory OK: ${lists.reduce((n, l) => n + l.items.length, 0)} items each have their own entry`);
