import type { AppSupabaseClient } from '@/features/household'

/**
 * What PostgREST hands back for one query: rows, or an error. A dropped
 * connection, an expired token and an RLS refusal all arrive as `error` with
 * `data: null`, which is exactly the shape the repositories must not mistake
 * for "no rows".
 */
export type FakeResponse = {
  readonly data: unknown
  readonly error: { readonly message: string } | null
}

export const rows = (data: unknown): FakeResponse => ({ data, error: null })
export const failure: FakeResponse = { data: null, error: { message: 'network down' } }

/**
 * The Supabase client is a system boundary, so it is the one thing tests fake.
 * Every table answers with whatever `responses()` says at the moment the query
 * is awaited, so a test can fail a load and then let the retry succeed.
 */
export const fakeSupabase = (
  responses: () => Readonly<Record<string, FakeResponse>>,
): AppSupabaseClient => {
  const chain = (table: string): unknown =>
    new Proxy(() => undefined, {
      get: (_target, prop) => {
        if (prop === 'then') {
          return (resolve: (value: FakeResponse) => void) => {
            resolve(responses()[table] ?? rows([]))
          }
        }
        // Every builder method returns the builder; maybeSingle() resolves
        // through `then` above like any other query.
        return () => chain(table)
      },
    })

  // Realtime and presence channels are fire-and-forget as far as a load goes.
  const channel: unknown = new Proxy(() => undefined, { get: () => () => channel })

  return {
    from: (table: string) => chain(table),
    channel: () => channel,
    removeChannel: () => Promise.resolve('ok'),
  } as unknown as AppSupabaseClient
}
