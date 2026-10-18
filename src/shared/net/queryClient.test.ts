import { IDEMPOTENT_WRITE_RETRY, createQueryClient } from './queryClient'

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

describe('retries', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('calls a failing mutation once, so a lost response cannot insert twice', async () => {
    const client = createQueryClient()
    const fn = jest.fn().mockRejectedValue(new Error('no-household'))
    const observer = client.getMutationCache().build(client, { mutationFn: fn })
    await expect(observer.execute(undefined)).rejects.toThrow('no-household')
    await jest.advanceTimersByTimeAsync(30_000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries a mutation that opts in as idempotent', async () => {
    const client = createQueryClient()
    const fn = jest.fn().mockRejectedValue(new Error('network'))
    const mutation = client
      .getMutationCache()
      .build(client, { mutationFn: fn, retry: IDEMPOTENT_WRITE_RETRY })
    const done = mutation.execute(undefined).catch(() => undefined)
    await jest.advanceTimersByTimeAsync(30_000)
    await done
    expect(fn).toHaveBeenCalledTimes(IDEMPOTENT_WRITE_RETRY + 1)
  })

  it('lets a failing first load reach the error state within about two seconds', async () => {
    const client = createQueryClient()
    const queryFn = jest.fn().mockRejectedValue(new Error('down'))
    const query = client.getQueryCache().build(client, { queryKey: ['x'], queryFn })
    void query.fetch().catch(() => undefined)
    await jest.advanceTimersByTimeAsync(2_000)
    expect(queryFn).toHaveBeenCalledTimes(2)
    expect(query.state.status).toBe('error')
  })
})
