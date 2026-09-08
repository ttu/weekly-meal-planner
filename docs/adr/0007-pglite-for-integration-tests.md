# 0007 — pglite for integration tests

Status: Accepted · 2026-09-08

## Context

The test diamond puts ~70% of tests at integration level, and the highest-risk
behaviour in this app is RLS. Those tests need real Postgres semantics —
`jsonb`, check constraints calling functions, and policies — and need to be fast
enough to run in a pre-commit hook.

## Decision

pglite: real Postgres, in-process, no container. Testcontainers is reserved for
cases where vendor-specific behaviour genuinely matters. SQLite is not used.

## Consequences

- Integration tests run in the local loop rather than only in CI, which is what
  makes the diamond's 70% affordable.
- SQLite would not honour this schema and would give false confidence.
- pglite has no Supabase auth layer, so `auth.uid()` is a test shim reading a
  session-local setting. This is a knowing divergence from production and is
  documented in `04-testing.md` so nobody discovers it while debugging a policy.
- Realtime and Storage are out of scope for these tests and are verified with
  real clients.
