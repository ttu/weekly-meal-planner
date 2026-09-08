# 0002 — Row-level security is the only authorization point

Status: Accepted · 2026-08-29

## Context

The app talks to PostgREST directly; there is no server of ours. Authorization
could live in application code, in the database, or — the common accident — in
both, inconsistently.

## Decision

Postgres row-level security is the sole enforcement point. Every table has RLS
enabled and a policy keyed on household membership. No authorization logic in
application code.

## Consequences

- There is exactly one place to read to know who can see what.
- A table shipped without a policy is unreachable rather than public. This is the
  right default and is asserted by a test.
- RLS becomes load-bearing, so its tests must be adversarial: the tests that
  matter prove household A *cannot* reach household B, not that a member can
  reach their own data.
- Membership lookup uses a `SECURITY DEFINER` helper, so the lookup is not
  subject to the policy it supports.
- The catalogue sync script needs the service role and therefore runs
  server-side only, never in the app.
