import { focusManager, onlineManager } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'
import { useQueryLifecycle, type AppStateSource } from './useQueryLifecycle'
import type { NetworkSource } from './networkSource'

const setup = async () => {
  let net: ((online: boolean) => void) | undefined
  let app: ((active: boolean) => void) | undefined
  const network: NetworkSource = {
    read: () => Promise.resolve(true),
    subscribe: (l) => {
      net = l
      return () => undefined
    },
  }
  const appState: AppStateSource = {
    subscribe: (l) => {
      app = l
      return () => undefined
    },
  }
  await renderHook(() => {
    useQueryLifecycle(network, appState)
  })
  return {
    net: (o: boolean): void => {
      net?.(o)
    },
    app: (a: boolean): void => {
      app?.(a)
    },
  }
}

describe('useQueryLifecycle', () => {
  it('tells TanStack Query when the app leaves and returns to the foreground', async () => {
    const { app } = await setup()
    await act(() => {
      app(false)
    })
    expect(focusManager.isFocused()).toBe(false)
    await act(() => {
      app(true)
    })
    expect(focusManager.isFocused()).toBe(true)
  })

  it('tells TanStack Query when the network drops and returns', async () => {
    const { net } = await setup()
    await act(() => {
      net(false)
    })
    expect(onlineManager.isOnline()).toBe(false)
    await act(() => {
      net(true)
    })
    expect(onlineManager.isOnline()).toBe(true)
  })
})
