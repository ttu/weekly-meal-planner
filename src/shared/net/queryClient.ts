import { QueryClient } from '@tanstack/react-query'

/**
 * Deliberate defaults, not the library's.
 *
 * - staleTime 30s: realtime invalidates on every change, so a refetch on each
 *   mount is mostly waste; the window only has to cover a missed event.
 *   Foregrounding and reconnecting refetch regardless (see useQueryLifecycle).
 * - retry 2 for queries: a flaky signal in a shop heals itself; more just
 *   keeps a spinner up.
 * - mutations use networkMode 'online': offline, the optimistic update still
 *   shows (onMutate runs) and the write waits, then flushes on reconnect.
 *   Retries cover a dropped request mid-flight. The queue lives in memory: a
 *   write made offline is lost if the app is killed before reconnecting.
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 2,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
      },
      mutations: {
        networkMode: 'online',
        retry: 3,
      },
    },
  })
