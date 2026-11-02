# Biome paintings

Every water has two pictures here, both WebP (the game loads WebP only; there is no JPG fallback):

| File | Width | Used for |
|---|---|---|
| `<id>-1600.webp` | 1600 px (quality 78) | big stages (desktop, tablets) |
| `<id>-800.webp` | 800 px (quality 72) | the menu, phones, and lighter graphics |

`<id>` is the water's id (`pond`, `lake`, `river` ... see `BIOMES` in `src/game/content.ts`).
The first screen loads one 800 px painting (about 100 KB), well under the 1.2 MB budget.

## The originals

The full-size paintings (about 11 MB) live in **`art-src/<id>.jpg`** at the top of the repo. They are not under
`public/`, so the site never serves them. To rebuild every WebP from them:

```bash
node scripts/art-build.mjs            # build everything (needs `npm install`, which brings sharp)
node scripts/art-build.mjs --check    # list what is missing, change nothing
```

To add a water: drop `art-src/<id>.jpg`, run the script, commit the two new WebP files.
