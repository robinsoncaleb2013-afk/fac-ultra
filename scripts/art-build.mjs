#!/usr/bin/env node
/**
 * Builds the two WebP sizes of every biome painting (docs/architecture/03 §6):
 *   <id>-1600.webp  (quality 78)   <id>-800.webp  (quality 72)
 * from the original paintings in art-src/<id>.jpg (WP-9 moved them out of public/ so they are never
 * served). Outputs go to public/art/biomes/. Safe to re-run.
 *
 *   node scripts/art-build.mjs            # build everything
 *   node scripts/art-build.mjs --check    # list what is missing, change nothing
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "art-src");
const dir = join(process.cwd(), "public", "art", "biomes");
const SIZES = [
  { w: 1600, q: 78 },
  { w: 800, q: 72 },
];
const ids = readdirSync(src)
  .filter((f) => /\.jpg$/i.test(f))
  .map((f) => f.replace(/\.jpg$/i, ""));

if (process.argv.includes("--check")) {
  let missing = 0;
  for (const id of ids)
    for (const { w } of SIZES)
      if (!existsSync(join(dir, `${id}-${w}.webp`))) {
        console.log(`missing ${id}-${w}.webp`);
        missing++;
      }
  console.log(missing ? `${missing} file(s) missing` : "all WebP files present");
  process.exit(0);
}

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed. Run `npm install` (it is a devDependency) and try again.");
  process.exit(1);
}

let total = 0;
for (const id of ids) {
  const from = join(src, `${id}.jpg`);
  for (const { w, q } of SIZES) {
    const out = join(dir, `${id}-${w}.webp`);
    await sharp(from).resize({ width: w, withoutEnlargement: true }).webp({ quality: q }).toFile(out);
    const kb = Math.round(statSync(out).size / 1024);
    total += statSync(out).size;
    console.log(`${id}-${w}.webp  ${kb} KB`);
  }
}
console.log(`done: ${ids.length * SIZES.length} files, ${(total / 1048576).toFixed(2)} MB`);
