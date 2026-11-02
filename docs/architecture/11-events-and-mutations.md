# 11 · Rare long-play events and mutations (WP-15)

Source: the owner's feedback (Caleb), "Events. Not weather events." Events are rare things that only happen once a player has been fishing for a long, unbroken stretch. Each one turns some of the fish caught while it runs into a named **mutation** that gives extra XP, extra sale value, or both.

Code: `src/game/event-data.ts` (the one table), `src/game/events.ts` (pure rules), `src/game/event-hooks.ts` (signals), `src/components/game/events.tsx` (banner, chip, Lodge list). Tests: `events.test.ts`, `events-flow.test.ts`, `save-migration.test.ts`.

## 1. The table (the only place numbers live)

Rarity rows (`EVENT_RARITIES`). Caleb fixed the multiplier; the rest are tunable.

| Rarity | Multiplier | Lasts | Fish that mutate | Chance to start at an hourly roll |
|---|---|---|---|---|
| Common | 2x | 10 min | 30% | 35% |
| Uncommon | 3x | 12 min | 25% | 30% |
| Rare | 5x | 15 min | 20% | 25% |
| Epic | 10x | 20 min | 15% | 20% |
| Legendary | 15x | 25 min | 12% | 15% |
| Mythic | 60x | 30 min | 10% | 25% |

Event rows (`EVENTS`). Caleb said the first event of each pair is an XP boost and the second a worth boost, and named the mutations; Snowfall (Chilly) is XP and Alien Invasion (Alien) worth by that pattern.

| Rarity | Event | Needs | Mutation | Boost | Condition |
|---|---|---|---|---|---|
| Common | Shooting Stars | 1 hr | Starlight | XP | night only |
| Common | Meteor Collision | 1 hr | Trembling | worth | none |
| Uncommon | Blood Moon | 2 hrs | Blood Red | XP | none |
| Uncommon | Meteorite Strike | 2 hrs | Stone Scales | worth | none |
| Rare | Snowfall | 3 hrs | Chilly | XP | none |
| Rare | Alien Invasion | 3 hrs | Alien | worth | none |
| Epic | Radioactive Rain | 4 hrs | Radioactive | XP | none |
| Epic | Northern Lights | 4 hrs | Mesmerized | worth | night only |
| Legendary | Divine Intervention | 6 hrs | Blessed | XP | none |
| Legendary | Armageddon | 6 hrs | Cursed | worth | none |
| Mythic | Legend of the Fisherman | 10 hrs | Fisherman's Dream | XP and worth | Astral Sea only |

"Night" means the game's time-of-day window is Night (`windowFor`): the picked time in a Recreational trip, otherwise the real clock or Night weather, as everywhere else in the game.

## 2. What "straight" means (decision)

The events clock counts **active play**: the tab is visible and the player did something (a tap, a key press or a cast) within the last **3 minutes** (`IDLE_MS`). The title screen does not count.

- Idle or hidden time is not counted but only **pauses** the streak.
- If the player is away (idle, hidden or the game closed) for more than **10 minutes** (`AWAY_RESET_MS`) the streak ends and the next one starts from zero with new dice.
- A reload or a tab switch inside 10 minutes keeps the streak. The clock is real time, kept per mode save (`events.lastAt` is saved, so a reload knows how long the game was closed).
- An event that is running keeps its wall-clock end time; it is over when the game opens again after that time.
- Survival and Tournament do not run the clock at all.

## 3. When events start (decision)

At each full hour of the streak there is **one roll**, never more (`events.rolled` remembers which hours have had theirs). The roll is skipped, and not made up later, if an event is running or the 30-minute cooldown after the last event (`COOLDOWN_MS`) has not ended. Only one event runs at a time.

The roll is `rollHour(seed, session, hour, conditions)`: a private generator built with `makeRng(seedFrom(save seed, "event", streak number, hour))`. It lists the events that are eligible (enough hours; night-only needs night; Astral-only needs the Astral Sea, both judged at the moment of the roll), tries the **rarest first**, and the first one whose start chance succeeds wins. Same seed, streak, hour and conditions always give the same answer, so tests can script 1h to 10h sessions on a fake clock. A new streak has a new streak number, so it rolls new dice.

## 4. Mutations

One list. `MUTATIONS` in `content.ts` already held Albino to Cosmic (indexes 0 to 5, rolled when a fish is born). The eleven event mutations are appended after them (indexes 6 to 16), built from `EVENTS`, with weight 0 so they are **never rolled naturally**, and two multipliers on each entry: `mult` for sale value and `xp` for XP. A worth event sets `mult` to its rarity multiplier; an XP event sets `xp`; the Mythic sets both. So `exhibitValue`, the fish book, the inventory, the dex "best mutation" and the save all keep working with the same `m` number they always used.

