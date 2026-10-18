import { createNativeNetworkSource, createWebNetworkSource } from './networkSource'

type State = { isConnected?: boolean; isInternetReachable?: boolean }

describe('the native network source', () => {
  const setup = (initial: State) => {
    let push: ((event: State) => void) | undefined
    const remove = jest.fn()
    const source = createNativeNetworkSource({
      getNetworkStateAsync: () => Promise.resolve(initial),
      addNetworkStateListener: (listener) => {
        push = listener
        return { remove }
      },
    })
    return {
      source,
      push: (e: State): void => {
        push?.(e)
      },
      remove,
    }
  }

  it('reads the current state', async () => {
    await expect(setup({ isConnected: false }).source.read()).resolves.toBe(false)
  })

  it('is online when the device says nothing yet', async () => {
    await expect(setup({}).source.read()).resolves.toBe(true)
  })

  it('treats connected-but-unreachable as offline', async () => {
    const { source } = setup({ isConnected: true, isInternetReachable: false })
    await expect(source.read()).resolves.toBe(false)
  })

  it('pushes changes and stops when unsubscribed', () => {
    const { source, push, remove } = setup({})
    const seen: boolean[] = []
    const stop = source.subscribe((online) => {
      seen.push(online)
    })
    push({ isConnected: false })
    push({ isConnected: true, isInternetReachable: true })
    stop()
    expect(seen).toEqual([false, true])
    expect(remove).toHaveBeenCalled()
  })
})

describe('the web network source', () => {
  const makeWindow = (onLine: boolean) => {
    const handlers: Record<string, () => void> = {}
    return {
      handlers,
      win: {
        navigator: { onLine },
        addEventListener: (name: string, fn: () => void) => {
          handlers[name] = fn
        },
        removeEventListener: jest.fn(),
      },
    }
  }

  it('follows the online and offline events', () => {
    const { win, handlers } = makeWindow(false)
    const seen: boolean[] = []
    createWebNetworkSource(win).subscribe((online) => {
      seen.push(online)
    })
    handlers.online?.()
    handlers.offline?.()
    expect(seen).toEqual([true, false])
  })

  it('reads navigator.onLine', async () => {
    await expect(createWebNetworkSource(makeWindow(false).win).read()).resolves.toBe(false)
  })

  it('is online where there is no window', async () => {
    await expect(createWebNetworkSource(undefined).read()).resolves.toBe(true)
  })
})
