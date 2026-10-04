/**
 * Enough of an address to be worth sending to.
 *
 * Deliberately not a full RFC check: the only real test of an address is
 * whether the link arrives, and a stricter pattern rejects addresses that
 * work. This catches the typo that is obvious — no @, no dot after it, a
 * space in the middle — and leaves the rest to the inbox.
 */
const SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

export const isPlausibleEmail = (input: string): boolean => SHAPE.test(input.trim())