- **Who gets one.** Each fish caught while an event runs gets one draw from the event's own stream: `makeRng(seedFrom(save seed, "mutation", draw counter))`. It mutates with the rarity's "fish that mutate" share. Bosses and fish that already carry a rolled mutation are never changed.
- **Applied once.** The fish's sale value is multiplied once when it is mutated (`mutateFish`). XP is multiplied once in `catchXp` (the bonus of "+5 XP per step" is only for rolled mutations). Releasing a mutated fish uses the same `catchXp`, so the XP boost carries through. Fish of the Day, perfect hook and frenzy keep their own separate multipliers as before.
- **The book.** The dex keeps the better mutation (`betterMutation`: biggest XP times worth boost wins; ties keep the one already there).
- **Counting.** `events.fish[eventId]` counts mutated fish that landed.

## 5. Modes

| Mode | Events | Notes |
|---|---|---|
| Expedition | on | Full: XP and worth. |
| Local Co-op | on | Same as Expedition (one shared ledger). |
| Recreational | on | Its own streak, seen list and fish book. It has no money, so worth boosts are only a bigger number on the fish and its aquarium value; the XP boost works. |
| Kid Mode (a setting) | on | Gentler words: Blood Moon is "Ruby Moon" and its mutation "Ruby Red"; Armageddon is "Fire Sky" and Cursed is "Moonshadow". All visuals are the same friendly shapes. |
| Survival | off | Its own rules. The clock never runs, no mutation is applied. |
| Tournament | off | Scoring is replayed on the server from a seed. The events code never imports the shared `rng`, `loose` or `Math.random` (a test reads the source), the clock never runs in Tournament, and a test proves the live `rng()` stream is identical before and after a day of event dice. |

Switch is `eventModeOn(rules)` (a function of the mode table, like `funModeOn`); `modes.ts` is not touched.

## 6. What the player sees

- **Announcement:** a banner for 9 seconds, in plain English (for example "Shooting stars are crossing the sky! Some fish are glowing with starlight."), a toast, and a rising shimmer sound that climbs higher the rarer the event (`audio.event`).
- **Chip:** while an event runs, a small pill at the top of the water with the shape, the name and a countdown (m:ss).
- **Catch card:** a line under the fish name, "Starlight! 2x XP", "Trembling! 2x worth", "Fisherman's Dream! 60x XP and 60x worth", with a glassy chime (`audio.mutant`).
- **The fish:** each mutation has its own tint **and its own shape drawn around the fish** (star, shard, ring, snowflake, bolt, eye, cross, sparkle, crown, flame, drop), plus a halo ring, so colour is never the only clue. The fish book cell gets a foil edge in the mutation's hue (rolled mutations keep the rainbow foil).
- **Lodge, "Events":** every event with rarity, hours needed, mutation and effect. An event is a dark silhouette ("Not seen yet", "A secret event") until it has happened once. Hover, focus or tap shows the detail panel (needs, mutation, effect, times seen, mutated fish landed). Only in modes where events run.
- **Hint:** "Keep fishing. Something rare might happen in about 10 minutes." appears in the Events list only in the last 15 minutes before a roll, rounded up to 5 minutes, never says what, and is silent while an event runs or cools down.
- Mutated catches show in the fish book (foil, name), the aquarium and the inventory (the name carries the mutation) and keep the catch in the Recreational logbook as before. Records keep best weight only; they are not split by mutation.

## 7. Signals for other features (WP-16 achievements)

`src/game/event-hooks.ts`: `onEventStarted(fn)`, `onEventEnded(fn)`, `onMutatedCatch(fn)`. Each returns an unsubscribe function. `onMutatedCatch` gets `{ event, mutation, species, biome, value }` when a mutated fish lands. Seen events are `save.events.seen`.

## 8. Save (version 10)

`events` in the save (per mode slot): `seed`, `session`, `streakMs`, `lastAt`, `awayMs`, `rolled`, `cooldownUntil`, `active {id, startedAt, endsAt} | null`, `seen {eventId: n}`, `fish {eventId: n}`, `draws`. `sanitize()` clamps everything and drops unknown ids. Old saves start with an empty state. The dex and inventory `m` clamp widened from 5 to the end of the mutation list. Fixture: `save-v10.json`. No server migration (the server stores whole saves as JSON and verifies tournaments, which have no events).

## 9. Not in this package

Events do not change weather, bite rates or any fishing rule; they only change the fish after it has been rolled. Auto-fishing gets mutations too (at its usual 40% payout). Co-op player 2 shares the same event.
