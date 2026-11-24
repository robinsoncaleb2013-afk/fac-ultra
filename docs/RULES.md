# Rules

## Relational map rule

Relational map rule: every feature built or changed refreshes
docs/relational-map/ in the same change; a feature is not landed
until the diagram matches the code.

(Adopted fleet-wide by Chris, 2026-11-18, and extended to this
repository by Chris, 2026-11-23. The map lives in
`docs/relational-map/`, pointed to by `docs/MAP.md`.)

## Numbers in the map are checked against the code (MAP-COUNTS-1, 2026-11-18)

Every number the map states about the code is listed in `docs/relational-map/counts.json` with how to count
it. `scripts/check-map-counts.mjs` runs first in `npm test`, so the checks fail when the code and the map
disagree, when a map file states a count that is not listed, or when a count is approximate.

## Every module, component, server file, route, migration and script has its own map entry (MAP-INVENTORY, 2026-11-21)

`docs/relational-map/inventory/` (game.md, components.md, server.md, api.md, migrations.md, scripts.md) lists
each item once, as `- **name** (`path`): what it does`, with a blank line between entries. A change adds or
edits only its own items' entries, so two pull requests about different things never collide there.
`scripts/check-map-inventory.mjs` runs in `npm test`: it fails when an item has no entry, an entry names
something that no longer exists, or an entry has no real description. The map no longer states how many of
each there are, so adding one never touches a shared number.
