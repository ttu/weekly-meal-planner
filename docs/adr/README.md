# Architecture Decision Records

ADRs record a decision, its context and its consequences at a point in time.
**They are immutable.** A decision that changes gets a new ADR that supersedes
the old one; the old one stays, marked superseded.

Design docs (`docs/0X-*.md`) describe how things work *now* and are edited
freely. ADRs describe why we chose what we chose, and are not.

| # | Decision | Status |
|---|---|---|
| [0001](0001-expo-and-supabase.md) | Expo and Supabase as the platform | Accepted |
| [0002](0002-rls-as-sole-authorization-point.md) | Row-level security is the only authorization point | Accepted |
| [0003](0003-shopping-list-derived-in-client-domain.md) | Shopping list derived in pure client-side domain code | Accepted |
| [0004](0004-leftovers-as-separate-table.md) | Leftovers are a separate table referencing a cook event | Accepted |
| [0005](0005-catalogue-copy-on-add.md) | Adding a catalogue meal copies it | Accepted |
| [0006](0006-vertical-slice-architecture.md) | Vertical slices over technical layers | Accepted |
| [0007](0007-pglite-for-integration-tests.md) | pglite for integration tests | Accepted |
| [0008](0008-no-monetisation-in-v1.md) | No ads or monetisation in v1 | Accepted |
