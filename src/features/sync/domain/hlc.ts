/**
 * Hybrid logical clock. Orders events across devices whose wall clocks
 * disagree: wall time first, then a counter for events inside one millisecond
 * or from a clock that stepped backwards, then the node id as a final tiebreak
 * so every client sorts identically.
 */
export type Hlc = { readonly wall: number; readonly counter: number; readonly node: string }

/** A remote stamp further ahead than this is a wrong clock, not a real event. */
export const MAX_DRIFT_MS = 24 * 3600_000

export const MAX_COUNTER = 0xffff
const MAX_NODE_LENGTH = 64

const isCount = (n: unknown, max: number): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max

/**
 * Untrusted stamps are checked before use: NaN, a huge counter or a wrong shape
 * would win or freeze every comparison, or crash the merge.
 */
export const isValidHlc = (hlc: unknown): hlc is Hlc =>
  typeof hlc === 'object' &&
  hlc !== null &&
  'wall' in hlc &&
  'counter' in hlc &&
  'node' in hlc &&
  isCount(hlc.wall, Number.MAX_SAFE_INTEGER - 1) &&
  isCount(hlc.counter, MAX_COUNTER) &&
  typeof hlc.node === 'string' &&
  hlc.node.length > 0 &&
  hlc.node.length <= MAX_NODE_LENGTH

/** The one place that decides whether a remote stamp may be believed. */
export const isPlausibleHlc = (hlc: unknown, now: unknown): hlc is Hlc =>
  isValidHlc(hlc) && isCount(now, Number.MAX_SAFE_INTEGER) && hlc.wall - now <= MAX_DRIFT_MS

/** A full counter rolls into the next millisecond, so a clock can always advance. */
const stamp = (wall: number, counter: number, node: string): Hlc =>
  counter > MAX_COUNTER ? { wall: wall + 1, counter: 0, node } : { wall, counter, node }

export const compareHlc = (a: Hlc, b: Hlc): number =>
  a.wall - b.wall ||
  a.counter - b.counter ||
  (a.node < b.node ? -1 : 0) ||
  (a.node > b.node ? 1 : 0)

export const tickHlc = (local: Hlc, now: number): Hlc =>
  now > local.wall
    ? { wall: now, counter: 0, node: local.node }
    : stamp(local.wall, local.counter + 1, local.node)

export const receiveHlc = (local: Hlc, remote: Hlc, now: number): Hlc => {
  if (!isValidHlc(remote)) throw new Error('invalid remote clock')
  if (!isPlausibleHlc(remote, now)) throw new Error('remote clock is too far ahead')
  const wall = Math.max(local.wall, remote.wall, now)
  // Only clocks sitting at the winning wall time constrain the counter.
  const tied = [local, remote].filter((c) => c.wall === wall).map((c) => c.counter)
  return stamp(wall, tied.length > 0 ? Math.max(...tied) + 1 : 0, local.node)
}
