# 06 — Security Model

## Authentication

Supabase Auth. A `user` is an auth identity; a `Member` is that identity's
membership of a household, and carries the display name and colour. The
distinction matters because leaving a household must revoke data access without
deleting the account.

Household joining is by invite link with a single-use, expiring token. An invite
grants `member`; only an `owner` can invite or remove.

## Authorization

**Row-level security, and nothing else.** See `02-architecture.md` for why there
is exactly one enforcement point. Consequences:

- Every table has RLS enabled and a policy. A table without a policy is
  unreachable, which is the correct default and is asserted by a test.
- Policies key on household membership via a `SECURITY DEFINER` helper, so the
  membership lookup itself is not subject to the policy it supports.
- Catalogue rows (`household_id IS NULL`) are world-readable and writable by
  nobody through the client. The sync script uses the service role, server-side,
  never in the app.
- The client is assumed hostile. It holds an anon key and a user JWT, both of
  which are public by construction.

RLS tests are adversarial by design — see `04-testing.md`.

## Secrets

Only the Supabase URL and anon key reach the bundle, and both are public by
definition. The service role key exists in CI and on developers' machines for
the catalogue sync, never in `app.config`, never in an `EXPO_PUBLIC_` variable.

Any variable prefixed `EXPO_PUBLIC_` is treated as published. Secret scanning
runs in CI, as does dependency scanning.

## Input handling

Everything crossing a boundary is schema-validated before use, including data
coming back from our own database. Queries go through PostgREST or parameterised
RPC; no string-built SQL anywhere, including in the sync script.

## Privacy and GDPR

The app holds: an email address, a display name, an optional avatar, and what a
household eats. The last of those is more revealing than it first appears —
meal history implies religion, health conditions and household composition —
so it is treated as personal data throughout.

- **Retention:** week plans older than 12 months are deleted by a scheduled job.
  Meals and staples persist until the household deletes them.
- **Deletion:** an owner can delete a household, which hard-deletes its rows.
  Deleting the last membership of a user deletes the auth identity.
- **Export:** a household's data is exportable as JSON on request.
- **Logs** carry no meal names and no display names; redaction is configured in
  the logger, not left to call sites.
- **No analytics SDK** in v1. If one is added later it needs consent, and that
  is a decision for an ADR, not a library install.

## Sharing surfaces

Two features publish data outside the app and both need care:

- **The Agent Prompt** puts a shopping list on the clipboard, destined for a
  third-party AI agent. It contains no names, no household id and no URL — just
  items and quantities. That is a deliberate constraint on the template.
- **The read-only web link** (deferred, v2) would expose a week's list to anyone
  holding the URL. When it lands it needs an expiring token and an ADR covering
  what is exposed.
