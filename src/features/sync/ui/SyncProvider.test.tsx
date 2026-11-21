import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useEffect } from 'react'
import { Text } from 'react-native'
import { memoryRelay } from '@/test/memory-relay'
import { rememberBoard } from '../application/device'
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

  const Status = (): React.JSX.Element => {
    const { ready, failed, engine, retry } = useSync()
    const loaded = ready ? 'ready' : 'loading'
    return (
      <Text onPress={retry}>
        {failed ? 'failed' : loaded}|{engine ? 'open' : 'none'}
      </Text>
    )
  }

  it('says it failed, rather than loading forever, when storage cannot be read, and tries again', async () => {
    const d = deps()
    let broken = true
    const storage: KeyValue = {
      get: (k) => (broken ? Promise.reject(new Error('storage down')) : d.storage.get(k)),
      set: d.storage.set,
    }
    const logged: string[] = []
    const logger = { log: (_: string, event: string) => logged.push(event) }
    await render(
      <SyncProvider deps={{ ...d, storage }} logger={logger}>
        <Status />
      </SyncProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('failed|none')).toBeTruthy()
    })
    expect(logged).toEqual(['sync.open_failed'])
    broken = false
    await act(async () => {
      await fireEvent.press(screen.getByText('failed|none'))
    })
    await waitFor(() => {
      expect(screen.getByText('ready|none')).toBeTruthy()
    })
  })

  it('treats a saved board it cannot read as a failure, not as no board', async () => {
    const d = deps()
    const me = newIdentity(fakeRandom('me'))
    const made = await createHousehold(d, me)
    if (made.kind !== 'ok') throw new Error('no board')
    await rememberBoard(d, made.value.household, me)
    await d.storage.set(`sync/${made.value.household}`, 'not json')
    await render(
      <SyncProvider deps={d} logger={{ log: () => undefined }}>
        <Status />
      </SyncProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('failed|none')).toBeTruthy()
    })
  })
})
