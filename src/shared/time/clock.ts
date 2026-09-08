export type Clock = { now: () => Date }

export const systemClock: Clock = { now: () => new Date() }

/** "This week" and ISO week boundaries depend on the clock, so a test that
 *  cannot fix the date fails one Sunday in seven. Injected, never imported
 *  inside domain code. */
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) })
