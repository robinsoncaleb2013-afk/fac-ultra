# 06 · Multiplayer & Tournaments

Work packages **WP-7** (server-verified tournaments on Neon) and **WP-8** (lobby, live boards, friends' rooms, team events). Pillar 5: *fair when it counts*.

## 0. The idea in one paragraph

A tournament is a **seed plus rules plus a time window**. Everyone fishes the same water under the same weather sequence and the same fish rolls, because every roll comes from `seedFrom(eventId, playerId, castIndex)`. The client plays the game exactly as it does offline. For every catch it sends the server a tiny **envelope**: which cast, which spot, which rig, and the fight inputs. The server **replays** the cast with the same shared game code (`src/game/**` runs in Node) and accepts the catch only if the replay produces it. Scores on the board are therefore server-computed from verified catches. No trust in the client's numbers, no game server during play, no WebRTC needed for scoring. The existing P2P room engine stays for the *social* layer: seeing friends' boats, the live feed, emotes.

## 1. Server architecture (WP-7)

### 1.1 Tables (`migrations/tournaments/0002_tournaments.sql`)
```sql
create table events (
  id text primary key,                 -- "d-2026-11-02-pond" or "p-ABCD" (private)
  kind text not null,                  -- quick | daily | weekly | private | survival
  title text not null,
  water int not null,
  rules jsonb not null,                -- {category, castBudget, fishingSeconds, assist:false, gear:"fixed"|"own"}
  seed bigint not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by text,                     -- player id for private
  created_at timestamptz default now()
);
create table players (
  id text primary key,                 -- anon device id now; user id after WP-9 (same column)
  name text not null,
  created_at timestamptz default now(),
  banned_until timestamptz
);
create table entries (
  event_id text references events(id),
  player_id text references players(id),
  joined_at timestamptz default now(),
  casts_used int default 0,
  seconds_used int default 0,
  score numeric default 0,             -- server-computed, category-specific
  best_weight numeric default 0,
  species int default 0,
  primary key (event_id, player_id)
);
create table catches (
  id bigserial primary key,
  event_id text, player_id text, cast_index int,
  envelope jsonb not null,             -- what the client sent
  verdict text not null,               -- ok | mismatch | budget | rate | stale
  result jsonb,                        -- the server's replay: species, weight, value, released
  created_at timestamptz default now(),
  unique (event_id, player_id, cast_index)
);
create index on entries (event_id, score desc);
create table rooms (room text, peer text, name text, last_seen timestamptz, primary key (room, peer));
create table signals (id bigserial primary key, room text, "from" text, "to" text, kind text, payload jsonb, at timestamptz default now());
create index on signals (room, "to", id);
```

### 1.2 Routes (`src/routes/api/`)
| Route | Method | Does |
|---|---|---|
| `events.ts` | GET `?scope=open` | Upcoming + live events the player can join (materialises the schedule in §2 on demand, idempotent insert). |
| `events.ts` | POST `{op:"create", water, rules, minutes}` | Private event; returns code. Max 3 live per creator. |
| `entry.ts` | POST `{op:"join", eventId, playerId, name}` | Creates `entries` row; returns `seed`, `rules`, `serverNow`, the player's `castIndex` start (= casts_used). |
| `catch.ts` | POST `{eventId, playerId, envelope}` | **Verify + score** (§1.4). Returns verdict, the server's result, new score, board rank. |
| `board.ts` | GET `?eventId&top=25&around=playerId` | Leaderboard page: top N + the 5 rows around the player. Cached 5 s. |
| `rtc.ts` | existing | Switch storage from the `Map` to `rooms`/`signals` tables via `getSql()`. Same wire contract. Prune on each call. |
| `survival-board.ts` | GET/POST | Longest-run board for the daily Survival seed (`05` §5.2): client posts the run summary **and its event log**; server replays the run from the seed + log (same replay machinery). |

Identity before WP-9: `playerId = localStorage "fac-player-id"` (uuid v4) and a chosen display name, sent with every request. The server rate-limits by id **and** IP. Boards show a small "unverified name" dot until accounts land; WP-9 links the anon id to the account so history carries over.

### 1.3 The envelope
```ts
type Envelope = {
  castIndex: number;                     // monotonic per entry; server rejects reuse or gaps > 1
  at: number;                            // client ms; must be within [starts_at, ends_at] ± 30 s server-side
  spot: string; p: Presentation;         // what you chose
  hook: number;                          // ms after bite when you hooked (0..biteMax); -1 = missed
  inputs: number[];                      // fight input trace: alternating hold/release durations in 50 ms units, ≤ 600 entries
  drag: 0|1|2;
  released: boolean;
};
```
The envelope is ~1 KB worst case. The client builds it as it plays (`sim.trace`), posts it on `succeed()`/`fail()`, and **does not wait** for the reply to continue fishing (optimistic UI; a `mismatch` verdict later removes the catch from the local tournament tally with a toast "That catch didn't verify").

### 1.4 Replay (server, `src/game/replay.ts` — pure, shared with the client's tests)
```ts
export function replayCast(seed: number, event: Rules, env: Envelope): ReplayResult {
  setRng(makeRng(seedFrom(seed, env.castIndex)));            // same stream the client used for this cast
  const weather = weatherAt(seed, env.at - starts_at);         // deterministic weather schedule (§2.3)
  const window  = windowAt(event, env.at);                     // event-defined time of day
  const { fish, waitLeft } = rollCast(event.water, event.gear, env.spot, env.p, weather, window);   // from 04 §3.5
  if (env.hook < 0 || env.hook > biteMax(fish, event.gear)) return { verdict:"ok", result:{ missed:true } };
  const landed = simulateFight(fish, event.gear, env.inputs, env.drag, { assist:false });            // 04 §5.3, fixed 50 ms steps
  return { verdict:"ok", result: landed ? { species: fish.i, weight: fish.w, value: fish.v, released: env.released } : { lost:true } };
}
```
Because `rollCast` and `simulateFight` are the same functions the client runs, a legitimate client always matches. The server stores `result`, updates `entries` (score by category §2.1), and returns rank. Frame-rate independence is why the fight ticks at a **fixed 50 ms step** in both client and server (WP-3 must implement the fight tick as `stepFight(F, inputHeld, 0.05)` called from an accumulator in `frame()`).

### 1.5 Budgets and rate limits
- `rules.castBudget` (e.g. 60 casts) and `rules.fishingSeconds` (e.g. 900 s of fight+wait time): the server adds each verified cast's `waitLeft + fight length` to `seconds_used`; over budget → verdict `budget`, catch ignored, client told to stop.
- Rate: ≤ 1 envelope per 2 s per player; ≤ 40 requests/min per IP. Violations → `rate`; three in an event → `banned_until = now()+1h` on the player row.
- Clock: envelope `at` outside the window ± 30 s → `stale`.

## 2. Tournament design

### 2.1 Categories
| Category | Score | Tiebreak |
|---|---|---|
| **Big Fish** | heaviest single verified catch | second heaviest |
| **Total Weight** | sum of kept-or-released weights (release counts; conservation isn't punished) | fish count |
| **Species Sprint** | distinct species | time of last new species |
| **Value** (Expedition-flavoured) | sum of values with mutation multipliers | big fish |
| **Survival** | days survived on the daily seed | fish eaten |
| **Team** (WP-8) | sum of a room's Total Weight; 2–4 players, shared code | biggest fish |

### 2.2 Schedule (materialised by `events.ts` from a pure function `schedule(nowUtc)`)
- **Quick**: every hour on the hour, 10 minutes, water rotates through the 15, category rotates Big Fish → Total → Sprint. `castBudget 40`, own gear.
- **Daily**: midnight UTC, 24 h window, **fixed gear** (everyone gets rod 6 / reel 4 / line 4, lures: one of each family), `fishingSeconds 1200` so a kid with 20 minutes competes evenly with someone who has all day. Category: Big Fish Mon/Thu, Total Tue/Fri, Sprint Wed/Sat, Value Sun.
- **Weekly**: Monday–Sunday, Total Weight across **three waters** (one event row per water, board sums), own gear.
- **Survival daily**: `05` §5.2 seed; board is longest run.
- **Private**: 4-letter code, host picks water/category/length/gear policy; up to 16 players; board visible to the code only.

### 2.3 Deterministic weather
`weatherAt(seed, msSinceStart)`: a Markov chain stepped every 5 minutes from `makeRng(seedFrom(seed, "wx"))`, same transition matrix as Survival (`05` §5.4). Everyone sees the same rain at the same minute. During an event the client replaces `frame()`'s random weather roll with this function.

### 2.4 Fairness rules enforced by the rules table
`assist:false` always; Kid Mode text/reading features still apply (they don't touch play). Rebirth multipliers and Aquarium income don't count. Fixed-gear events ignore the player's loadout. Signature-lure effects *are* allowed in own-gear events (they're earned).

## 3. The live layer (WP-8)

### 3.1 Lobby
Menu card **Tournaments** → lobby drawer: tabs **Live** / **Upcoming** / **Private** / **History**. Each event row: water thumbnail, category icon, countdown, entrants, your rank if entered, **Join**. Joining travels you to the water in `tournament` mode (`05` §1: economy off, own tournament save key `fac-ultra-tourney`, HUD shows `timer`, casts left, your rank).

### 3.2 Board over the water
A collapsible board (desktop: top-right under the HUD bar, 280 px; phone: a Board tab) refreshed every 10 s from `board.ts`, with your row pinned. Rank changes animate (row slides). Top 3 get medal icons; rivals from `05` §6.1 fill empty slots in Quick events with simulated verified-style scores so a board is never empty.

### 3.3 Friends on the water
On Join, the client also joins a P2P room named `t-<eventId>` (the existing engine, Neon-backed relay). Peers' boats and a live catch feed appear as today's co-op does. Cap the mesh at **8 peers**; beyond that the client stays out of the mesh and only polls the board (full mesh is O(n²)). Add **emotes**: 8 preset phrases/stickers ("Nice fish!", "Big one on!", 🎣, 🐟, 😮, 👏, 🌧️, 🏆) sent on the reliable channel, shown as a bubble over the boat for 3 s. No free-text.

### 3.4 Team events
Private event with `rules.team:true`: the room code *is* the team; `entries` get a `team` column (migration `0003`), board groups by team. Local Co-op (J key) counts as one entry with two inputs — unchanged.

### 3.5 Results and rewards
At `ends_at` the client shows a results card (your rank, top 3, your best fish) from `board.ts?final=1`. Rewards never add power: **trophies** (Lodge → Trophy Shelf, drawn like Aquarium pedestals), a title ("Pond Champion · Nov 2"), and a cosmetic bobber skin per medal. The Lodge **Record** view gains "Tournament history" from `entries`.

## 4. Unverified checklist (write these in the PR, don't block on them)
- Two real homes behind consumer NAT connecting via STUN only (the TURN contingency in `EXPANSION-DESIGN.md` §7 stands).
- Vercel cold-start latency on `catch.ts` under a 100-player Quick event (load-test later with k6 from a dev machine).
- Neon compute waking on the first join of the day (expected ≤ 1 s; show a "Finding the water…" spinner).

## 5. Tests
- `replay.test.ts`: record 200 scripted casts client-side (seeded), replay server-side, 100 % match; mutate one input duration → mismatch; shift `castIndex` → rejected.
- `schedule.test.ts`: `schedule()` is a pure function of time — same input, same events; every hour has exactly one Quick; dailies rotate categories as §2.2.
- `weather.test.ts`: `weatherAt` deterministic; distribution over 10,000 steps is within 5 % of the Survival matrix's stationary distribution.
- Route tests with PGLite (no Neon needed): join → 3 catches → board shows the right score and rank; rate limit trips on the 2nd envelope within 2 s; budget trips at `castBudget+1`.

## 6. Done when
- **WP-7**: tables, five routes, Neon-backed relay, envelope recording in the client, replay verification, categories Big Fish / Total / Sprint / Value / Survival, schedule materialisation, deterministic weather in events, rate limits and budgets, tests in §5 green on PGLite, anon identity with name, `tournament` mode in `modes.ts`.
- **WP-8**: lobby drawer, live board with pinned row and animations, rivals filling empty Quick boards, P2P room per event with 8-peer cap and emotes, team events, results card, trophy shelf, titles, bobber skins, Tournament history in the Lodge.
