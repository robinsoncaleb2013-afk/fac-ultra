# External connections

Everything outside this repo that the game touches: where the live
copy runs, who sends its email, where its database can live, and
the sandbox platform it was built in.

## The live game: the hub on Chris's gaming PC

Production does not run on a cloud account. The game is hosted on
Chris's gaming PC as a Docker stack (the hosting design is
[docs/website/HUB-SETUP.md](../website/HUB-SETUP.md), kept with the
website docs): the hub keeps its own clone of this repo on `main`,
and its deploy script pulls, rebuilds the image and restarts the
one container. Player data lives in the hub's own data folder,
mounted into the container, so a redeploy never touches it; the
container is told the test-phase switch is off.

Two build facts make that work:

- The app builds in Vercel's output format (`vite.config.ts` keeps
  the Vercel preset); the hub's image build rewrites the preset for
  self-hosting. Nothing in the game depends on Vercel to run.
- With no `DATABASE_URL` on the hub, the database is the embedded
  PGLite in the data folder — the same migrations, the same code
  path as a real Postgres (see
  [server-and-accounts.md](server-and-accounts.md)).

The public address is a Tailscale funnel name on Chris's tailnet;
the website's play page for the game links to it, and
[docs/HOSTING-PLAN.md](../HOSTING-PLAN.md) keeps the hosting
history.

## Email: Resend

Sign-in links go out through Resend. The sender
is behind one function in `src/lib/accounts/mail.server.ts`, so
the provider is a one-line choice; without a key, the link is only
printed in the server log, which is how the game is tested.

## Sign in with Google

The game's own Google door (`src/lib/accounts/google.server.ts`)
is the standard OAuth authorization-code flow against Google's
endpoints, entered from the `google-start` route and finished at
`google-callback`. It needs the app's Google client settings in
the environment (the settings list is in `docs/README.md`); a
player who never uses it can still sign in by email link.

## The database outside

When `DATABASE_URL` is set — a Neon Postgres in the setup the game
was built against — `getSql()` uses it and the embedded database
stays off. The SQL is written to run identically on both, and the
migrations are idempotent, so either engine can be brought up to
date by the same files. The honest state of that check is in
[docs/KNOWN-GAPS.md](../KNOWN-GAPS.md): the server side was built
and tested on PGLite, and a long run on a real Postgres is still
on the list.

## The Grok sandbox platform

The game was built in Grok's app sandbox, and pieces of that
platform still surround it: the preview chrome and install page
(see [runtime-and-routes.md](runtime-and-routes.md)), the Better
Auth platform sign-in, and the app-data connector plumbing
(`src/lib/app-data/`). None of it is the game's own system: the
game's accounts, data and hosting above all work without it, and
the deployed hub copy runs with the platform sign-in off.
