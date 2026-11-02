# What was built, and where it differs from the plan

Written for Caleb. Ten minutes to read. Everything below is merged into `main` (sixteen packages, WP-1 to WP-16, plus a documentation check, WP-17). Each part was checked and green before it merged. Last updated after WP-16.

## The short version

The architecture documents in `docs/architecture/` were followed package by package. Rules kept: one package = one PR, no heavy dependencies, Canvas 2D only, pure game rules in `src/game/`, saves with versioned fixtures, server logic through `getSql()` only. After the first nine packages your feedback came in two rounds and became WP-10 to WP-16 (menus, Recreational on its own, the test phase, the line and gear rules, events, difficulty and Story). The live status of every package, with known gaps, is the table at the top of [`architecture/README.md`](architecture/README.md); everything nobody could check yet is in [`KNOWN-GAPS.md`](KNOWN-GAPS.md).

## What went in

The first nine packages were built as a stack and landed together as PR #15; everything after was its own pull request.

| Order | PR | Package | What it adds |
|---|---|---|---|
| 1 | #3 | WP-1 | Living water, mobile layouts, device tiers, art pipeline |
| 2 | #4 | WP-2 | 75 spots, rigs, species habits |
| 3 | #5 | WP-3 | Hold-to-reel fights, keep/release, records |
| 4 | #6 | WP-4 | Mode framework, Recreational, Kid Mode |
| 5 | #8 | WP-5 | Survival mode (own save) |
| 6 | #11 + #9 | WP-6 + WP-7 | Fun layer; server-verified Tournaments |
| 7 | #12 | WP-8 | Lobby, live board, friends, teams, trophies |
| 8 | #13 | WP-9 | Optional sign-in, cloud saves, family profiles |
| 9 | #15 | WP-10 | Menu redesign (the Hub), five graphics levels, full screen; also fixes the self-hosted database build |
| 10 | #18 | WP-11 | Recreational is completely separate from the career |
| 11 | #19 | WP-13 | Test phase: every new build resets progress |
| 12 | #20 | WP-12 | Two-level menu: a main menu outside the game, a menu for each mode |
| 13 | #21 | WP-15 | Rare long-play events and fish mutations |
| 14 | #22 | WP-14 | Line health and crafting, gear rules |
| 15 | #23 | WP-16 | Difficulty, Story, Legend dangers, Kids book, three save slots, achievements, trophy room |

Docs-only PRs #7 (self-hosting plan), #10 (project page record), #14 and #16 (this summary) were merged too. The earlier stacked PRs (#4 to #13) are closed because their work is in `main`.

## Where this differs from, or goes beyond, the plan

