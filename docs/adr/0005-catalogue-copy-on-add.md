# 0005 — Adding a catalogue meal copies it

Status: Accepted · 2026-08-29

## Context

Meals come from a curated public catalogue and from households' own libraries.
A household adding a catalogue meal could reference it, reference it until
edited, or copy it.

## Decision

Copy. The insert creates a household-owned meal, retaining
`copied_from_meal_id` for provenance.

## Consequences

- A family's copy is theirs to edit — swap milk for oat milk, fix servings,
  rename — which is what households actually do.
- A catalogue edit can never silently change a planned week or a shopping list
  that someone is standing in a shop holding.
- Households do not receive upstream improvements to catalogue meals. Accepted;
  provenance makes a future "the original changed" prompt possible if it is ever
  wanted.
- Storage cost is trivial at this scale.
