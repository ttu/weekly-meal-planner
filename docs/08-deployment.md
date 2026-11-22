# 08 — Deployment

## Environments

| Environment | Relay                                                     | App                          |
| ----------- | --------------------------------------------------------- | ---------------------------- |
| local       | `wrangler dev` on the host, or nothing (tests use memory) | Expo dev                     |
| staging     | Worker `menami-relay-staging`                             | EAS internal distribution    |
| production  | Worker `menami-relay`                                     | TestFlight → App Store, Play |

The relay (`relay/`, ADR 0013) is the only thing we run. It holds encrypted
records between visits and nothing else, so there is no database to migrate, no
reference data to sync (the Catalogue ships inside the app) and nothing to back
up: a Household's data is on its Members' devices. Cloudflare Durable Objects
(SQLite-backed) hold one board each; check the current free-tier limits and price
before relying on them, and watch the Worker's request count, since every device
polls while visible: every 15 s while the board is busy, every 2 minutes when
it is quiet.

## Deploy pipeline

Two workflows, each deploying the relay before the web app so the app never ships
ahead of the relay it talks to:

| Workflow            | Trigger                                  | Environment  |
| ------------------- | ---------------------------------------- | ------------ |
| `deploy-staging`    | `validate` passes on a push to `main`    | `staging`    |
| `deploy-production` | a `v*` tag on a commit that is on `main` | `production` |

Each runs `wrangler deploy` for `relay/`, then exports the web app with that
environment's `EXPO_PUBLIC_RELAY_URL` and runs `eas deploy` (the `staging` alias,
or `--prod`). Both can also be run by hand from the Actions tab. **The relay
workflow has never run against Cloudflare**; the first deploy is where its
Durable Object migration (`relay/wrangler.toml`) gets checked.

Release: merge to `main`, check staging, then `git tag v0.1.0 && git push
origin v0.1.0`. Protect the `production` environment with a required reviewer.

One-time setup, in GitHub:

- Repository secrets: `CLOUDFLARE_API_TOKEN` (Workers edit), `CLOUDFLARE_ACCOUNT_ID`,
  `EXPO_TOKEN` (expo.dev access token).
- Per environment, variable `RELAY_URL`: the deployed Worker's URL. It is public.
- Run `eas init` once and commit the `extra.eas.projectId` it adds to `app.json`;
  the workflows refuse to run without it.

Native builds are separate, through EAS Build.

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

**E2E** is to be rebuilt against a local relay (see `04-testing.md`); nothing runs
in CI yet.

`pnpm run validate:all` locally reproduces CI, and pre-push runs it.

## Web output

`app.json` sets `web.output: "single"`, not `"static"`. Static output prerenders
every route in Node, where `requestAnimationFrame` does not exist — Reanimated
throws during the build. Prerendering buys nothing here in any case: every
screen needs a board, which is on the device, so there is no public HTML worth
generating.
