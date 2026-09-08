# 0004 — Leftovers are a separate table referencing a cook event

Status: Accepted · 2026-08-29

## Context

A meal cooked once can feed several sittings. The plan needs to show the later
sittings without double-counting ingredients. Options were a nullable parent on
one table, a servings ledger, or a separate table.

## Decision

`cook_event` is the only ingredient contributor. `leftover` is its own table
with a cascading reference to a cook event, its own date and slot, no meal and
no servings.

## Consequences

- Shopping-list derivation reads `cook_event` alone. Leftovers cannot
  double-count because they carry nothing to count.
- Deleting a cook event cascades to its leftovers, so a leftover can never be
  stranded — which matches the UI, where a leftover card is visibly tied to its
  parent by a stub.
- Queries avoid an "is this a real meal?" branch that a single table with a
  nullable parent would put in every one of them.
- `servings_cooked` is retained on the cook event and displayed as "Cooking N",
  but never enforced against the number of dependent leftovers. A family may
  claim four dinners from one pot; the app is not the arbiter.
