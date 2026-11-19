/**
 * An invite is a seat on the board, and the link carries everything for it:
 * four 32-byte values as 256 hex characters after a `#`. The fragment is never
 * sent to a server, so the host serving the page learns nothing of the board.
 *
 * Whoever holds the link is that Member until an admin removes them, so it is
 * shared like a key, not like a URL.
 */
export type InviteSeat = {
  readonly household: string
  readonly token: string
  readonly signSecretKey: string
  readonly boxSecretKey: string
}

const HEX_256 = /(?<![0-9a-f])[0-9a-f]{256}(?![0-9a-f])/
const PART = 64

export const inviteLink = (origin: string, seat: InviteSeat): string =>
  `${origin}/join#${seat.household}${seat.token}${seat.signSecretKey}${seat.boxSecretKey}`

/**
 * The seat inside whatever someone pasted. Chat clients add full stops,
 * brackets and tracking, so this finds the key rather than asking anyone to
 * trim it. Undefined means "this is not an invite", said before anything is tried.
 */
export const parseInviteLink = (pasted: string): InviteSeat | undefined => {
  const hex = HEX_256.exec(pasted.toLowerCase())?.[0]
  if (hex === undefined) return undefined
  return {
    household: hex.slice(0, PART),
    token: hex.slice(PART, 2 * PART),
    signSecretKey: hex.slice(2 * PART, 3 * PART),
    boxSecretKey: hex.slice(3 * PART),
  }
}
