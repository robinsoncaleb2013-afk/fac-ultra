# FAC Ultra page rules — what belongs on the website, and what doesn't

These rules are specific to **this game** and its page at
www.robinsonaisystems.com/caleb/fac-ultra. They sit on top of the general
playbook (`AGENT-PLAYBOOK.md` in this folder). The general package travels
to Caleb's other projects one day; this file does not — it is FAC Ultra's
own editorial judgment, written down so every agent applies the same one.

*How* judged content reaches the page is not this file's job: game news
flows through the record (`docs/project-page.md`) and the playbook's W1
signal; changes to the section itself (layout, styles, pages) go through
Caleb's fork of the website repo under the playbook's W7 and that repo's
`docs/caleb` guide. These rules judge *what belongs*; those documents
carry *how it gets there*.

## The one-sentence rule

**The page is a storefront window, not a changelog.** A change belongs on
the page when it changes what a player can do, catch, explore, or play —
and only then.

Test for any candidate item: *"Would a friend landing on this page for
the first time care?"* If not, it stays in the repo and off the page.

## Worth an Updates entry (milestones only)

- A new water or area opens, or a new batch of species lands
- A new game mode becomes playable, or a big system arrives (the
  aquarium, contracts, rebirth — that size of thing)
- A boss or boss lair set ships
- The game becomes playable in a new way or place, or hosting changes
  in a way players would actually feel
- A real milestone moment: first public launch, a tournament running
  for real, the game coming back from a pause
- Status changes (paused / back)

## Never on the page

- Bug fixes — unless a notorious, player-hitting bug is finally dead;
  then one line, framed as the improvement, not the fix
- Balance tweaks and number tuning, refactors, cleanups, test / CI /
  build / dependency changes — the plumbing is invisible to players
- Work in progress and planned features. Survival fishing and
  server-scored tournaments graduate to the page **the day they are
  playable**, not before. (One exception: a single "working on…" line
  for one headline feature that is close — at most one at a time, and
  it comes off when the feature lands or stalls.)
- Session-by-session progress. Small wins get **batched** into the next
  milestone entry, never posted one by one.

## Features list hygiene

- The list describes the game **as it plays today** — nothing planned,
  nothing removed.
- Keep it tight: roughly **8–10 bullets maximum**. Adding a bullet that
  would crowd the list means merging related bullets or dropping the
  least interesting one. A short, strong list beats a complete one.
- Any number on the page (waters, species counts) must be true of the
  current build — recount before changing it.
- When a feature is cut from the game, it leaves the list in the same PR.

## Cadence

- Update `docs/project-page.md` when a milestone lands — in the same PR
  when practical, a small docs PR right after when not.
- If nothing milestone-sized happened, **the page does not change**. A
  quiet page is a correct page; do not manufacture updates to look busy.
- The record keeps the full Updates history (it is the archive); the
  website shows the recent entries. Don't prune the record's history.
- Screenshots: add one for a milestone moment (a new water, a new mode).
  Replace rather than accumulate — two or three good shots, not twenty.

## How to write an entry

One or two sentences, for players and friends, not developers:

- ✅ "The swamp is open — new waters to fish, new species to catch, and
  something big waiting in the deep end."
- ❌ "Shipped biome system v2: refactored spawn tables, added 14 species
  entries to the data layer, fixed lure persistence."

Same news. The first one makes somebody want to play it.
