# 02 — Architecture

## Overview

```
 Member's device (Expo: iOS / Android / web)            Cloudflare
┌──────────────────────────────────────────────┐       ┌──────────────┐
│ app/ routes ─► feature ui ─► application     │       │ relay/       │
│                    │             │           │       │ Worker       │
│                    ▼             ▼           │       │              │
│              useData/useView   domain (pure) │       │ ordered,     │
│                    │                         │       │ encrypted    │
│                    ▼                         │ HTTPS │ records per  │
│   SyncProvider ─► sync engine ─► rows on     │◄─────►│ board; no    │
│                   (encrypt, merge, verify    │       │ keys, no     │
│                    membership log)  device   │       │ plaintext    │
└──────────────────────────────────────────────┘       └──────────────┘
        ▲ other Members' devices pull the same records and merge ▲
```

- **The device is the system.** Every Member's device holds the Household's
  full data as rows and works offline. Screens read rows and derive everything
  else (the week board, the Shopping List) on the fly; nothing derived is stored.
- **The relay is a mailbox.** It stores opaque, encrypted records in arrival
  order and stamps when it got them. It cannot read, merge or authorise
  content — see `11-sync.md`.
- **Writes are local first.** A write lands in the device's rows at once; the
  sync loop encrypts it as an event and appends it to the relay, then pulls
  others' events and merges them per field (last writer wins by hybrid
  logical clock).
- **Trust is the signed membership log**, checked by every client, not the
  relay or application code (ADR 0013, `06-security.md`).
- **Reference data ships in the app.** The Catalogue and the ingredient
  taxonomy are files in `data/catalogue/`, not synced rows.
- **Leaving the app.** The Shopping List exits through the device (an Agent
  Prompt, a share; Apple Reminders is specified but not built). No backend of
  ours is involved.

## Shape

Domain-driven, vertical slices, impurity at the edges. One Expo app, local-first
and end-to-end encrypted (ADR 0013); a small relay (`relay/`, a Cloudflare
Worker) only holds encrypted records between visits.

```
src/
  features/
    household/      Members, slots, invites, settings
    meals/          Household library, catalogue copy-on-add, meal editor
    planning/       Week plan, backlog, cook events, leftovers, the board
    shopping/       List derivation, staples, cupboard check, extras, overrides, exits
    sync/           Engine, encryption, membership log, relay client, SyncProvider
  shared/           Generic only: ui kit, i18n, result, branded types, clock
  app/              Expo Router routes; thin, delegates into feature `ui`
```

Each feature owns:

```
features/<feature>/
  domain/           Pure. Types, invariants, transformations. No imports from
                    infrastructure, react or expo.
  application/      Use cases. Orchestrates domain + ports. Dependencies injected.
  infrastructure/   Device APIs (secure store, storage). Implements ports.
  ui/               Components and hooks for this feature.
  index.ts          The only public surface. Cross-feature imports go here.
```

**Cross-feature access is through `index.ts` only.** `shopping` needs cook
events; it imports them from `features/planning`, never from
`features/planning/infrastructure/...`. Enforced by `eslint-plugin-boundaries`
with a rule per layer, plus `dependency-cruiser` for circular-dependency
detection. Both run in `validate`, so a boundary violation fails the build
rather than a review.

**`shared/` is generic or it is not shared.** A `MealCard` is not shared — it is
`features/meals`. A `Button`, a `useDebounce`, the `Result` type and the branded
type helpers are. Code moves into `shared/` after a second real consumer exists,
not in anticipation of one.

## Where the domain logic lives

The shopping list is the system's actual output, and it is pure:

```
(cookEvents, mealIngredients, staples, overrides, extras) -> ShoppingList
```

It lives in `features/shopping/domain`, imports nothing but types, and is the
one place unit tests carry real weight. It stays inside the feature rather than
becoming its own package: the only consumers are the app and its tests. If the
App Intents work later needs it in a second runtime, that is the moment to
extract a package — not before.

## Impurity at the edges

Network, storage, clock and randomness are ports defined in `domain` or
`application`, implemented in `infrastructure`, and injected. No module-level
singletons — the sync engine is created from injected parts (relay, storage,
vault, randomness, clock) and passed down through `SyncProvider`.

The clock matters more than usual here: "this week", "today", ISO week
boundaries and the week strip all depend on it, and a test that cannot fix the
date is a test that fails one Sunday in seven.

## Authorization: the signed membership list

There is no server of ours to enforce anything in, and the relay is deliberately
dumb. Who may do what is the signed, hash-chained membership log, validated by
every client in the relay's order (`sync/domain/membership.ts`); what a record
means is decided by whoever can decrypt it. Application code does not add its
own checks on top. The consequence to accept: that log, the encryption and the
relay's rules are load-bearing, so their tests are adversarial (see
`04-testing.md`) and the protocol wants an outside review before release.

## Data as code

The public catalogue — ~120 everyday meals with their ingredients — is
**reference data in version control**, not rows someone typed into production.
It lives as schema-validated files under `data/catalogue/` (checked by
`scripts/catalogue-schema.ts` in the test run) and ships inside the app. Same for the ingredient taxonomy: categories, dimensions and unit
conversions are code, reviewed in PRs, diffable.

This is what makes the catalogue reproducible across environments and makes "who
changed the tacos recipe" a git question.

## State

The Household's data is a set of rows on the device (`03-datamodel.md`), read
through `useData()` / `useView()` from `SyncProvider`; a write lands locally at
once and the sync loop sends it (on start, on returning to the foreground, on
pull-to-refresh, and when a write is waiting; a send always pulls first). While
visible it also polls: every 15 s while the board is busy (a write here, or
another Member's write the relay stamped in the last 5 minutes), every 2 minutes
otherwise (`sync-loop.ts`). Reads cannot fail and writes
work offline, so screens keep `isLoading` / `isError` / `hasData` only for the
moment before the device has found its board. Client state (drag in progress,
sheet open, which day is scrolled to) is local component state or a small store.
A cook event never lives in both.

Hooks recompute from the rows when the board changes: the engine's view is a
cached snapshot (`viewStore`), so `useSyncExternalStore` sees a new object
exactly when something changed. Derived things (the Shopping List, the week
board) are computed in `useMemo` from the rows, never stored (ADR 0003).
`useIsOnline` reads the injected `NetworkSource` (expo-network on device,
`navigator.onLine` on web).
