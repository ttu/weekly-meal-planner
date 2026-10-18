import { QueryClient } from '@tanstack/react-query'

/**
 * Deliberate defaults, not the library's.
 *
 * - staleTime 30s: realtime invalidates on every change, so a refetch on each
 *   mount is mostly waste; the window only has to cover a missed event.
 *   Foregrounding and reconnecting refetch regardless (see useQueryLifecycle).
 * - retry 1 after 1 s for queries: a flaky signal in a shop heals itself, but
 *   every further attempt keeps a spinner up before the error state shows. A
 *   first-load failure surfaces in about two seconds.
 * - mutations use networkMode 'online': offline, the optimistic update still
 *   shows (onMutate runs) and the write waits, then flushes on reconnect.
 *   The queue lives in memory: a write made offline is lost if the app is
 *   killed before reconnecting.
 * - mutations do not retry by default. A write that commits but loses its
 *   response would be inserted twice (two Extras, two Cook Events), and errors
 *   like not-signed-in or an RLS refusal never heal. A mutation opts in with
 *   `retry: IDEMPOTENT_WRITE_RETRY` only when repeating it leaves the same
 *   state: a set-to-value update, an upsert, a delete.
 */
export const QUERY_RETRY_DELAY_MS = 1000

/** For mutations whose repeat is harmless: updates to a value, upserts, deletes. */
export const IDEMPOTENT_WRITE_RETRY = 2

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        retryDelay: QUERY_RETRY_DELAY_MS,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
      },
      mutations: {
        networkMode: 'online',
        retry: 0,
      },
    },
  })
