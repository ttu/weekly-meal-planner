import { createQueryClient } from './queryClient'

describe('the query client defaults', () => {
  const defaults = createQueryClient().getDefaultOptions()

  it('keeps data fresh briefly, since realtime invalidates it', () => {
    expect(defaults.queries?.staleTime).toBeGreaterThan(0)
  })

  it('pauses mutations while offline and flushes them on reconnect', () => {
    expect(defaults.mutations?.networkMode).toBe('online')
  })

  it('refetches on reconnect and on focus', () => {
    expect(defaults.queries?.refetchOnReconnect).toBe(true)
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true)
  })
})
