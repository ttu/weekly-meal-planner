# 06 — Security and privacy

The server cannot read a Household's data, and nobody has an account. The threat
model, the cryptography and the known gaps are in [11-sync](11-sync.md) and
[ADR 0013](adr/0013-local-first-encrypted-sync.md); this file is the working
summary for someone writing code.

## Identity and access

- **A Member is a key.** Each device has an Ed25519 signing key (and an X25519
  key for receiving sealed keys), made on first use and kept in the secure store.
  There is no sign-in, no password and no email.
- **Access is the signed membership list**, checked by every client. Admins sign
  operations (`add`, `setRole`, `remove`); there may be several admins and the
  role is transferable. A Household always keeps one admin.
- **An invite is a seat.** An admin makes the new Member's keys and puts them in
  the link, after a `#` so it is never sent to a server. Whoever holds the link is
  that Member until an admin removes them. No admin has to be online to join, and
  the same path replaces a lost phone. A link is made on request, never by opening
  the share sheet, and shown as an "Unnamed" Member until its holder names
  themselves.
- **A new board always starts on the device's own keys**, never on a joined seat's,
  because the person who made an invite knows its secrets.

## What the relay sees

The relay (`relay/`, a Cloudflare Worker) stores opaque records in the order it
received them and checks one thing: that the caller knows the board's token, a
value derived from the current epoch key. It holds no key and reads no plaintext.
It sees that a board exists, how big it is, when records arrive, and IP addresses.
It does not see names, Meals, plans, or who is on the board (membership operations
are public-key signatures, not names).

- **Removing a Member starts a new epoch**: a fresh key sealed to exactly the
  remaining Members, and a new token. The old token can no longer write, and can
  read only up to the record that ended its epoch.
- **A removed Member keeps what they had already synced.** Rotation protects only
  what is written afterwards. The product says so where it removes someone.
- **Losing every device loses the Household** unless another device holds a copy;
  the share sheet's copy says so. A recovery seat is still to build (TODO.md).

## Abuse limits

Nothing authenticates a caller at the relay, so it limits what any caller can do:
1000 board creations an hour in all (counted when one succeeds), 100000 records
per board, 64 KB per record, 500 epochs per board. These are coarse. A per-caller
limit is in TODO.md.

## Known gaps

Recorded in `TODO.md` and not hidden: events are not signed per author, so any
Member can write as another (profiles, admin-only settings); any current Member can
move the relay to a token only they know (denial of service, not disclosure);
the relay is trusted for ordering and for the receipt time; **the cryptography and
protocol are our own and need a review by someone who does this professionally
before release.**

## Secrets and the bundle

Only the relay URL reaches the app bundle (`EXPO_PUBLIC_RELAY_URL`), and it is
public. Keys live in the secure store (`expo-secure-store`); on web there is none,
so they sit in `localStorage`, which anything running on the page can read: web is
for trusted devices. Cloudflare credentials exist only in CI (`CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`).

## Privacy and retention

There is no server-side copy of Household data to delete or export; it is on the
Members' devices, and leaving a board forgets it locally. The relay keeps encrypted
records for as long as the board exists. Nothing here is analytics: the app sends
no telemetry.
