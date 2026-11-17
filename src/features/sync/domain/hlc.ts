/**
 * Hybrid logical clock. Orders events across devices whose wall clocks
 * disagree: wall time first, then a counter for events inside one millisecond
 * or from a clock that stepped backwards, then the node id as a final tiebreak
 * so every client sorts identically.
 */
export type Hlc = { readonly wall: number; readonly counter: number; readonly node: string }

/** A remote stamp further ahead than this is a wrong clock, not a real event. */
export const MAX_DRIFT_MS = 24 * 3600_000 * 365

export const compareHlc = (a: Hlc, b: Hlc): number =>
  a.wall - b.wall ||
  a.counter - b.counter ||
  (a.node < b.node ? -1 : 0) ||
  (a.node > b.node ? 1 : 0)

export const tickHlc = (local: Hlc, now: number): Hlc =>
  now > local.wall
    ? { wall: now, counter: 0, node: local.node }
    : { wall: local.wall, counter: local.counter + 1, node: local.node }

export const receiveHlc = (local: Hlc, remote: Hlc, now: number): Hlc => {
  if (remote.wall - now > MAX_DRIFT_MS) throw new Error('remote clock is too far ahead')
  const wall = Math.max(local.wall, remote.wall, now)
  // Only clocks sitting at the winning wall time constrain the counter.
  const tied = [local, remote].filter((c) => c.wall === wall).map((c) => c.counter)
  const counter = tied.length > 0 ? Math.max(...tied) + 1 : 0
  return { wall, counter, node: local.node }
}
