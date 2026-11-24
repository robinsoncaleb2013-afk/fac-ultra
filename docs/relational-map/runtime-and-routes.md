# Runtime and routes

How the game starts, what a visitor's browser loads, and which
routes exist. Every route file has its own entry in
[inventory/api.md](inventory/api.md).

## Booting

- `src/router.tsx` builds the TanStack router from the generated
  `src/routeTree.gen.ts`, with the app's error screen
  (`src/lib/error-component.tsx`) and the sandbox preview's path
  rewriting (`src/lib/preview-path-prefix.ts`).
- `src/routes/__root.tsx` is the document shell: fonts, meta, the
  app stylesheet, the platform `AuthProvider`
  (`src/lib/auth/provider.tsx`) and the preview host bridge
  (`src/components/preview-host-bridge.tsx`). No Open Graph tags are
  added here — the PWA chrome below owns those.
- `src/routes/index.tsx` is the only page route: it renders the
  `Game` component from `src/components/game/shell.tsx`, which is
  the screen router for title, main menu and the game itself.
- The build is Vite plus Nitro (the preset in `vite.config.ts` says
  Vercel; the hub's own image build rewrites it for self-hosting —
  see [external-connections.md](external-connections.md)). The
  output carries the game's build epoch, stamped by
  `scripts/build-epoch.mjs` into `src/lib/build-epoch.generated.ts`.

## API routes

The server answers through 14 API route files under
`src/routes/api/`. Each file is thin: it turns the request into a
call on the matching server code and returns the answer.

- The game's own accounts: `account`, `profiles`, `save`,
  `google-start` and `google-callback` — served by
  `src/lib/accounts/`.
- Tournaments and their world: `events`, `entry`, `catch`, `board`,
  `survival-board`, `friends` and `trophies` — served by
  `src/lib/tournaments/`.
- Live rooms: `rtc`, the WebRTC signaling relay.
- The test phase: `epoch`, which tells the browser which build
  epoch the server is on so the device can apply the reset rule in
  [docs/TEST-PHASE.md](../TEST-PHASE.md).

## PWA chrome and the install page

Two halves share one source of truth
(`scripts/grok-pwa-shared.mjs`): the Vite plugin
(`scripts/grok-pwa-plugin.mjs`) serves the install tutorial and the
per-app manifest in dev and preview, and the Nitro middleware
(`server/middleware/grok-pwa.ts`) does the same job in the deployed
app, injecting the PWA and Open Graph head tags into each page.
The install page itself is `scripts/install-page.html`, and the
home-screen icons live under `public/__grok/`.

## Previews and the sandbox

The game was built inside the Grok sandbox and still runs there for
previews: `startup.sh` starts the dev server, `scripts/preview.mjs`
manages it, and the bridge files (`src/lib/preview-host-bridge.ts`,
`src/components/preview-host-bridge.tsx`) let the sandbox chrome
drive navigation when the game is embedded. Outside the sandbox
every one of these is a no-op.
