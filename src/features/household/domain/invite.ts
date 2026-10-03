/**
 * The token inside whatever someone pasted.
 *
 * An invite arrives as a link, and a link arrives via chat clients that add
 * things to it: a trailing full stop, angle brackets, a tracking query, a
 * wrapper around the whole thing. The person pasting has no idea which part
 * matters, so this takes the lot and finds the token rather than asking them
 * to trim it. A bare token typed by hand works too.
 *
 * Returns undefined when nothing in the input looks like a token. That is not
 * "wrong board" — it is "this is not an invite", and the screen says so before
 * anyone is asked for a password.
 */
const TOKEN = /[A-Za-z0-9_-]{43,}/

export const inviteToken = (pasted: string): string | undefined => {
  const afterJoin = pasted.split('/join/')[1] ?? pasted
  return TOKEN.exec(afterJoin)?.[0]
}
