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
  key; it can read nothing after it, and cannot write at all. A device checks
  the removal itself before sending it, and the rotation names the last
  membership record it builds on: if another admin's change landed since, the
  relay refuses and the token stays where everyone has its key. The removal is
  then built again on a fresh pull, up to five times. Membership records are
  capped at 20 a minute per board, so a Member cannot outrun that.
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
  Past 2000 held, the first one not kept is remembered, and the device pulls
  again from there once a key arrives.
- **A write the others would drop is refused on the writing device**, and a local
  clock more than a day ahead starts over from the wall clock, so one wrong
  reading does not lose every later write.
- **Keys are saved before the snapshot**, so a snapshot never points past a key
  the device lacks. The vault is written only when the keys or the invite token
  change; saves run one after another, so the last one written is the latest.
  Each relay call gives up after 15 seconds, as offline.
- **A local write never waits for the network.** It lands in the outbox and the
  snapshot at once; syncs, invites and removals queue behind each other, not in
  front of writes. `writeMany` writes several fields of a row as one save, and
  `Data.put` uses it.
- **A write too big for the relay is refused on the writing device**: more than
  64 KiB of hex once sealed would be refused on every try, and hold up every
  write queued after it.
- **`lastSeq` only moves over records with none missing before them.** A
  device's own append can land past records another device added since its last
  pull; those are pulled next time, not skipped.
- **A saved board that cannot be read is an error, not "no board".** The app
  shows the load error with a retry instead of sending the device to /start,
  where starting a board would replace the seat it still has.

## What the relay sees

Record kind, epoch, size, order and time, and the signed membership operations
(public keys and roles). Never an event's content, a key, or a Household name.
Its functions raise `relay_<reason>`; every comparison fails closed on NULL.

A board holds at most 100,000 records and 50 MB of payload (a little more for a
rotation, so a full board can still cut a Member off); past either, appends are
refused as `full`. A pull page ends at 500 records or about 1 MB of payload,
whichever comes first, and always holds at least one record.

The Worker turns away, before any board's object wakes: a board name it cannot
decode, a body over 200 KB, and a caller IP past 300 calls a minute. Board
creation is checked and counted against the hourly cap in one call to the gate,
and given back if the board is not made, also when making it fails outright. Tests run the real Worker with only
its storage faked (`relay/memory.ts`).

## What a removed Member keeps

Everything they had synced. Rotation protects only what is written afterwards.
The product says so where it removes someone.

## Known gaps

See `TODO.md`: relay rotation is authorised by the current token alone, board
creation is also capped for everyone together, events are not signed per author, and
the relay is a Cloudflare Worker and the app does not use Supabase at all.