1. **Graphics levels.** The plan has three internal tiers. The self-hosting plan describes five named levels (Ultra, High, Medium, Low, Potato). The five levels sit on top of the three tiers; phone/tablet/desktop stays a separate idea. `03` and `09` are amended to say so.
2. **Menus, twice over.** WP-10 replaced the plan's rail, drawer and bottom tabs with one tab strip, a large detail panel that updates on hover, a hold-to-open quick wheel and satchel, and a corner status display. Your feedback ("Play should be what you see first") then split it in two (WP-12): see item 9.
3. **Friends.** The plan had friend codes. Added: add by player name (type-ahead) or email (with Accept), plus Remove and Block. Codes still work, and are still instant and mutual for people sitting together. Communication stays emotes only; there is no typed chat.
4. **Full-screen play** on PC and phone, plus a Home Screen hint for iPhone (Safari has no full-screen for web pages).
5. **Google sign-in** (optional, hidden until keys are set) alongside the email link. The accounts are the game's own, not the sandbox's built-in sign-in, which is left untouched.
6. **Art cleanup** removed the old JPG fallback; the game loads WebP only. The originals are in `art-src/`.
7. **Recreational is fully separate (owner decision, 2026-11-02, WP-11).** The plan said Recreational writes to the career collection and records. It does not. Recreational keeps its own fish book, stickers, records, logbook, Fish of the Day, pet and Regulars record, everything is unlocked from the start, and nothing in either mode reads or changes the other. Fish already merged into a career save by earlier builds stay there. See `05` section 11.
8. **Test-phase auto-reset (WP-13, new).** While the game is in testing, every new build wipes all progress and saves (this device's saves, cloud saves, tournaments, trophies, friend requests) and keeps accounts, family profiles, friends and device settings. One switch turns it off: `FAC_TEST_RESET=0`. Read [`TEST-PHASE.md`](TEST-PHASE.md), including the checklist before real launch. The switch is **on** today.
9. **Main menu vs in-game menu (WP-12, your feedback).** WP-10 put every tab on the title screen, so you could sell fish from the main menu. Now the main menu (Play, Collections, Friends, Account, Settings) is outside any game and changes nothing, and each mode has its own in-game menu with its own tabs (selling and shopping only in Shop & Sell, only in modes with money). Where things moved: Tackle's buying and the sell buttons are in Shop & Sell; Camp and the Larder are Survival tabs; the Logbook and Collection are Recreational tabs; Derby, Aquarium and online rooms are Expedition's Lodge (with shortcuts on mode select); "Title screen" became Leave; friends adding and blocking is on the main menu, with a short friends list in the game. See `09` section 2.5 and `05` section 12.
10. **Line health, crafting and gear rules (WP-14, from your feedback).** Lines have health that fish wear down while you fight (1, 2, 3, 5, 10, 15 percent per second by rarity; the 3 for rare fish is a guess because the feedback skipped it), are no longer sold, and come from packs and are crafted from spares, capped by level and bosses. Rods, reels, boats, lure packs and maps now have level, map and boss requirements and cannot be skipped. Tournaments record a rules version (now 2) so old events still verify. Existing gear stays owned. See `10`.
11. **Rare long-play events and mutations (WP-15, from your feedback, not in the original plan).** After one to ten hours of unbroken play a rare event can start (eleven of them, from Shooting Stars to Legend of the Fisherman). While one runs, some fish become named mutations worth extra XP, extra money, or both. Off in Survival and Tournaments (events never touch the server's replay). Kid Mode gets gentler names. See `11`.
12. **Difficulty and Story (WP-16, new).** Five levels (Super Easy, Easy, Normal, Hard, Legend) picked when an Expedition slot is made and fixed for that slot. Story is a new mode: fifteen chapters, one per water, always on Easy. Hard has a small taste of Legend's dangers; Legend can lose you lures, rods, your boat, your wallet and tank fish, and sues you when the aquarium disappoints. Dangers only run in Expedition. See `12`.
13. **Kids book (WP-16).** Fish caught in Kid Mode, and on Super Easy, go in a separate Kids book and never into your main fish book.
14. **Three save slots (WP-16)** for Expedition and Story, each with its own name and its own cloud copy. The cloud reuses an existing column for the slot, so there was no database change.
15. **Achievements and a trophy room (WP-16).** Fifty achievements and a plaque room built from your records.
16. **Keep or release waits for you (WP-16).** You cannot cast again until you choose.
17. **Every tournament uses the same fixed gear** (rod 6, reel 4, line 4). The plan allowed "own gear" for Quick and Weekly events; the build kept all of them fair and fixed.
18. **How the fish are picked.** The plan multiplied a species' chance by one plus 0.55 per match point; the build uses a smoother curve with a bonus for near-perfect rigs (numbers in `content.ts`). The no-bite hint appears after 3 seconds (1.9 in Kid Mode) instead of 8 and 5, because the longest wait is about 5 seconds.
19. **Small decisions** where the documents were silent are written in each PR under "Spec decisions".

## Things only a person can check (nothing is blocked on them)

- Play on a real phone: touch feel, tap sizes, vibration, full-screen; an iPhone Home Screen copy.
- Listen to the ambient sound and the event chimes; check water line and sun positions per painting.
- A gamepad on the menus.
- Real email delivery (needs a Resend key) and Google sign-in (needs a Google key).
- Two real devices on different networks for Tournaments and friends.
- A Neon database (everything was tested on the local PGLite database).
- Whether the numbers feel fair: Legend's dangers, line wear, level gates, event chances.

The full list, with how to check each one, is [`KNOWN-GAPS.md`](KNOWN-GAPS.md).

## How to undo any part

The first nine packages and the menu redesign are one merge (PR #15), so the cleanest undo for those is reverting that merge. Everything since is its own merge (#18 to #23): revert the newest first. Packages that changed the save version (WP-15, WP-14, WP-16) are the ones to be careful with: a save made after the change carries fields an older build does not know.
