# 08 — Deployment

## Environments

| Environment | Supabase                                         | App                          |
| ----------- | ------------------------------------------------ | ---------------------------- |
| local       | pglite for tests, local Supabase for manual work | Expo dev                     |
| staging     | own project, free tier                           | EAS internal distribution    |
| production  | own project, Pro from first real household       | TestFlight → App Store, Play |

Free tier is fine until real families depend on the data; the trigger to move to
Pro is **daily backups**, not a quota. See `01-functional-spec.md`.

## Database changes

Declarative schema plus generated migrations, in version control, applied by CI.
Reference data (`data/catalogue/`, the ingredient taxonomy) is synced by a
script using the service role, run as a deploy step and idempotent by design.

Never a manual change in the dashboard. A schema that exists only in production
is a schema nobody can test.

## App builds

EAS. Expo Go covers development until App Intents land; from that point a
development build is required, and the config plugin adding the App Intents
target is what forces it. That is a known one-way door and is scheduled
deliberately rather than stumbled into.

## Toolchain

**pnpm** is the package manager. Node and pnpm are pinned in **`.tool-versions`**
(asdf) and Node again in **`.nvmrc`**, with `engines` and `packageManager` in
`package.json` as the guard. CI reads `.nvmrc` rather than hardcoding a version,
so a bump is a one-line change CI follows automatically.

Current: Node 24.9.0, pnpm 10.33.0, Expo SDK 57, React Native 0.86,
TypeScript 6.0.

`.npmrc` sets **`node-linker=hoisted`**. This is not optional: Metro resolves
modules by walking real paths and cannot follow pnpm's symlinked store, so the
default layout produces "Unable to resolve module" errors that look like missing
dependencies. The hoisted layout keeps pnpm's deduplicated global store while
giving Metro the flat tree it expects. `strict-peer-dependencies=false` is set
because Expo and React Native ship loose peer ranges that would otherwise fail
installs without catching real problems.

## CI

`.github/workflows/validate.yml` mirrors the local gates as a **matrix of
parallel jobs** — format:check, lint, lint:boundaries, lint:duplication,
type-check, test, build — with `fail-fast: false`, so one failing gate does not
hide the others. A second job runs `pnpm audit` and gitleaks on every PR.
Dependencies install from the lockfile and are cached; artifacts upload on
failure. A preview build per PR once EAS is wired.

CI reads the Node version from `.nvmrc` rather than hardcoding it.

**E2E** is Maestro (`pnpm run test:e2e`, flows in `.maestro/`) against a
development build with a seeded local Supabase. Maestro is a developer-machine
prerequisite, not an npm dependency, and is not yet wired into CI — that needs
an EAS build in the pipeline and belongs with the deployment work.

`pnpm run validate:all` locally reproduces CI, and pre-push runs it.

## Web output

`app.json` sets `web.output: "single"`, not `"static"`. Static output prerenders
every route in Node, where `requestAnimationFrame` does not exist — Reanimated
throws during the build. Prerendering buys nothing here in any case: every
screen is behind authentication, so there is no public HTML worth generating.

## Local ports

The local API runs on **54421**, not Supabase's default 54321.

A VS Code extension host binds `127.0.0.1:54321` on at least one machine here.
Docker publishes on the IPv6 wildcard (`*:54321`), so the IPv4 loopback
resolved to VS Code instead of Kong: every auth call answered `Cannot POST
/auth/v1/signup`, the app said only "Could not create the board", and
`supabase start`'s own health check failed against the same address and rolled
the whole stack back. It looked like a Docker fault for hours.

`e2e/global-setup.ts` now makes one request to `/auth/v1/health` before the
suite runs and fails loudly if the answer is not GoTrue. Changing the port
means changing three places together: `supabase/config.toml` `[api] port`,
`.env`, and `.env.example`.
