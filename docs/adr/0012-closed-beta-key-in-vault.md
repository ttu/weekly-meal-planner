# 0012 — A closed-beta key in Supabase Vault

Status: Accepted · 2026-10-15

Amends [0010](0010-anonymous-boards-with-link-and-password.md), which stands:
boards stay anonymous. What changes is who may start or join one while the app
is in beta.

## Context

Anonymous boards mean anyone who finds the app can start one, and nothing yet
verifies an email. Until it does, the app should be open only to people who
have been invited, on every environment — development, staging and production.

## Decision

A single shared **beta key**, stored in Supabase Vault as the secret named
`beta_key`, is required by `create_board` and `join_board`.

- **Checked in the database.** A key checked by the app is a key anyone can skip
  by calling the RPC directly, so the two `SECURITY DEFINER` functions check it,
  through `app.beta_key_accepted`, which is not in an exposed schema.
- **Vault, not an environment variable.** Postgres functions cannot read
  Supabase's Edge Function secrets or a GitHub environment, and nothing in CI
  deploys the database. Vault is the secret store the database itself can read,
  and the key is set per project in the dashboard with no redeploy.
- **No secret, no gate.** Deleting the secret opens the app again; that is how
  the gate comes off once email verification exists.
- **Local development is gated too**, with a fixed key from
  `supabase/seed.sql`, so the gate is exercised every day rather than first met
  on staging.
- `public.beta_key_required()` tells the screens whether to ask, and says
  nothing about the key itself.

## Consequences

- Joining a board now takes the key as well as the link and the password. That
  is friction for an invited family member, accepted for the beta only.
- A wrong key is counted against whoever guessed, on both `create_board` and
  `join_board`: ten an hour per account and thirty per address, after which
  even the right key is refused until the hour is up. It was first counted per
  share token, which a guesser changes on every try, and `create_board` raised
  on a wrong key, which rolled back the record of the guess, so neither door
  was limited. Both now return a status, and the count lives in
  `beta_key_attempt`. The count and the record of a wrong guess are one step,
  under an advisory lock per account and per address, so a burst of parallel
  guesses cannot all read the same count and pass. Anonymous sign-in makes accounts cheap, so the address
  limit is the one that holds, and it is only as good as `x-forwarded-for`.
  The key is still a beta gate, not a credential that protects anyone's data,
  and should be long enough not to be guessed.
- When a deploy workflow exists, it can write the Vault secret from a GitHub
  environment secret without changing anything in the database.
