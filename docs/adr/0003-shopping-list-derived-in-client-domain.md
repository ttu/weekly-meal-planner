# 0003 — Shopping list derived in pure client-side domain code

Status: Accepted · 2026-08-29

## Context

The shopping list is the app's actual output. It could be computed by a Postgres
view/RPC, in the client, or via an event-sourced plan. An earlier plan for an MCP
server implied a second runtime consumer, which argued for putting it in the
database.

## Decision

Derive it in pure TypeScript in `features/shopping/domain`, as
`(cookEvents, mealIngredients, staples, overrides, extras) -> ShoppingList`.
Not in SQL, and not in its own package yet.

## Consequences

- Unit conversion, staple filtering and provenance stay in one testable place
  with no database round-trip.
- The MCP server was dropped in favour of OS-level handoff, removing the second
  runtime consumer that would have justified SQL.
- Client-side aggregation fetches raw `meal_ingredient` rows, slightly more
  egress than returning finished lines. Immaterial at household scale.
- No third party can query the list in SQL. Accepted; the handoff is by prompt,
  share sheet and later App Intents.
- If App Intents later need the logic in a second runtime, that is the moment to
  extract a package — not before.

## Rejected

- **Postgres view/RPC** — better if SQL consumers existed; they do not.
- **Event sourcing** — an audit trail for a family of four is machinery without
  a problem.
