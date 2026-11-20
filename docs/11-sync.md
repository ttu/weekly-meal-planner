# 11 — Sync

How a Household's data reaches every Member's phone without a server that can
read it. The decision is [ADR 0013](adr/0013-local-first-encrypted-sync.md); this
is how it works now. Code: `src/features/sync`, `relay/`.

## The idea

Every device keeps a full copy and works offline. A change is an **event**,
encrypted under the Household's key and put in a **relay**, a mailbox that
stores opaque records in the order it received them. Other devices pull,
decrypt, and merge. The relay never holds a key.

## Pieces

| Piece                | File                    | Job                                                                          |
| -------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| Hybrid logical clock | `domain/hlc.ts`         | Orders events from phones whose clocks disagree                              |
| Store                | `domain/store.ts`       | Last-writer-wins per field; order- and duplicate-proof                       |
| Crypto               | `domain/crypto.ts`      | XChaCha20-Poly1305 events, X25519 sealed key delivery                        |
| Identity             | `domain/identity.ts`    | A Member is their ed25519 signing key                                        |
| Membership log       | `domain/membership.ts`  | Signed, chained add / role / remove operations                               |
| Relay port           | `domain/relay.ts`       | create, append, rotate, pull; `application/http-relay.ts` is the HTTP client |
| Ingest               | `application/ingest.ts` | Pure: one relay record into a device's state                                 |
| Engine               | `application/engine.ts` | Create, join, write, sync, invite, setRole, removeMember                     |
| Data                 | `application/data.ts`   | Rows of a kind, by id, over the store                                        |

## Rules that matter

- **Events merge per field.** Two people editing different fields of one row both
  keep their change. Same field: the later hybrid-logical-clock stamp wins.
- **A deleted row is a `deleted` field**, so a later edit can bring it back.
- **The relay stamps `receivedAt`.** A writer's clock is judged against it, not
  against the reader's clock, so every device reaches the same verdict. A stamp
  more than a day ahead of it is dropped.
- **Membership is a log checked in relay order.** Each operation names the one
  before it and is signed by an admin; every device checks it against the state
  at that point and reaches the same membership. Two admins acting at once: the
  relay orders them, the second is refused everywhere, and its sender sees
  `conflict`.
- **Removal starts a new epoch.** A fresh key is sealed to exactly the remaining
  Members and the relay moves to a new token in one step. The old token can still
  _read_ up to the rotation record, so a Member who stays can fetch their new
  key; it can read nothing after it, and cannot write at all.
- **An invite is a seat.** An admin creates a Member's keys, adds them to the
  log, and hands over the secret in a link. Nobody needs to be online to join,
  and a lost phone is replaced the same way. Anyone holding the link is that
  Member until an admin removes them.
- **A recovery link is the holder's own seat.** It carries the Household, the
  current token and the Member's own keys, so a new device joins as that Member.
  An older token still reads up to its rotation, where the next key is sealed to
  the Member, so the link outlives removals of others. The board's first key is
  sealed to its creator in the `create` record for the same reason.
- **Events that arrive before their key are held** and retried when it arrives.

## What the relay sees

Record kind, epoch, size, order and time, and the signed membership operations
(public keys and roles). Never an event's content, a key, or a Household name.
Its functions raise `relay_<reason>`; every comparison fails closed on NULL.

## What a removed Member keeps

Everything they had synced. Rotation protects only what is written afterwards.
The product says so where it removes someone.

## Known gaps

See `TODO.md`: relay rotation is authorised by the current token alone, board
creation is capped for everyone together, events are not signed per author, and
the relay is a Cloudflare Worker and the app does not use Supabase at all.
