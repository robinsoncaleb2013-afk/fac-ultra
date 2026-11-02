# FAC Ultra — Expansion Design & Roadmap

*More fish, living water, a money-making aquarium, boss fish, five new biomes, and real multiplayer — designed against the game as it actually exists in this repo.*

Prepared 2026-11-01 · Grounded in the repository at main `dc8258a` · Every "today" figure below was read from the game's own code.

## 1. Where the game stands today

FAC Ultra is already a real game, not a skeleton: a full catch loop with a strike minigame, 5 rarities, 6 mutations (Albino up to Cosmic at 60× value), weather that changes luck and bite rate, contracts, a dex that tracks count / total weight / best weight per species, an auto-fisher upgrade, and rebirth. Three facts shape everything in this design:

- **The 20th fish in every biome is already a legendary capstone** (Pond King, River Wraith, Lake Leviathan…). The boss system doesn't invent a new slot — it promotes the fish that is already sitting there.
- **Fish are drawn by code, not from picture files.** A procedural canvas artist (`fish-draw`) builds every fish from 6 body archetypes and per-species traits. New fish are cheap to add — and a focused art pass can make the whole game look richer without painting 375 pictures.
- **The online multiplayer engine already exists.** This repo contains a finished WebRTC peer-to-peer room library (full mesh, room-based, signaled through the app's own `/api/rtc` relay). It was never wired into a menu or a game mode. Online co-op is a wiring job, not an invention.

| System | Today | This design | Notes |
|---|---|---|---|
| Fish species | 200 | **375** | Every biome grows 20 → 25 species |
| Biomes | 10 | **15** | 5 new: Mangrove, Canyon, Kelp Forest, Sunken City, Astral Sea |
| Boss fish | 0 (10 legendaries) | **15 bosses** | One per biome, dex-gated, staged fights |
| Stages per biome | 1 | **4** | Shallows → Open Water → Deep Run → Boss Lair |
| Rods / Reels / Lines / Boats | 20 / 10 / 8 / 6 | **28 / 14 / 12 / 9** | New top tiers themed to the new biomes |
| Lures | 50 (procedural) | **50 + 24 signature** | Signature lures carry real effects; plus a new bait slot |
| Fish body archetypes | 6 | **12** | + turtle, squid, seahorse, angler, crab, jelly; pattern layer |
| Aquarium / exhibit | — | **New** | Offline income, showcase slots, upgrades |
| Game modes | 1 | **6** | Expedition, Sandbox, Local Co-op, Online Co-op, Derby, Boss Rush |
| Save | localStorage | localStorage v3 | + offline settlement, export/import code; cloud save last phase |

## 2. The world grows: 15 biomes, 375 fish

Each biome holds **25 species**: 9 common, 7 uncommon, 5 rare, 3 epic, and the boss. Five new species join each existing biome (roughly one per rarity band), and the five new biomes arrive complete. Sample species for the new biomes set the flavor; full 25-fish lists are written during the content phase, in the game's existing naming voice.

| Biome | Unlock price | Boss fish (slot 25) | Flavor — sample new species |
|---|---|---|---|
| Pond | 0 | **Pond King** | Existing 20 + 5 new |
| River | 250 | **River Wraith** | Existing 20 + 5 new |
| Lake | 1,000 | **Lake Leviathan** | Existing 20 + 5 new |
| Swamp | 4,000 | **Swamp Hydra** | Existing 20 + 5 new |
| **Mangrove (new)** | 8,000 | **The Rootmother** | Archerfish, Fiddler Crab, Mangrove Jack, Horseshoe Crab, Mud Lobster, Canopy Tetra, Banded Krait, Snook Pup |
| Coast | 12,000 | **Great White** | Existing 20 + 5 new |
| **Canyon (new)** | 30,000 | **Old Scarface** | Desert Pupfish, Gila Trout, Razorback Sucker, Canyon Carp, Sunbleak, Dust Koi, Cliff Eel, Vulture Catfish |
| Reef | 40,000 | **Reef Titan** | Existing 20 + 5 new |
| **Kelp Forest (new)** | 90,000 | **The Verdant Maw** | Garibaldi, Kelp Bass, Sheephead, Sea Urchin, Bat Ray, Leopard Shark Pup, Opaleye, Kelp Crab |
| Arctic | 120,000 | **Frost Dragon** | Existing 20 + 5 new |
| Deep | 400,000 | **Leviathan** | Existing 20 + 5 new |
| **Sunken City (new)** | 700,000 | **The Marble Emperor** | Relic Tetra, Bronze Guppy, Mosaic Carp, Fresco Eel, Coin Koi, Amphora Crab, Gilded Sturgeon, Pilgrim Crab |
| Volcano | 1,200,000 | **Ifrit Fin** | Existing 20 + 5 new |
| Sky | 4,000,000 | **Cloud King** | Existing 20 + 5 new |
| **Astral Sea (new)** | 15,000,000 | **The Last Constellation** | Nebula Minnow, Quasar Eel, Void Tetra, Pulsar Ray, Eclipse Koi, Dark Matter Carp, Comet Shark, Singularity Shrimp |

### Stages inside every biome

A biome stops being one flat pool. Four stages, unlocked by your **dex count in that biome**, each harder and richer than the last — the climb that leads to the boss:

| Stage | Unlocks at | What changes |
|---|---|---|
| I — The Shallows | Entering the biome | Today's fishing: commons and uncommons, gentle strike speeds |
| II — Open Water | 9 species in dex | Strike zone ~15% faster; rares enter the table; first epics appear |
| III — The Deep Run | 17 species in dex | Strike zone ~30% faster with fake-out twitches; epics weighted up; fish fight harder on the reel |
| IV — Boss Lair | 24 of 24 others in dex | The boss encounter only. Beating it marks the biome *Mastered*: permanent +luck in that water |

### The boss fights

- **The gate is the dex:** the boss cannot even be summoned until every other species in its biome has been caught at least once. The dex screen shows a boss silhouette and a counter ("17 / 24 — the water is still hiding 7 fish").
- **Summoning:** a Boss Chum bait (bought with money, or crafted from 3 epic+ catches from that biome — priced so it's an event, not a spam button).
- **The fight — three phases.** Phase 1: a fast strike zone. Phase 2: the zone reverses direction and throws fake-outs. Phase 3: the boss runs — a hold-the-tension reel battle where line strength (your line tier) genuinely matters. Each boss gets one signature trick themed to its water (the Frost Dragon freezes the zone edges; the Marble Emperor goes statue-still, then erupts).
- **The art is hand-tuned:** bosses are not procedural variants — each gets bespoke draw parameters (size, silhouette, pattern, glow) so catching one *looks* like an event.
- **Rewards:** the game's biggest single payouts, a permanent trophy for the Aquarium showcase, a "Mastered" badge per biome, and Boss Rush progress.


## 3. The Aquarium — your fish, on exhibit, earning while you sleep

The tank turns the dex from a checklist into an asset. Every species you've caught can be exhibited; your **best specimen** (heaviest, with its mutation) is the one on display. Visitors pay to look — including while the game is closed.

**How it earns**

- **Exhibit value** per fish = its sale value × mutation multiplier × a size bonus for record specimens. A Cosmic-mutated boss in the glass is worth a fortune; a plain Bluegill is worth pennies — as it should be.
- **Income rate** = total exhibit value ticking over per hour, paid into your money the moment you open the game, with a "While you were away" summary screen.
- **Offline cap:** earnings bank up to **8 hours** by default; tank upgrades raise the cap to 24 hours. The cap keeps the career economy honest — the tank becomes a strong second income, never a replacement for fishing.
- **Settlement is timestamp-based** in the save file (the save already versions and keeps a backup copy — the same pattern extends).

**How it plays**

- **Slots:** start with 12 exhibit slots; upgrades grow the tank to 40. Choosing *which* fish earn is the game.
- **Showcase:** 3 featured pedestals worth 3× value — where the boss trophies live.
- **Feed Frenzy:** a tap interaction — feed the tank, income runs +50% for the next hour, fish get visibly excited. One small daily ritual.
- **Upgrades:** Glass → Panoramic → Grand Dome (slots + cap), a Gift Shop (income multiplier), and biome-themed lighting rigs that boost exhibits from that water.
- **Alive, not a spreadsheet:** exhibited fish actually swim (the animation pass, §5), and tapping one pops its dex card — name, best weight, mutation, where it lives.

## 4. Gear, signature lures, and bait

The existing ladders extend upward, themed to the new water: rods to 28 (capstone: *Astral Weaver*), reels to 14, lines to 12 (top line finally out-holds a boss's Phase 3 run), boats to 9 (Airboat for the Mangrove, Kelp Skimmer, and the Astral Skiff as the endgame hull).

The 50 generated lures stay, but the real upgrade is **24 handcrafted signature lures with actual effects** — the difference between "+luck, but more" and a loadout decision:

- **Family hunters** — e.g. *Eel Whistle*: eels and eel-like fish bite far more often in this water.
- **Weather mates** — e.g. *Storm Bell*: converts a storm's luck bonus into a bite bonus.
- **Mutation hunter** — e.g. *Prism Spoon*: doubles mutation odds, halves base luck.
- **Boss line** — the Boss Chum baits (§2) live in the new **bait slot**: consumables bought in packs alongside the existing lure packs — Dough Ball → Glow Worm → Chum Bucket → Boss Chum. One bait, one cast: a small money sink that makes every cast a tiny decision.

## 5. Art & animation — making the water feel alive

Because fish are code-drawn, one art pass lifts all 375 species at once:

- **6 new body archetypes** (turtle, squid, seahorse, angler, crab, jelly) join the existing 6, assigned per species so a Seahorse stops looking like a fish with a story.
- **A pattern layer** per species — stripes, spots, saddles, gradients, glow tips — seeded so every species is recognizable at a glance, and mutations (Albino, Neon, Cosmic) restyle the pattern, not just the price.
- **Swim animation:** each archetype gets a real swim cycle — tail and fin sine motion, eel undulation, ray wing-beats, jelly pulses — in the tank, in the catch reveal, and in the water while you fish.
- **The catch moment:** splash rings and particles on the bite, a struggling fish that darts and dives during the reel (line tension changes color as it strains), and a proper catch celebration arc.
- **Ambient water:** the existing painted biome backdrops gain animated surface light, drifting plankton and bubbles, weather overlays (rain rings, fog drift, aurora shimmer) — the biome paintings become places, not posters.
- **Boss entrances:** a short, skippable intro animation per boss — shadow first, then the reveal.

## 6. Main menu & game modes

A real title screen over the biome art: Continue, then mode cards. Six modes, three save slots (Career, Co-op Career, Sandbox — each its own localStorage save, so nothing contaminates anything):

| Mode | Players | Save | What it is | Phase |
|---|---|---|---|---|
| **Expedition** | 1 | Career | The game today, grown: money, gear, contracts, stages, bosses, rebirth | Exists |
| **The Aquarium** | 1 | Career | Exhibit management + offline income (§3) — a screen, not a separate save | 1 |
| **Sandbox — Zen Waters** | 1 | Sandbox | Every biome, rod, lure and bait unlocked; no money, no selling, no contracts; calmer, slower strike; nothing to lose and nothing to grind — just fishing. Its own dex so a sandbox catch never fakes a career boss unlock | 5 |
| **Local Co-op** | 2, one screen | Co-op Career | Player 2 joins on a gamepad or the keyboard's other half. Both fish the same water into one shared pool. On big fish, *assist-reel*: your partner grabs the second handle and helps hold the zone. Shared money, shared dex, shared tank | 6 |
| **Online Co-op** | 2–4, room code | Co-op Career | A 4-letter room code on the **already-built** WebRTC room engine. You see your friends' boats on your water, fish side by side under shared weather, take co-op contracts, and fight a boss together when the host has it unlocked — guests earn their own dex credit. No item trading in v1 (keeps it simple and cheat-proof) | 7 |
| **Derby** | 1–4 | Career | 10-minute timed competitions — most value, biggest fish, species sprint — against AI rivals solo, or friends online. Daily derby with seeded weather. Rewards are contracts and cosmetics, never raw power | 8 |
| **Boss Rush** | 1 (co-op later) | Career | Unlocks after any 3 biome bosses fall: a timed gauntlet of every boss you've beaten, back to back. The endgame leaderboard is your own best time | 8 |


## 7. The stack — keep what you already have

> **Verdict: GitHub + Vercel + Neon is the right stack for this design. Nothing new to buy, no engine change, no game server to rent.** The repo is already shaped for exactly this stack — the build already runs in Vercel's shape, the migrations folder already targets Postgres, and the multiplayer code was written against a signaling relay this stack can host.

| Piece | Job in this design | Why it fits |
|---|---|---|
| **GitHub** | Source of truth; the repo as it stands | Already the workflow. Content waves land as ordinary commits |
| **Vercel** | Hosts the game + the `/api/rtc` signaling relay for online rooms | The app already builds in Vercel's shape; the relay is a few small API routes, well inside a normal project |
| **Neon (Postgres)** | Room/signaling rows today; accounts, cloud saves and derby boards in the final phase | The repo already carries migrations + an auth layer (currently switched off by design). Turning it on is a phase, not a rebuild |
| **WebRTC (in the browser)** | The actual online play — fish data flows directly between players' browsers | **No game server exists to pay for.** Vercel + Neon only introduce players to each other; after the handshake the browsers talk peer-to-peer |
| **localStorage** | All saves, including offline-earnings settlement | Already the game's system; this design extends it (v3 schema, separate slots per mode, export/import code in Settings) |

**Hosting cost:** free tiers suffice at this project's scale — Vercel Hobby (100 GB bandwidth, 1M function invocations/month) covers the game plus the signaling relay with orders of magnitude to spare, and Neon Free (1 GB storage, 100 compute-hours/month, scales to zero when idle) covers rooms and cloud saves. Two honest watch-items: Hobby is **non-commercial use only** (the moment the game charges money or runs ads, it needs Pro at $20/seat/month), and a Neon database that has been idle for 5+ minutes takes a moment to wake when the first room of the day is created.

**The one honest limit:** WebRTC sometimes can't punch through a strict home router without a relay helper (a "TURN" server). The design starts with the free public connection helpers (STUN) — most home setups connect fine. *If* real players hit connection failures, the fix is a small TURN service — Cloudflare's free tier first, or a tiny service on the Dokploy stack that already exists. It's a Phase 7 contingency, not a day-one purchase. The escape hatch if online play ever outgrows peer-to-peer (public lobbies, anti-cheat leaderboards that matter) is one small always-on socket service on Dokploy — noted, deliberately not built now.

*Cost note: Vercel deploys follow the house rule — verified locally, shipped in batches, never one build per fix.*

## 8. The roadmap — build order

Ordered so every phase makes the next one cheaper: the Tank early (it makes all existing content pay rent), bosses before the content wave (so new biomes are born with their bosses designed in), multiplayer last (it stands on finished single-player systems). Durations are rough part-time-pace estimates — the order matters more than the numbers. Total: roughly 3–4 months part-time.

| Phase | Ships | Done when |
|---|---|---|
| **P0 Foundations** (~1 wk) | Main-menu shell with mode cards; save schema v3 (mode slots, offline-settlement field, export/import); everything still plays exactly as today behind "Expedition" | Old saves migrate cleanly; menu → game → menu round-trips |
| **P1 The Aquarium** (~2 wks) | Tank screen, exhibit slots + showcase, income + offline settlement with the welcome-back summary, Feed Frenzy, first upgrades | Close the game for a day, reopen, get paid — accurately, never more than the cap |
| **P2 Stages & Bosses** (~2 wks) | 4-stage ladder and the 3-phase boss fights on the 10 existing biomes; boss silhouettes in the dex; Mastered badges | A fresh save can climb Pond to the Pond King and win; a cheated save can't skip the dex gate |
| **P3 Content wave** (~2–3 wks) | 5 new biomes with stages + bosses designed in, +5 species in each old biome, gear tiers, signature lures, bait slot | 375 in the dex; every new fish catchable, drawable, sellable, exhibitable |
| **P4 Art & animation** (~2 wks) | 12 archetypes, pattern layer, swim cycles, catch/reel animation, ambient water, boss entrances | Side-by-side with today's build, the water visibly lives; no frame-rate regression on a mid phone |
| **P5 Sandbox** (~1 wk) | Zen Waters: all unlocked, no economy, calm strike, own save slot | A brand-new player can fish the Astral Sea in one tap — and their career save never notices |
| **P6 Local Co-op** (~1–2 wks) | Second player (gamepad / split keys), shared pool, assist-reel, co-op save slot | Two players land one boss together on one screen |
| **P7 Online Co-op** (~1–2 wks) | Room codes on the existing P2P engine, guest boats on your water, shared weather, co-op contracts, joint boss fights | Two browsers in two houses fish the same water with under a minute of setup |
| **P8 More modes + cloud** (~1–2 wks) | Derby (daily), Boss Rush, accounts on Neon with cloud save sync | A save follows the player between phone and PC |

## 9. Decisions — with recommended defaults

None of these block starting P0–P2; each has a sane default already baked into the design above.

| # | Decision | Recommended default |
|---|---|---|
| 1 | Do Sandbox catches count toward career boss unlocks? | **No** — Sandbox keeps its own dex. Boss gates stay honest; Sandbox stays consequence-free |
| 2 | Boss summon cost | Boss Chum: buyable at a steep price *or* crafted from 3 epic+ catches in that biome. An event, not a spam button |
| 3 | Offline earnings cap | 8 hours base, 24 hours fully upgraded — strong second income, never the main one |
| 4 | Item trading between online players | **Not in v1.** Co-op shares the water and the work, not the inventory — simple, and nothing to cheat with |
| 5 | Derby rewards | Contracts and cosmetics only — winning a derby should never be the fastest way to get stronger |
| 6 | Online boss rule | The host's unlock gates the fight; every player in the room earns their own dex credit for the kill |

---

**The one-line version:** the game already has the bones — a legendary waiting at the top of every biome and a multiplayer engine sitting in the library. This design promotes those bones into the headline features, wraps them in a menu and modes, pays the player rent through the Aquarium, and does it all on the GitHub + Vercel + Neon stack that's already standing. First shovel: P0 + P1 — menu, save v3, and the Tank.

*Prepared for Chris Robinson and Caleb Robinson · FAC Ultra is Caleb's project · Figures for "today" verified from the code at main `dc8258a`, 2026-11-01 · Durations are estimates at a part-time pace, not commitments. A print-formatted PDF of this document sits beside it: `fac-ultra-expansion-design.pdf`.*
