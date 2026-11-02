# FAC Ultra — Self-Hosting Plan ("Dad-Hosted")

Status: **Approved by Chris (dad) on 2026-11-02.** Written by Vivienne (Chris's
assistant) at his direction, for Caleb (repo owner) and the agents building the game.

Coordination note: a builder agent is actively implementing the WP stack
(WP-0…WP-9 in `docs/architecture/`). This plan is **documentation only** — it adds
no code, changes no architecture contract, and touches no WP branch. Where it
overlaps `docs/architecture/`, the architecture folder wins; in particular, the
per-device graphics tiers below **adopt WP-1's automatic device/graphics tiers**
(09-mobile) rather than replacing them.

## Decision

Host the game on **Chris's gaming PC** (`desktop-ol64acp` — i9-13900K, 32 GB RAM,
RTX 4070 Ti, Docker, on the family Tailscale network) instead of Caleb's PC
("potato", GTX 1080), and instead of the Vercel + Neon free tiers.

Why:

- No free-tier ceilings: no Vercel bandwidth/function limits, no Neon free-tier cap.
- The gaming PC is already the family fleet's hub (it hosts the FleetShare staging
  folder), already runs Docker, and Vivienne has a Development management account
  on it for updates and restarts.
- Caleb's PC stays free for playing. Its GPU only does what every player's GPU
  does — render its own screen (see "Graphics" below).

## How players reach it

- **At home (Caleb + brothers):** the hub's LAN address or tailnet name. Fastest
  path, nothing public.
- **Friends outside the house:** a **Tailscale Funnel** public HTTPS address that
  exposes *only the game's port*. No router port-forwarding, and nothing else on
  the PC is reachable through it.
- The hub PC has to be on for friends to play (its AC power settings are already
  "never sleep").

## What the server actually does (load honesty)

FAC Ultra is a browser game. The server serves the built app and runs the WebRTC
signaling relay (`/api/rtc`). **Rendering happens in each player's own browser** —
the host's GPU does not render anyone else's game, and more players do not multiply
GPU load on the hub.

- Host load is small: static files plus a lightweight relay. Chris's work and his
  own gaming keep priority; the container runs with modest CPU/RAM caps and can be
  paused instantly (`docker pause`) without losing anyone's save — saves are
  client-side save codes, and the server database is an in-process runtime store
  at this stage.
- If Chris plays in his own browser, his RTX 4070 Ti gives him the top tier
  locally — the same as any strong client machine.

## Graphics quality per player (adopts WP-1)

Quality is **per device**, decided by the game on each player's machine:

- **Detect:** WebGL renderer string (GPU class), `devicePixelRatio`,
  `hardwareConcurrency`, plus a short FPS sampling window at session start.
- **Tiers:** Ultra / High / Medium / Low / Potato, with dynamic resolution scaling
  and automatic step-down if FPS sags, step-up when there is headroom.
- **Override:** a per-device Settings choice (Auto / Ultra / … / Potato),
  remembered on that device.
- **Floor guarantee:** the Potato tier targets weak integrated GPUs and cards at
  or below a GTX 1080, so the brothers' PCs stay playable. Tiers are independent —
  nobody is dragged down to the weakest machine's settings.

## What dropping the free tiers unlocks (future roadmap notes)

- **Cloud saves + optional accounts (WP-9)** can run on a self-hosted Postgres on
  the hub instead of Neon's free tier.
- **Server-replay-verified tournaments (WP-7/WP-8)** can use that same local
  database.
- Asset and world size no longer need to fit Vercel's free bandwidth.

## Operations

- **Source of truth stays this repo.** Nobody deploys from a WP branch; hosting
  follows `main` as PRs merge.
- **Build for self-host with `NITRO_PRESET=node-server`.** The repo's default
  Nitro preset is Vercel (it emits `.vercel/output`); the node-server preset emits
  a standalone Node server (`.output/server/index.mjs`) that runs in a small
  Docker container on the hub. No `DATABASE_URL` is set, so the game's embedded
  PGlite fallback applies — no external database needed at this stage.
- Deploy = pull `main` → build the container → restart it. A first container
  recipe was drafted and test-built on potato on 2026-11-02; the production copy
  lives on the hub with the hosting files kept outside the repo's own workflow.
- Vivienne maintains the host (updates, restarts, Funnel) over Tailscale.
  Caleb keeps full ownership of the repo and the game.

## Non-goals

- No game-code changes in this plan.
- No changes to `docs/architecture/` contracts.
- No public exposure of anything except the game port.
