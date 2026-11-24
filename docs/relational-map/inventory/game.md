# Inventory — game modules

Every module in `src/game/` (the rules layer: pure TypeScript, tested beside the code). Test files (`*.test.ts`) and the saved-game fixtures under `src/game/__fixtures__/` are not modules and are not listed.

- **achievements** (`src/game/achievements.ts`): Achievements (architecture 12 §6): a table of plain-English goals, each watching a number the game keeps or a check on the save; the counters and the room's view of them.

- **ambience** (`src/game/ambience.ts`): Ambience (architecture 05 §6.5): which ambient loop plays, how loud, and what the sky adds.

- **art** (`src/game/art.ts`): The painting loader: which biome art file to load for a water, at which of the two sizes, and how it fits the canvas (the WebP paintings in public/art).

- **assist** (`src/game/assist.ts`): Helping Hand: the catch assist for Kid Mode and anyone who wants it — when it offers help during a fight and what that help does.

- **audio** (`src/game/audio.ts`): All sound: the WebAudio synth (every effect is synthesized; there are no sound files) plus the lazy player for the ambient loops.

- **cloud** (`src/game/cloud.ts`): The rules of cloud saves that the server and the browser must agree on (architecture 07 §4): what a save may contain, how clashes settle, and the backup window behind Clear my data.

- **content** (`src/game/content.ts`): THE DATA: the waters, the species, the rarity bands, the gear ladders, lures, baits, weather, mutations, and the formulas that roll a fish.

- **device** (`src/game/device.ts`): Device class and graphics tier (architecture 09 §1): what the game thinks the device can handle.

- **difficulty** (`src/game/difficulty.ts`): Difficulty (architecture 12 §2): the five levels for the career, chosen once when a save slot is made and fixed for that slot.

- **engine** (`src/game/engine.ts`): State and actions: the Save type, the versioned sanitize-and-migrate path, the Zustand store the screens read, and the per-frame sim tick.

- **epoch-gate** (`src/game/epoch-gate.ts`): TEST PHASE (browser): when the build changes, forget this device's progress before the game loads any save (docs/TEST-PHASE.md).

- **event-data** (`src/game/event-data.ts`): The long-play events: ONE data table (architecture 11) — the rarities, the events, the holiday events and every timing number a designer might tune.

- **event-hooks** (`src/game/event-hooks.ts`): Signals other features can listen to (achievements, sounds, the logbook). Plain functions, no store.

- **eventroom** (`src/game/eventroom.ts`): The tournament event room on the client: joining a room, its catch feed, and the blocked-name list.

- **events** (`src/game/events.ts`): Rare long-play events and the mutations they hand out (architecture 11): the hourly roll, eligibility, and the grouped-by-rarity list the Lodge renders.

- **fight** (`src/game/fight.ts`): The fight: a tension-and-position game once a fish is hooked (architecture 04 §5).

- **fightroom-live** (`src/game/fightroom-live.ts`): The live layer of the fish-fight rooms: joining the server's fight queue, readying up, ticking the fight and sending room chat (Update Three).

- **fightroom** (`src/game/fightroom.ts`): Fish-fight rooms (Update Three): the pure match and chat machine — two real anglers, one tank; its pairing, seed and room-name rules are the ones the server queue runs. No store, no network.

- **fill** (`src/game/fill.ts`): Regulars on an empty board (architecture 06 §3.2, 05 §6.1): the named anglers who fill a quiet event.

- **fish-draw** (`src/game/fish-draw.ts`): The procedural fish artist: builds every fish from body archetypes and per-species traits and draws it on canvas — no fish pictures exist.

- **fotd** (`src/game/fotd.ts`): Fish of the Day (architecture 05 §6.4): the daily featured fish and its bonus.

- **fullscreen** (`src/game/fullscreen.ts`): Full-screen play (architecture 09 §6): pure helpers over small structural types, so tests can hand in fakes.

- **fun** (`src/game/fun.ts`): The fun layer's saved fields (architecture 07 §1): stickers, shinies, the daily pieces each mode keeps its own copy of.

- **gear-rules** (`src/game/gear-rules.ts`): Gear progression rules: who may buy what (architecture 10 §2) — the level, map and boss gates on rods, reels, boats and packs.

- **graphics** (`src/game/graphics.ts`): What the water draws at each graphics tier, and the small pure rules behind the fps governor.

- **habits** (`src/game/habits.ts`): What every species does (architecture 04 §3.2): the behaviour table behind how fish bite and fight.

- **hazards** (`src/game/hazards.ts`): Hardest-difficulty hazards (architecture 12 §3): the dangers of Legend, in ONE data table so each can be tuned.

- **holidays** (`src/game/holidays.ts`): Holiday events (Update Three): the pure local-calendar rules behind the HOLIDAYS table in event-data.ts — windows, multipliers, the New Year burst.

- **hubcopy** (`src/game/hubcopy.ts`): The words on the pause menu (the Hub): plain English for a stranger or a kid — short sentences, no internal names.

- **hubnav** (`src/game/hubnav.ts`): Navigating the Hub with keys and a gamepad, and the keyboard shortcuts (architecture 09 §2.3).

- **hubstate** (`src/game/hubstate.ts`): Which part of the menu (the Hub: the main menu outside a game, the in-game menu inside one) is open.

