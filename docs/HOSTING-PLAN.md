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

## Setup runbook (agent-executable)

This plan is **not** Vivienne-only. Any agent with the access listed below can set
it up or repair it from this section alone. Secrets are never written here, in the
repo, or in FleetShare — see the secrets rule at the end.

### Access needed

- **Hub:** SSH as the `Development` account (administrator) on the gaming PC —
  tailnet `desktop-ol64acp` / `100.89.147.65`. Docker runs inside its WSL2 Ubuntu.
- **Game code:** a clone of this repo. The hub's bench WSL keeps a working clone
  (christcr2012 collaborator access). Nodes without GitHub credentials use the
  bundle relay in step 1B instead.
- **Tailscale:** the hub is already enrolled and never sleeps on AC. The one
  possibly owner-gated step is Funnel enablement (step 5).

### 1A. Get the code (hub, or any machine with GitHub access)

Clone (or pull) `main`. Hosting follows `main` only — never deploy a WP branch.

### 1B. Get the code (a node with no GitHub credentials — the bundle relay)

Repo **deploy keys are currently not usable**: the GitHub MCP guard cannot read
this repo's deploy-key state, and adding one needs the repo owner's admin UI.
Until Caleb adds one, code travels as a git bundle through the hub:

1. On the hub clone: `git fetch origin && git bundle create fac-ultra.bundle origin/main`
2. Copy the bundle into **FleetShare** (`\\DESKTOP-OL64ACP\FleetShare`). On the
   receiving PC, open the share with the node's
   `C:\ProgramData\FleetKit\staged\Mount-FleetShare.ps1` helper (explicit
   `net use` — stored credentials are *not* picked up inside SSH sessions), copy
   the bundle to `C:\ProgramData\FleetKit\staged\`, then unmount.
3. In the node's WSL: `git init` a fresh dir, then
   `git fetch <bundle> refs/remotes/origin/main:refs/remotes/origin/main` and
   `git checkout -b main origin/main`. (Do **not** `git clone <bundle>` — the
   bundle stores a remote-tracking ref and plain clone misfires; and never fetch
   into the checked-out branch — fetch to the remote-tracking ref, then
   `git reset --hard origin/main` for later updates.)

### 2. Build the container

Keep the hosting files in a `hosting/` folder **outside** the repo working tree;
copy `Dockerfile.hosting` into the clone root at build time. Canonical recipe:

```dockerfile
# Dockerfile.hosting
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NITRO_PRESET=node-server
RUN npm run build
FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

Why the preset matters: the repo's default Nitro preset is **Vercel**, which
emits `.vercel/output` — a test build on potato (2026-11-02) failed at exactly
this point. `NITRO_PRESET=node-server` emits the standalone `.output` server.
`npm run build` also runs `db:migrate`, which **skips itself when no
`DATABASE_URL` is set** — that is what we want: the game then uses its embedded
PGlite fallback (in-memory runtime store; player saves are client-side save
codes, so a container restart loses no one's save).

Compose (caps keep Chris's machine his — the server is light):

```yaml
services:
  game:
    build: { context: <clone dir>, dockerfile: Dockerfile.hosting }
    image: fac-ultra:latest
    container_name: fac-ultra
    restart: unless-stopped
    environment: ["PORT=3000", "HOST=0.0.0.0"]
    ports: ["3000:3000"]
    mem_limit: 1g
    cpus: 2.0
```

First build takes several minutes (image pull + `npm ci` + Vite build). The
Docker **Compose plugin** must exist in the distro (`docker compose version`);
a bare Engine install may need the standalone plugin binary in
`/usr/libexec/docker/cli-plugins/`.

### 3. Verify locally before exposing anything

1. `docker ps` shows `fac-ultra` up.
2. Inside the distro: `curl -sf http://127.0.0.1:3000/` returns the game page.
   (If this fails, read `docker logs fac-ultra` — do not proceed to step 5.)
3. From the Windows side: `http://localhost:3000` answers (WSL forwards it).

### 4. Household access (LAN)

The hub's WSL is configured with **mirrored networking**, so the published port
is reachable on the LAN at `http://desktop-ol64acp:3000` (or the hub's LAN IP).
On a node with NAT-mode WSL instead, add a Windows port proxy
(`netsh interface portproxy`) — verify from a *second* device on the LAN, not
from the hub itself.

### 5. Friends' access (Tailscale Funnel)

On the hub's Windows side: `tailscale funnel --bg 3000` →
public address `https://desktop-ol64acp.tail41d4fa.ts.net`.

- If the CLI answers with an admin-console link instead of starting, the
  tailnet policy does not yet allow Funnel for the node. **That toggle belongs
  to the tailnet owner (Chris)** — an agent cannot flip it from the PC.
- Funnel exposes **only** the forwarded port. SSH and everything else stay
  tailnet-private.
- Proof is a load of the public address from **off the home network**
  (e.g. a phone on cellular, or any non-LAN machine).

### 6. Updates

- Hub: pull `main` in the clone → rebuild → `docker compose up -d` → repeat
  step 3. A reference `deploy.sh` implementing exactly this (bundle refresh →
  build → up → health check) travels with the hosting files.
- Pause anytime with `docker compose stop` or `docker pause fac-ultra`;
  Chris's use of his PC always wins. Rollback = check out the previous `main`
  commit and rebuild; there is no server-side save state to migrate.

### 7. Secrets rule

No credentials in this repo, in the game container, or in FleetShare — ever.
The FleetShare password exists only in the hub's vault handoff file
(`C:\ProgramData\FleetKit\vault-handoff\fleetshare-DESKTOP-OL64ACP.json`) and is
read machine-side by the mount helper. The same pattern applies to any future
node: credentials move as vault handoffs, never as chat text or shared files.

### Who can do what

| Step | Another agent | Needs Chris | Needs Caleb |
| --- | --- | --- | --- |
| Clone / bundle / build / run / update | ✅ with Development SSH | | |
| LAN + Funnel start | ✅ | only if Funnel policy is off | |
| Repo deploy key (optional, replaces bundle relay) | | | ✅ repo admin |
| Merge this plan (PR) | | | ✅ repo owner |
