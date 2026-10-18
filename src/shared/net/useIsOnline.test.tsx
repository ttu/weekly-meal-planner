import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useIsOnline } from './useIsOnline'
import { NetworkSourceProvider } from './NetworkSourceContext'
import type { NetworkSource } from './networkSource'

const fakeSource = (initial: boolean) => {
  let listener: ((online: boolean) => void) | undefined
  const source: NetworkSource = {
    read: () => Promise.resolve(initial),
    subscribe: (l) => {
      listener = l
      return () => undefined
    },
  }
  return {
    source,
    push: (online: boolean): void => {
      listener?.(online)
    },
  }
}

const wrap = (source: NetworkSource) =>
  function Wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
    return <NetworkSourceProvider source={source}>{children}</NetworkSourceProvider>
  }

describe('useIsOnline', () => {
  it('takes the first real reading from the source', async () => {
    const { source } = fakeSource(false)
    const { result } = await renderHook(() => useIsOnline(), { wrapper: wrap(source) })
    await waitFor(() => {
      expect(result.current).toBe(false)
    })
  })

  it('follows the source going offline and back', async () => {
    const { source, push } = fakeSource(true)
    const { result } = await renderHook(() => useIsOnline(), { wrapper: wrap(source) })
    await act(async () => {
      await Promise.resolve()
    })
    await act(() => {
      push(false)
    })
    expect(result.current).toBe(false)
    await act(() => {
      push(true)
    })
    expect(result.current).toBe(true)
  })
})
