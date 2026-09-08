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

Mirrors the local gates as parallel jobs — format, lint, type-check,
duplication, unit, integration (pglite), build. Plus dependency and secret
scanning. Dependencies install from the lockfile and are cached. Artifacts
upload on failure. A preview build per PR once EAS is wired.

`pnpm run validate:all` locally reproduces CI, and pre-push runs it.
