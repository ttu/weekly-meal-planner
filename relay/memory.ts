import type { Kv } from './core'

/** Storage in memory, with the same contract as a Durable Object's. For tests. */
export const memoryKv = (): Kv => {
  const data = new Map<string, unknown>()
  return {
    get: <T>(key: string) => Promise.resolve(data.get(key) as T | undefined),
    put: (entries) => {
      for (const [k, v] of Object.entries(entries)) data.set(k, structuredClone(v))
      return Promise.resolve()
    },
    list: <T>({ prefix, start, limit }: { prefix: string; start: string; limit: number }) =>
      Promise.resolve(
        new Map(
          [...data]
            .filter(([k]) => k.startsWith(prefix) && k >= start)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .slice(0, limit) as [string, T][],
        ),
      ),
  }
}

export const memoryDirectory = () => {
  const boards = new Map<string, Kv>()
  return {
    gate: memoryKv(),
    board: (id: string): Kv => {
      const existing = boards.get(id)
      if (existing) return existing
      const fresh = memoryKv()
      boards.set(id, fresh)
      return fresh
    },
    /** Reaches into a board the way an operator with database access could. */
    boards,
  }
}
