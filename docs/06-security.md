# 06 — Security Model

## Authentication

Supabase Auth. A `user` is an auth identity; a `Member` is that identity's
membership of a household, and carries the display name and colour. The
distinction matters because leaving a household must revoke data access without
deleting the account.

**Anonymous identities are a first-class path** (ADR 0010). Starting a board
asks for no account: the app signs in anonymously and creates the board. Email
sign-in remains, and an anonymous identity is upgraded by adding an email in
Settings.

**An address is not an address until a link in it has been clicked.**
`enable_confirmations` is on, so adding an email leaves it pending: the
identity stays anonymous, nothing on the board changes, and the account is
only upgraded by the click. `double_confirm_changes` is off because the
address being added is the identity's first — there is no old inbox to
confirm from, and with it on the change never completes.

**Creating boards is rate-limited** — five an hour per account, twenty per
address. The address comes from the forwarded-for header and is advisory; the
per-account count is the one that holds. Joining was already throttled, ten
attempts per share token per fifteen minutes.

`household_member.user_id` is a foreign key to `auth.users` with
`on delete cascade`. Without it a deleted account leaves a ghost Member that
still shows a name on Backlog cards and that nothing can clean up — likely
rather than theoretical once identities are disposable.

## Board sharing

A board is shared as a URL carrying a **share token** — 32 random bytes,
base64url — and joining also requires the **board password**, stored as a
bcrypt hash and never in plaintext.

**The URL is a bearer credential; the password is what makes that survivable.**
URLs leak in ways people do not anticipate: browser history, referrer headers,
chat link previews, a screenshot in a family group. Requiring the password means
a leaked link is not a leaked board.

Two functions are `SECURITY DEFINER`, and they are the only ones in the system:

- **`create_board`** — a person creating their first board is not a Member of
  anything, so no policy has anything to check. Making this the only way to
  create a Household is stronger than a permissive insert policy: a client
  cannot write a household row at all.
- **`join_board`** — someone holding a link is not yet a Member, so RLS
  correctly hides the row they are trying to join. It returns `rejected` for a
  wrong token and a wrong password alike, so it cannot be used to discover which
  links are real, and it counts failures per token and refuses past ten in
  fifteen minutes, because the password is the guessable half.

`join_board` returns a status rather than raising. Raising would abort the
transaction and roll back the record of the failed attempt, leaving the rate
limiter counting nothing — which it did, until a test caught it.

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

**CI supply chain.** Every GitHub Action is pinned to a commit SHA, not a tag:
a tag is mutable, so `@v4` is an unreviewed dependency that can be repointed
under us. The release each SHA corresponds to is recorded in a trailing comment
so upgrades stay reviewable. Workflows declare `permissions: contents: read`;
nothing in `validate.yml` needs write access.

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
