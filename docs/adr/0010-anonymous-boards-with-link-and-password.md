# 0010 — Anonymous boards, shared by link and password

Status: Accepted · 2026-09-11

Amends [0002](0002-rls-as-sole-authorization-point.md), which stands: row-level
security remains the only enforcement point. What changes is how a person
_becomes_ a Member.

## Context

Plan 01 chose "hosted app, shared Household account": everyone signs in with an
email and password. In practice that is a lot of friction for the thing this app
is — four people in one kitchen who want a board, not an account each. The first
screen an invited family member sees should not be a sign-up form.

## Decision

A person can start a board with no account at all:

1. **Anonymous sign-in** creates a real Supabase auth identity with no email.
2. Creating the board mints a **share token** — 32 random bytes, base64url — and
   stores a **board password** the creator chooses, hashed with bcrypt.
3. The board is shared as a URL carrying the token. Opening it asks for the
   password; both must be right to join.
4. Email sign-in stays. An anonymous identity can be upgraded later by adding an
   email, which is Supabase's own path and loses nothing.

## Consequences

- **The URL is a bearer credential and the password is the second factor.** The
  token alone is not enough, which matters because URLs leak in ways people do
  not expect: browser history, referrer headers, chat link previews, screenshots
  in a family group. Requiring the password means a leaked link is not a leaked
  board.
- **Joining needs `SECURITY DEFINER`**, and this is the one place in the system
  that has it. Someone who is not yet a Member cannot, by definition, read the
  Household row to check the token — RLS is doing its job. So `join_household`
  runs with elevated rights, and is written to do exactly one thing: verify the
  token and password, then insert a membership. It returns nothing about the
  Household on failure, so it cannot be used to probe for valid tokens.
- **Brute force is the real attack**, not guessing the token. 32 random bytes is
  not guessable; a family's board password might be. Attempts are rate-limited
  per token, and the limit is part of the function rather than the client.
- **An anonymous identity is disposable.** Clearing browser storage loses the
  only key to that Member's seat. The board survives — other Members still have
  it — but a single-Member board cleared from a single device is gone. The app
  says so at the point of creation rather than letting it be discovered.
- **Retention.** Anonymous accounts accumulate. Boards with one Member and no
  activity for 12 months are deleted by the existing retention job.

## Rejected

- **Token only, no password.** Simplest, and what the original brainstorm
  offered. Rejected because the token then travels in URLs that get pasted into
  group chats, and there is no way to un-share it short of rotating the token
  for everyone.
- **Password only, no token.** Then the board needs a guessable identifier, and
  short board names collide.
- **Hashing the password in the client.** The hash becomes the password; an
  attacker who learns it does not need the original.

## Amended: the join screen names the board

`board_preview(share_token)` returns a household's name and its Members' first
names and colours to anyone holding the link, before they know the password.
The join screen uses it to say "Join Koivisto household — Dad and Mum are
already planning. Ask one of them for the board password", which turns a bare
password prompt into something a person can act on.

This discloses a little to a leaked link, and it is consistent with the threat
model above: the token is 32 random bytes and is not guessable, so reaching
this at all means having been sent the link. The attack this ADR defends
against is brute-forcing the password, and that is unchanged — attempts are
still rate-limited, and a wrong link and a wrong password are still answered
the same way.

It returns names and nothing else: no ids, no token, no hash.
