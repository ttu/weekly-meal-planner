# 0013 — Local-first, end-to-end-encrypted sync over a dumb relay

Status: Accepted · 2026-11-17

Supersedes [0002](0002-rls-as-sole-authorization-point.md) and
[0010](0010-anonymous-boards-with-link-and-password.md), and replaces the
Supabase half of [0001](0001-expo-and-supabase.md), once the
migration slices land. Until then the old ADRs describe the running system.

## Context

A Household should be able to share a board using only its members' clients.
Three goals, all wanted: the server must not be able to read a Household's data
(privacy), running it must cost almost nothing, and the app must not depend on
a backend we operate. Members open the app at the same time or at different
times, so something has to hold changes between visits; it may be a server, but
only as a mailbox.

An admin must be able to cut any Member off at any time. There are several
admins and the role is transferable.

## Options considered

- **Jazz 2 (alpha).** A server-authoritative relational database: the server
  stores plaintext SQLite and enforces row policies. Its E2EE module is
  labelled experimental and unaudited. Fails the privacy goal.
- **Jazz classic 0.14.** Has groups, admin roles and key rotation, but is no
  longer maintained and pins an `expo-sqlite` older than Expo 57's. Rejected.
- **Evolu.** Sharing is one shared owner secret, so there are no per-Member
  keys, roles or removal, and its React Native package needs React Native 0.88
  or newer. Rejected.
- **Electric, PowerSync.** The server reads plaintext. Rejected.
- **Automerge, Loro.** WASM cores that do not run on Hermes, and no encryption.

No existing library meets all of the requirements, so we write a small
protocol. A household board has few writers and little data, which keeps it
small.

## Decision

1. **The data lives on the Members' devices.** Each client keeps a full local
   copy, works offline, and merges changes when it connects.
2. **Every change is an event** with a hybrid-logical-clock timestamp, merged
   last-writer-wins per field. No CRDT library.
3. **Events are encrypted under a Household key per epoch**, using the audited,
   pure-JS `@noble` libraries. No native module, so Expo Go and web both work.
4. **Membership is a signed list.** Admins sign it with Ed25519; it records each
   Member's public key and role. Several admins are allowed and the role is
   transferable. Each Member holds the current epoch key sealed to their own
   public key.
5. **Removing a Member starts a new epoch.** A fresh key is sealed only to the
   remaining Members, and the relay stops accepting the old epoch's writes.
6. **The relay is a small Cloudflare Worker**, one Durable Object per board
   holding `(epoch, seq, ciphertext)` records, reached by plain HTTP (`relay/`).
   It holds no keys and no plaintext, stamps receipt time itself, and checks one
   thing: knowledge of the board's token. Clients only know the `Relay` port, so
   it can move. Delivery is by polling. Supabase is not used at all.
7. **The Catalogue is shipped, not synced.** `data/` becomes versioned static
   JSON in the app. ADR 0005 already copies a Catalogue Meal on add.
8. **The Shopping List stays derived** (ADR 0003), now over local data.
9. **Validation moves into the client.** Unit/Dimension convertibility, Slot
   validity and write limits were database constraints; they become domain
   parsing, and the domain tolerates bad data written by a Member.

## Consequences

- **A removed Member keeps what they had already synced.** Rotation protects
  only what is written afterwards. The product says so.
- **Losing every device loses the Household** unless a recovery key exists, so
  one is part of the design.
- **We own the crypto and protocol.** The core is pure TypeScript with
  adversarial tests, written before any UI moves, and reviewed before release.
- **No server-side Board Preview.** The relay cannot read the Household name.
- **Photos need encrypted blob storage** instead of the private bucket.
- **Supabase goes entirely**: Auth, the data tables, RLS and the database. The
  relay's token check is its only access control.
- **Tests change.** PGlite (ADR 0007) and RLS-adversarial tests give way to
  tests of the core and a fake relay.
- **Authorization is the signed membership list**, checked by clients.
