# 02 — Architecture

## Shape

Domain-driven, vertical slices, impurity at the edges. One Expo app, one
Supabase project, no server of our own.

```
src/
  features/
    household/      Members, slots, invites, auth session
    meals/          Household library, catalogue copy-on-add, meal editor
    planning/       Week plan, backlog, cook events, leftovers, the board
    pantry/         Staples, running-low
    shopping/       List derivation, cupboard check, extras, overrides, exits
  shared/           Generic only: ui kit, i18n, result, branded types, clock
  app/              Expo Router routes; thin, delegates into feature `ui`
```

Each feature owns:

```
features/<feature>/
  domain/           Pure. Types, invariants, transformations. No imports from
                    infrastructure, react, expo, or supabase-js.
  application/      Use cases. Orchestrates domain + ports. Dependencies injected.
  infrastructure/   Supabase queries, storage, device APIs. Implements ports.
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
singletons — including the Supabase client, which is created by a factory and
passed down through a provider.

The clock matters more than usual here: "this week", "today", ISO week
boundaries and the week strip all depend on it, and a test that cannot fix the
date is a test that fails one Sunday in seven.

## Authorization: one enforcement point

**Postgres row-level security, and nothing else.** There is no server of ours to
enforce anything in, the client talks to PostgREST directly, and a second
enforcement layer in application code would drift from the policies and give
false confidence. Every table carries `household_id` and a policy keyed on
household membership. The client is assumed hostile.

The consequence to accept: RLS is now load-bearing, so its tests are the ones
that must be adversarial (see `04-testing.md`).

## Data as code

The public catalogue — ~120 everyday meals with their ingredients — is
**reference data in version control**, not rows someone typed into production.
It lives as schema-validated files under `data/catalogue/`, is validated at load
against the same schema the domain uses, and is pushed to the database by a sync
script. Same for the ingredient taxonomy: categories, dimensions and unit
conversions are code, reviewed in PRs, diffable.

This is what makes the catalogue reproducible across environments and makes "who
changed the tacos recipe" a git question.

## State

Server state and client state never mix. Server state is TanStack Query over the
Supabase client, with realtime subscriptions invalidating it. Client state
(drag in progress, sheet open, which day is scrolled to) is local component
state or a small store. A cook event never lives in both.
