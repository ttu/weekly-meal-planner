# 0009 — Finnish and English from the first commit

Status: Accepted · 2026-09-08

## Context

The project rules forbid hardcoded user-facing strings. The first real
households are Finnish; the design's own copy is Finnish. Retrofitting i18n is
a whole-codebase refactor, and retrofitting it into a _data model_ is worse.

## Decision

Ship Finnish and English together from the start. Every string goes through
`t()`. The public catalogue carries both languages. Locale is a household
setting.

## Consequences

- **An Ingredient's identity is a locale-independent `slug`, not its name.**
  Otherwise `sipuli` and `onion` aggregate as two Buy Lines and the shopping
  list is wrong — the app's single most important output, broken by a
  translation. Display names live in `ingredient_name`, one row per locale.
- The catalogue seed doubles in size: ~120 meals with names, descriptions and
  validated ingredient slugs in two languages. This is the largest non-code
  deliverable in v1 and is scheduled as work.
- A **Household Meal has one name**, in whatever language the family typed. Their
  own meals are theirs; demanding two names would add friction to the exact
  screen that must have none.
- The Agent Prompt is generated in the household's locale, so the browser agent
  is asked for groceries in the language of the shop.
- Units and category labels are translated from stable keys in the UI, never
  stored as display text.
- Adding a third language later is content plus one locale column value, not a
  migration.
