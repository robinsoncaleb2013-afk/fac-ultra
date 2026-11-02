# What was built, and where it differs from the plan

Written for Caleb. Five minutes to read. Everything below has now been merged into `main` (nine packages plus the menu redesign). Each part was checked and green before it merged.

## The short version

The architecture documents in `docs/architecture/` were followed package by package (WP-1 to WP-9). Each pull request is one package from `08-work-packages.md`. Rules kept: one package = one PR, no heavy dependencies, Canvas 2D only, pure game rules in `src/game/`, saves with versioned fixtures, server logic through `getSql()` only.

## What went in (it was built as a stack; merged together as PR #15)

| Order | PR | Package | What it adds |
|---|---|---|---|
| 1 | #3 | WP-1 | Living water, mobile layouts, device tiers, art pipeline |
| 2 | #4 | WP-2 | 75 spots, rigs, 40 species habits |
| 3 | #5 | WP-3 | Hold-to-reel fights, keep/release, records |
| 4 | #6 | WP-4 | Mode framework, Recreational, Kid Mode |
| 5 | #8 | WP-5 | Survival mode (own save) |
| 6 | #11 | WP-6 + WP-7 | Fun layer; server-verified Tournaments (PR #9 is included here) |
| 7 | #12 | WP-8 | Lobby, live board, friends, teams, trophies |
| 8 | #13 | WP-9 | Optional sign-in, cloud saves, family profiles |
| 9 | #15 | extra | Menu redesign, graphics levels, full-screen; also fixes the self-hosted database build |

Docs-only PRs #7 (self-hosting plan) and #10 (project page record) were merged too. The earlier stacked PRs (#4 to #13) are closed because their work is in main.

## Where this differs from, or goes beyond, the plan

1. **Graphics levels.** The plan has three internal tiers. The self-hosting plan describes five named levels (Ultra, High, Medium, Low, Potato). The five levels sit on top of the three tiers; phone/tablet/desktop stays a separate idea. `03` and `09` are amended to say so.
2. **Menu redesign (new).** The menus are rebuilt as one tab strip with a large detail panel that updates on hover, a hold-to-open quick wheel and satchel, and a corner status display. Layout inspired by big-budget game menus; all art, icons and fonts are original.
3. **Friends.** The plan had friend codes. Added: add by player name or email (with Accept), plus Remove and Block. Codes still work. Communication stays emotes only; there is no typed chat.
4. **Full-screen play** on PC and phone, plus a Home Screen hint for iPhone.
5. **Google sign-in** (optional, hidden until keys are set) alongside the email link.
6. **Art cleanup** removed the old JPG fallback; the game loads WebP only.
7. **Recreational is fully separate (owner decision, 2026-11-02).** The plan said Recreational writes to the career collection and records. It does not. Recreational keeps its own fish book, stickers, records, logbook, Fish of the Day, pet and Regulars record, everything is unlocked from the start, and nothing in either mode reads or changes the other. Fish already merged into a career save by earlier builds stay there. See `05` section 11.
8. **Test-phase auto-reset (WP-13, new).** While the game is in testing, every new build wipes all progress and saves (this device's saves, cloud saves, tournaments, trophies, friend requests) and keeps accounts, family profiles, friends and device settings. One switch turns it off: `FAC_TEST_RESET=0`. Read [`docs/TEST-PHASE.md`](TEST-PHASE.md), including the checklist before real launch.
9. **Small decisions** where the documents were silent are written in each PR under "Spec decisions".

## Things only a person can check (nothing is blocked on them)

- Play on a real phone: touch feel, tap sizes, vibration, full-screen.
- Listen to the ambient sound; check water line and sun positions per painting.
- Real email delivery (needs a Resend key) and Google sign-in (needs a Google key).
- Two real devices on different networks for Tournaments and friends.
- A Neon database (everything was tested on the local PGlite database).

## How to undo any part

Most additions are separate screens or settings. The work is in one merge (PR #15), so the cleanest undo is reverting that merge; individual parts can be backed out by hand, newest first.
