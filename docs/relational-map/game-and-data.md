# Game and data

The rules of the game and the data they run on. Every game module
has its own entry in [inventory/game.md](inventory/game.md); the
design contract for this layer is `docs/architecture/`, especially
its [codebase map](../architecture/02-codebase-map.md).

## The rules layer (`src/game/`)

Pure TypeScript: no React, no browser, no database. Three files
carry most of the weight:

- `src/game/engine.ts` — state and actions. The `Save` type, the
  versioned sanitize-and-migrate path, the Zustand store the
  screens read, and the per-frame `sim` tick.
- `src/game/content.ts` — the data: the waters and their species,
  the rarity bands, the gear ladders, lures and baits, the weather,
  the mutations and the formulas that roll a fish.
- `src/game/modes.ts` — the mode framework: which modes exist, what
  each one's menu shows, and what is never shared between modes.

Around them sit the fishing model (spots, presentation, habits,
the match score, the tension fight), the gear and line rules, the
fun layer (the Regulars, the pet, stickers, Fish of the Day), and
the systems the later work packages added: difficulty, hazards,
Story, save slots, the Trophy Room, Survival and Recreational
trips.

## The content tables, in numbers

These are the numbers this map states about the code; each one is
listed in [counts.json](counts.json) and checked against the code
by `scripts/check-map-counts.mjs` on every `npm test`.

- The event table (`src/game/event-data.ts`) holds 16 long-play
  events in 6 rarities, and 8 holiday events with their own
  calendar rules (`src/game/holidays.ts`). An event's position in
  the table is also its mutation's index, so the table itself is
  never reordered; the Lodge's list renders a rarity-grouped view
  of it (`EVENTS_BY_RARITY`).
- The mutation table (`src/game/content.ts`) holds 22 mutations:
  the natural ones a rolled fish can carry, then one per long-play
  event.
- The achievement table (`src/game/achievements.ts`) holds
  52 achievements.
- The database has 7 migrations: the game's own tables under
  `migrations/`, plus the platform sign-in schema under
  `migrations/auth/`. Each migration has its own entry in
  [inventory/migrations.md](inventory/migrations.md).

## Modes

Expedition is the career; Story is the guided trip through the
waters; Recreational is fully separate, with its own book and
records; Survival keeps its own save and its daily board; Kid Mode
is a lens over the others (gentler words, speech, the Helping
Hand). Tournaments and co-op sit in the Lodge. The mode table in
`src/game/modes.ts` is the one source for all of it, and the
`docs-check:modes` marker in `docs/README.md` keeps the docs
honest about the list.

## Saves

- A save belongs to a mode and, for Expedition and Story, to one of
  several slots (`src/game/slots.ts`). The device copy is the
  working copy; the cloud copy (`src/game/cloud.ts` holds the rules
  both sides agree on) follows the account.
- Loading a save runs it through sanitize and the migration steps
  for its version; the fixtures under `src/game/__fixtures__/`
  are real saves from older versions that must always load, and
  `scripts/docs-check.mjs` pins the save version the docs state.
- The old test-phase reset (`src/game/epoch-gate.ts` on the
  device, `src/lib/test-reset.server.ts` on the server) is off by
  default: updates keep player data, and clearing is the player's
  own per-profile choice — see
  [server-and-accounts.md](server-and-accounts.md) and
  [docs/TEST-PHASE.md](../TEST-PHASE.md).
