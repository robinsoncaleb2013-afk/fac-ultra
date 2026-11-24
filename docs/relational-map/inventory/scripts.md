# Inventory — scripts

Every tooling script in `scripts/` (test files `*.test.mjs` are not listed). Build, preview, checks and generators.

- **alias-loader** (`scripts/alias-loader.mjs`): Node ESM resolver hook so tests can import game code that uses the app's @/ path alias; registered by run-tests.mjs via --import.

- **ambience-build** (`scripts/ambience-build.mjs`): Builds the ambient audio loops in public/audio/ from synthesized sources.

- **app-env-plugin** (`scripts/app-env-plugin.mjs`): Dev-only /__app-env endpoint: the client env the running Vite server resolved, as JSON, for the auth-invariant check.

- **art-build** (`scripts/art-build.mjs`): Builds the biome paintings in public/art/ (WebP, both sizes) from the art sources.

- **brand-check** (`scripts/brand-check.mjs`): Checks the site's brand and social-card setup and warns when the card is missing or stale.

- **browser-guard** (`scripts/browser-guard.mjs`): Target checks shared by the Playwright capture scripts: what a capture may render and where it may write.

- **browser-smoke-verdict** (`scripts/browser-smoke-verdict.mjs`): Judges a browser-smoke capture against the saved baseline and reports what changed.

- **browser-smoke** (`scripts/browser-smoke.mjs`): The headless-browser smoke pass: renders a running copy and captures what it shows.

- **build-epoch** (`scripts/build-epoch.mjs`): Stamps the build epoch: computes the epoch value and renders src/lib/build-epoch.generated.ts at build time.

- **check-auth-invariant** (`scripts/check-auth-invariant.mjs`): Compares the live dev server's VITE_AUTH_ENABLED against the value the next build will resolve, and warns when they differ.

- **check-touch-targets** (`scripts/check-touch-targets.mjs`): Checks the game's tap targets are big enough for thumbs, against a build.

- **copy-pglite-assets** (`scripts/copy-pglite-assets.mjs`): Copies the PGLite runtime assets into the build output so the embedded database can run there.

- **docs-check** (`scripts/docs-check.mjs`): The docs guard: fails when a path, setting, save version, migration, mode or route named in the docs stops matching the code.

- **grok-pwa-plugin** (`scripts/grok-pwa-plugin.mjs`): The dev and preview (Vite) half of the platform PWA chrome: serves the install tutorial and the per-app manifest, and injects the PWA head tags.

- **grok-pwa-shared.d** (`scripts/grok-pwa-shared.d.mts`): Type declarations for grok-pwa-shared.mjs (the head-chrome context and site types).

- **grok-pwa-shared** (`scripts/grok-pwa-shared.mjs`): Single source of truth for the platform head chrome (PWA, extensions, Open Graph), shared by the Vite plugin and the Nitro middleware.

- **install-page** (`scripts/install-page.html`): The 'Add to your Home Screen' tutorial page the PWA chrome serves, with the game's own logo and name.

- **migrate** (`scripts/migrate.mjs`): The deploy-time migration applier: runs the pending migrations against DATABASE_URL (npm run db:migrate).

- **migration-plan** (`scripts/migration-plan.mjs`): Migration bookkeeping shared by the two appliers (migrate.mjs and the PGLite path in src/lib/db.ts), keyed by file name so a file applies once.

- **preview-thumbnail** (`scripts/preview-thumbnail.mjs`): Captures the preview thumbnail image for the sandbox listing.

- **preview** (`scripts/preview.mjs`): Runs and manages the local preview server process behind the preview scripts in package.json.

- **run-tests** (`scripts/run-tests.mjs`): The one test command (npm test runs the map checks first, then this): picks the game tests and the portable tooling tests, skipping the sandbox-only ones outside the sandbox.

- **sign-out-plan** (`scripts/sign-out-plan.mjs`): The sign-out sequence used by src/lib/auth/client.ts, kept pure so its effects can be unit-tested.

- **with-app-env** (`scripts/with-app-env.mjs`): Runs a command with the app's resolved environment loaded; the dev, build and preview scripts all go through it.

- **write-atomic** (`scripts/write-atomic.mjs`): Atomic file-write helper (write, then rename) for tooling that must never leave a half-written file.
