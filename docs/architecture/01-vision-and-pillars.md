# 01 · Vision and Pillars

> **As built (through WP-16).** The pillars are the rules the code was built against and they still stand. How each one landed: (1) the water is the game: the Hub menus slide over a live painting; (2) knowing fish pays: habits and the match score exist (`04`); (3) challenge that bends: Helping Hand, Kid Mode and, since WP-16, five difficulty levels chosen per save, Recreational gentle, Survival harsh, Tournaments fixed (`12`); (4) smooth on any device: five graphics levels with an fps governor (`09`), real-device speed unverified; (5) fair when it counts: tournaments are replayed on the server and versioned (`06`, `10`). The three audiences and "what the game is not" are unchanged. Open questions are in `../KNOWN-GAPS.md`.

## Who it's for

FAC Ultra grows from a painted incremental into **a fishing game that fishing people recognise**, played mainly in a PC browser, often by a parent and a kid at the same screen or across two houses.

Three players sit at the center of every decision:

- **The enthusiast** — fishes for real. Knows that bass hold on structure, that a cold front shuts the bite down, that you fish a crankbait differently from a jig. Wants the game to reward *knowing fish*, not just clicking faster. Wants real-sounding species, honest weights, records that mean something.
- **The kid (7–12)** — wants a splash, a fight and a fish on the screen every few minutes. Wants to *win*, but a win that was too easy is boring within a day. Reads short sentences, not paragraphs.
- **The friends** — two to eight people who want to fish the same lake at the same time and argue about who caught the biggest. Wants a tournament that's fair and a leaderboard that can't be cheated by editing a save file.

The game already has the bones (a working catch loop, 375 species, bosses, an aquarium, a WebRTC room engine). This chapter adds **depth for the enthusiast**, **a kid lane that never blocks them**, and **competition that holds up**.

## The five pillars

Every feature, screen and number must pass these.

### 1. The water is the game
The painting fills the screen. The HUD floats over it. Everything that matters during a cast happens *on the water*: where you aim, the bobber, the fish you're fighting, the tension ring. Menus slide over the water and slide away. No feature may push the water into a strip again.

### 2. Knowing fish pays
Species have habits: where they hold, when they feed, what they'll hit, how they fight. A player who learns that **catches more and bigger fish** than one who doesn't. Luck still exists; knowledge beats it. Every habit the game simulates is written in the dex in plain English so a kid can learn it too.

### 3. Challenge that bends, never breaks
Difficulty adapts to the player in the moment (Helping Hand) and to the mode (Recreational is gentle, Survival is harsh, Tournaments are fixed and fair). A player should fail sometimes, and know *why* — the message always names the cause ("You set the hook too late", "That fish wanted a slower retrieve").

### 4. Smooth at 60, light on the wire, on whatever they own
60 fps on a five-year-old laptop's integrated graphics *and* on a mid-range Android phone. One website: the page detects the device and picks the layout and graphics tier itself — PC gets every effect, phones get a lighter tier that still looks like the same game, nobody downloads a different app. First paint under 1.5 s on a 20 Mbps connection (2 s on a phone). No WebGL engine, no asset downloads the player isn't about to look at. Budgets are in `03` §7 and `09` §1–5 and are acceptance criteria.

### 5. Fair when it counts
Anything that goes on a shared leaderboard is scored on the server from a server-issued seed and a replayable envelope of player inputs. Casual play stays client-side and instant; competition is verified. No feature may put a client-trusted number on a public board.

## What the game is not

- Not a realistic sailing or boating sim. Boats are gear, not vehicles.
- Not a 3D game. The paintings are the art; code draws the fish and the water's life on top of them.
- Not pay-to-win. There is no store for real money in this design.
- Not a chat app. Multiplayer has presence, a catch feed, emotes and tournament boards. No free-text chat between strangers (friends' rooms by code may get a short preset-phrase set; see `06`).

## Tone

Warm, outdoorsy, a little wry. The game talks like a good fishing guide: short, confident, encouraging, specific. "Bass hold on the shady side of the dock after noon." Never "Luck +12%".
