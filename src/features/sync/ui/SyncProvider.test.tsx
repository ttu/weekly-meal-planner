import { act, render, screen, waitFor } from '@testing-library/react-native'
import { useEffect } from 'react'
import { Text } from 'react-native'
import { memoryRelay } from '@/test/memory-relay'
import { createHousehold } from '../application/engine'
import { fakeRandom } from '../domain/fake-random'
import { newIdentity } from '../domain/identity'
import { SyncProvider, useData, useSync, useView } from './SyncProvider'
import type { Deps, KeyValue } from '../application/engine'

const memoryKv = (): KeyValue => {
  const data = new Map<string, string>()
  return {
    get: (k) => Promise.resolve(data.get(k)),
    set: (k, v) => {
      data.set(k, v)
      return Promise.resolve()
    },
  }
}

const deps = (): Deps => ({
  relay: memoryRelay(),
  storage: memoryKv(),
  vault: memoryKv(),
  random: fakeRandom('device'),
  clock: { now: () => new Date() },
})

const Probe = (): React.JSX.Element => {
  const { ready, engine } = useSync()
  const view = useView()
  const data = useData()
  const name = data?.get('meal', 'm1')?.name
  return (
    <Text>
      {ready ? 'ready' : 'loading'}|{engine ? 'open' : 'none'}|{view?.role ?? '-'}|
      {typeof name === 'string' ? name : '-'}
    </Text>
  )
}

describe('SyncProvider', () => {
  it('is ready with no board on a fresh device', async () => {
    await render(
      <SyncProvider deps={deps()}>
        <Probe />
      </SyncProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('ready|none|-|-')).toBeTruthy()
    })
  })

  it('shows an adopted board, follows its writes, and reopens it on the next start', async () => {
    const d = deps()
    const grabbed: { session?: ReturnType<typeof useSync> } = {}
    const Grab = (): null => {
      const current = useSync()
      useEffect(() => {
        grabbed.session = current
      })
      return null
    }
    const first = await render(
      <SyncProvider deps={d}>
        <Grab />
        <Probe />
      </SyncProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('ready|none|-|-')).toBeTruthy()
    })
    const me = grabbed.session?.identity ?? newIdentity(fakeRandom('x'))
    const made = await createHousehold(d, me)
    if (made.kind !== 'ok') throw new Error('no board')
    await act(async () => {
      await grabbed.session?.adopt(made.value, me)
    })
    expect(screen.getByText(/^ready\|open\|admin/)).toBeTruthy()
    await act(async () => {
      await made.value.write('meal:m1', 'name', 'Soup')
    })
    expect(screen.getByText('ready|open|admin|Soup')).toBeTruthy()
    await first.unmount()

    await render(
      <SyncProvider deps={d}>
        <Probe />
      </SyncProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('ready|open|admin|Soup')).toBeTruthy()
    })
  })
})
