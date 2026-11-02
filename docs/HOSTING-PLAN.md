# FAC Ultra — Self-Hosting Plan ("Dad-Hosted")

Status: **Approved by Chris (dad) on 2026-11-02, built and live the same day.**
The game serves at **https://fac-ultra.tail41d4fa.ts.net** — final topology and
proofs are recorded in the runbook below ("As built" notes, corrected
2026-11-02 after the first live deployment). Written by Vivienne (Chris's
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

- **At home (Caleb + brothers):** the **same public address** — it works from
  inside the house too (proven from a second PC on the home network). A direct
  LAN path is blocked by a WSL networking quirk on the hub (runbook §4), and
  the public address is fast, so there is one link for everyone.
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
- **Build for self-host by rewriting the Nitro preset inside the image build.**
  `vite.config.ts` hardcodes `preset: "vercel"` (it emits `.vercel/output`), and a
  hardcoded config preset beats the `NITRO_PRESET` env var — env-only attempts
  still emitted the Vercel shape (proven 2026-11-02). The recipe in §2 rewrites
  the preset to `node-server` in the build image only; the repo is untouched.
  No `DATABASE_URL` is set, so the game's embedded PGlite fallback applies —
  no external database needed at this stage.
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
- **Tailscale:** the hub is already enrolled and never sleeps on AC. Funnel runs
  on a **second, dedicated node inside the hub's WSL** (step 5). The one
  owner-gated step — enabling Funnel for that node — was done by Chris on
  2026-11-02.

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
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
# vite.config.ts hardcodes the Nitro preset to "vercel", and a config preset
# beats the NITRO_PRESET env var. Rewrite it inside this image build only;
# the repo is untouched. Guarded: if the upstream string ever changes, the
# build fails loudly here instead of emitting the wrong output shape.
RUN grep -q 'preset: "vercel"' vite.config.ts \
 && sed -i 's/preset: "vercel"/preset: "node-server"/' vite.config.ts \
 && grep -q 'preset: "node-server"' vite.config.ts
RUN npm run build
FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

Why the preset rewrite matters: the repo's Nitro preset is **hardcoded to
Vercel** in `vite.config.ts`, which emits `.vercel/output` — the first test
build (potato, 2026-11-02) failed at exactly this point, and setting
`NITRO_PRESET` in the environment did **not** override the hardcoded value
(proven on the hub build). The long-term tidy fix belongs to the repo
(`preset: process.env.NITRO_PRESET ?? "vercel"` — Caleb/builder's call); until
then the guarded in-image rewrite above is the mechanism, and it fails loudly
if the upstream string changes.

Two more deliberate recipe choices: `npm ci` is tried first with an
`npm install` fallback, because the repo's lock file can drift when a
dependency change lands without a lock update — a stale lock must never block
a deploy. And the recipe pins **Node 24** (`node:24-slim`): the repo's CI
checks run Node 22, but this exact recipe (install → build → serve) is proven
green on 24, as was the builder's bench verification — treat 24 as a pinned
decision, not an accident.
`npm run build` also runs `db:migrate`, which **skips itself when no
`DATABASE_URL` is set** — that is what we want: the game then uses its embedded
PGlite fallback (in-memory runtime store; player saves are client-side save
codes, so a container restart loses no one's save).

Compose (caps keep Chris's machine his — the server is light):

```yaml
services:
  game:
    build: { context: ./fac-ultra, dockerfile: Dockerfile.hosting }
    image: fac-ultra:latest
    container_name: fac-ultra
    restart: unless-stopped
    environment: ["PORT=3000", "HOST=0.0.0.0"]
    network_mode: host
    mem_limit: 2g
    cpus: "2.0"
```

Host networking is deliberate: the port only has to exist **inside the distro**
— the Funnel node (§5) proxies from there, so no port publishing toward
Windows is needed at all (and on this box, that direction is broken anyway;
see §4).

First build takes several minutes (image pull + install + Vite build). The
Engine on the hub is **standalone docker-ce installed in the distro** (the same
pattern the enrollment kit uses) with the Compose plugin from Docker's apt
repo — check `docker compose version` if a node was set up differently; a bare
Engine may need the standalone plugin binary in
`/usr/libexec/docker/cli-plugins/`. Docker Desktop is **not** used (its engine
would not boot on this box; see the findings at the end of this runbook).

### 3. Verify locally before exposing anything

1. `docker ps` shows `fac-ultra` up.
2. Inside the distro: `curl -sf http://127.0.0.1:3000/` returns the game page.
   (If this fails, read `docker logs fac-ultra` — do not proceed to step 5.)
3. Do **not** expect the Windows side of the hub to reach it — on this box,
   Windows cannot connect to services listening inside the mirrored-mode WSL
   at all (§4). Exposure is verified at step 5, from another device.

### 4. Household access

Household players use the **same public address** as friends
(https://fac-ultra.tail41d4fa.ts.net) — proven from a second PC on the home
network (HTTP 200). There is no separate LAN path, because on this hub the
direct route is blocked: the WSL runs **mirrored networking**, and Windows
cannot connect *into* services listening in the distro — `localhost`, the LAN
IP, and the WSL address all time out from the Windows side, **even for a plain
test server** with no Docker or game code involved, and a Hyper-V firewall
rule for the port made no difference (all proven 2026-11-02). If a future
Windows/WSL update repairs mirrored-mode inbound, a LAN shortcut can be
re-added — until then, one link for everyone, and it is fast (≈1 s warm).

### 5. Friends' access (Tailscale Funnel) — as built

Funnel does **not** run on the hub's Windows Tailscale node. A second,
dedicated Tailscale node runs **inside the hub's WSL**, next to the game:

- systemd unit `tailscaled-fac`: `tailscaled --tun=userspace-networking
  --statedir=/var/lib/tailscale-fac --socket=/run/tailscale-fac/tailscaled.sock`
  (static Tailscale binaries in `/usr/local/bin`). Enrolled 2026-11-02 as node
  **fac-ultra** (`100.114.189.68`) with a single-use preauthorized auth key
  minted through the fleet's Tailscale connector (`create-authkey`); key
  expiry disabled for the node, like the rest of the fleet.
- **Gotcha:** use `--statedir`, never `--state=<file>`. With `--state`, the
  daemon has no var root and HTTPS handshakes fail with `no TailscaleVarRoot`.
- **Owner step (done by Chris, 2026-11-02):** the first `funnel` call answers
  with an admin link (`login.tailscale.com/f/funnel?node=…`); the tailnet
  owner opens it and enables Funnel for the node. Agents cannot flip it.
- Start/refresh: `tailscale --socket=/run/tailscale-fac/tailscaled.sock
  funnel --bg 3000` → **https://fac-ultra.tail41d4fa.ts.net**, proxying
  `http://127.0.0.1:3000` inside the distro. The config persists in the
  daemon's state; the unit is systemd-enabled.
- Funnel exposes **only** the game port on that node; the node runs no other
  service, and the hub's own SSH/management stays on its separate node,
  untouched.
- **Proof (2026-11-02):** HTTP 200 from potato (a different PC, over the
  public path) and from the hub via the public URL (≈1.2 s warm; the first
  ever hit can take ~20 s while the relay path warms up).

### 6. Updates

- Hub: pull `main` in the clone → rebuild → `docker compose up -d` → repeat
  step 3. A reference `deploy.sh` implementing exactly this (bundle refresh →
  build → up → health check) travels with the hosting files.
- Pause anytime with `docker compose stop` or `docker pause fac-ultra`;
  Chris's use of his PC always wins. Rollback = check out the previous `main`
  commit and rebuild; there is no server-side save state to migrate.
- **Reboot survival:** scheduled task `FleetKit-WakeWSL-Hosting` (runs at
  Development's logon) boots the WSL distro; `docker` and `tailscaled-fac` are
  systemd-enabled, the container is `restart: unless-stopped`, and the Funnel
  config persists — the game returns unattended after a reboot.
- **Tournament persistence (WP-7/8):** the in-memory store is correct until
  tournaments land. Then either add a Postgres service to the compose file and
  set `DATABASE_URL` on the game service (the game already switches backends
  on that variable), or mount a folder volume if the tournament work adds a
  file-storage option. Player saves are unaffected either way (client-side
  save codes).

### 7. Secrets rule

No credentials in this repo, in the game container, or in FleetShare — ever.
The FleetShare password exists only in the hub's vault handoff file
(`C:\ProgramData\FleetKit\vault-handoff\fleetshare-DESKTOP-OL64ACP.json`) and is
read machine-side by the mount helper. The same pattern applies to any future
node: credentials move as vault handoffs, never as chat text or shared files.

### Investigated and rejected on this hardware (don't re-litigate)

- **Serving the built app from Windows' own Node:** the bundle's server
  library (srvx, via the Nitro node-server preset) exits silently without
  listening under Windows Node 24 *and* 26, while the identical bundle serves
  correctly under Linux (container and bare WSL). A plain toy Node server
  works fine on the same Windows install — the failure is specific to this
  server stack on Windows. Serve from Linux.
- **Docker Desktop as the engine:** its WSL engine distro would not boot on
  this box (service running, `docker desktop start` reporting "running", the
  engine never came up). Standalone docker-ce in the distro is the working
  pattern; Desktop's settings were restored untouched afterwards.
- **Bridging Windows → WSL listeners** (port publishing, `netsh portproxy`,
  Hyper-V firewall rules): mirrored-mode inbound to the distro is broken on
  this machine (see §4). The Funnel node inside the distro exists precisely
  so nothing has to cross that boundary.

### Who can do what

| Step | Another agent | Needs Chris | Needs Caleb |
| --- | --- | --- | --- |
| Clone / bundle / build / run / update | ✅ with Development SSH | | |
| Funnel start / node repair | ✅ | Funnel policy toggle — done 2026-11-02 | |
| Repo deploy key (optional, replaces bundle relay) | | | ✅ repo admin |
| Merge this plan (PR) | | | ✅ repo owner |