- **keep** (`src/game/keep.ts`): Keep or release (architecture 04 §6): the conservation loop — what keeping and releasing each pay.

- **kid** (`src/game/kid.ts`): Kid Mode (architecture 05 §4): a lens on top of any mode — gentler words, speech, and the rules the Helping Hand follows.

- **leave** (`src/game/leave.ts`): Leaving a game for the main menu: what is going on in, and the plain-English question to ask. Pure.

- **line-wear** (`src/game/line-wear.ts`): Line wear: the line has health, and a hooked fish drains it (architecture 10 §1); also carries the tournament rules version.

- **lines** (`src/game/lines.ts`): Lines: health, line packs and the workshop (architecture 10 §1) — where lines come from now that they are not sold.

- **match** (`src/game/match.ts`): How well a cast fits the fish (architecture 04 §3.3–3.6, §4): the match score behind every bite.

- **modes** (`src/game/modes.ts`): The mode framework (architecture 05 §1): the mode table, each mode's menu tabs, and what is never shared between modes.

- **multiplayer** (`src/game/multiplayer.ts`): Co-op glue over the WebRTC mesh: room codes, presence (water and name) and the shared catch feed. Client-authoritative by design.

- **night** (`src/game/night.ts`): Night fishing (Update Three): solo, away-from-keyboard fishing — the unlock, the overnight catches and the welcome-back settle.

- **pbroom** (`src/game/pbroom.ts`): The Trophy Room (architecture 12 §8): your personal bests, one plaque per kind of fish; it reads the records, it never writes them.

- **peek** (`src/game/peek.ts`): A read-only look at a saved mode, for the main menu's Collections tab.

- **pet** (`src/game/pet.ts`): The pet companion (architecture 05 §6.2): what it does while you fish and how it cheers.

- **presentation** (`src/game/presentation.ts`): What is on the line and how it is fished (architecture 04 §3.1): rigs and how a cast is presented to the fish.

- **prestige** (`src/game/prestige.ts`): Prestige (Update Three): reaching the top level earns a prestige level, which unlocks the final water; prestige survives Rebirth.

- **probe** (`src/game/probe.ts`): The start-up speed test (architecture 09 §1.4): the measured frame rate is the main signal for Auto graphics.

- **promo** (`src/game/promo.ts`): Promo codes (Update Three): the code table, the rewards, and once-per-save claiming.

- **rarity** (`src/game/rarity.ts`): Rarity shapes and the colour-blind palette (architecture 05 §6.6): colour is never the only clue.

- **records** (`src/game/records.ts`): Records: your best fish of every species, with the whole story of how you got it.

- **replay** (`src/game/replay.ts`): Replaying a cast (architecture 06 §1.3–1.4): the deterministic replay the server runs to check a tournament score.

- **rivals** (`src/game/rivals.ts`): The Regulars: the twelve named anglers who fish the Derby against you (architecture 05 §6.1).

- **rng** (`src/game/rng.ts`): Seeded randomness (architecture 04 §1): the one dice stream, so a cast can be replayed exactly.

- **safe** (`src/game/safe.ts`): Kid-safe names (architecture 06 §3): the filter room chat and player names pass through.

- **schedule** (`src/game/schedule.ts`): The tournament calendar (architecture 06 §2.2): which events run when, and their budgets.

- **scoring** (`src/game/scoring.ts`): How a tournament entry is scored (architecture 06 §2.1) — the same code on the client and the server.

- **slots** (`src/game/slots.ts`): Save slots (architecture 12 §5): Expedition and Story each have several saves; every other mode keeps one.

- **social** (`src/game/social.ts`): The social layer of tournaments (architecture 06 §3): emotes, the peer-mesh caps, teams and presence.

- **spatial** (`src/game/spatial.ts`): Arrow-key focus movement by position on screen: the next thing up, down, left or right of the one you are on.

- **spots** (`src/game/spots.ts`): Named cast targets on every painting (architecture 04 §2): where on the water a cast can aim.

- **stack** (`src/game/stack.ts`): Mutation stacks (Update 4): a released mutant may come back with one more mutation, at diminishing odds, with additive stats.

- **stickers** (`src/game/stickers.ts`): Sticker dex and shiny fish (architecture 05 §6.3).

- **story** (`src/game/story.ts`): Story mode (architecture 12 §4): a guided trip through the waters — each water a chapter with its own goals.

- **survival** (`src/game/survival.ts`): Survival Fishing rules (architecture 05 §5): days, hunger, the camp, and rescue.

- **tourney** (`src/game/tourney.ts`): The client's side of a tournament (architecture 06 §1.3, §3): who you are, talking to the server, joining and submitting.

- **trips** (`src/game/trips.ts`): Recreational trips (architecture 05 §3): the trip rules for the mode that keeps its own book.

- **tutorial** (`src/game/tutorial.ts`): The guided voice tutorial (Update Three): the steps are performed, not clicked through; the first catch is always a bluegill.

- **water** (`src/game/water.ts`): Where the water starts in each painting, and where its light comes from.

- **weather** (`src/game/weather.ts`): Deterministic event weather (architecture 06 §2.3): the same weather for everyone in an event.
