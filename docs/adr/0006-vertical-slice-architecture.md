# 0006 — Vertical slices over technical layers

Status: Accepted · 2026-09-08

## Context

The app has a handful of clearly separable capabilities — household, meals,
planning, pantry, shopping. Organising by technical layer (`components/`,
`hooks/`, `services/`) scatters each capability across the tree.

## Decision

Organise by feature: `features/<feature>/{domain,application,infrastructure,ui,index.ts}`,
plus a genuinely generic `shared/`. Cross-feature access only through each
feature's `index.ts`.

## Consequences

- A change to leftovers touches one directory.
- Boundaries are enforced mechanically by `eslint-plugin-boundaries` and
  `dependency-cruiser`, failing `validate` rather than a review.
- `shared/` requires discipline: code moves there after a second real consumer,
  not in anticipation. Feature-specific code there is the failure mode to watch.
- Circular dependencies are banned outright.
- Some duplication across slices is expected and preferred to premature sharing.
