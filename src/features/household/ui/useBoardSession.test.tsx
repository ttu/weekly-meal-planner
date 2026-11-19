import { useEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { randomBytes } from '@noble/hashes/utils'
import { memoryRelay } from '@/test/memory-relay'
import { SyncProvider, useSync, type KeyValue, type SyncDeps } from '@/features/sync'
import { isOk } from '@/shared/types/result'
import { startBoard } from '../application/board-flow'
import { useBoardSession } from './useBoardSession'

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

const deps = (): SyncDeps => ({
  relay: memoryRelay(),
  storage: memoryKv(),
  vault: memoryKv(),
  random: randomBytes,
  clock: { now: () => new Date() },
})

const Probe = (): React.JSX.Element => {
  const { household, member, checked } = useBoardSession()
  return (
    <Text>
      {checked ? 'checked' : 'checking'}|{household?.name ?? '-'}|{member?.displayName ?? '-'}
    </Text>
  )
}

describe('useBoardSession', () => {
  it('sees no Household on a device with no board, once it has looked', async () => {
    await render(
      <SyncProvider deps={deps()}>
        <Probe />
      </SyncProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('checked|-|-')).toBeTruthy()
    })
  })

  it('shows the board and this Member once one is started', async () => {
    const d = deps()
    const grabbed: { session?: ReturnType<typeof useSync> } = {}
    const Grab = (): null => {
      const current = useSync()
      useEffect(() => {
        grabbed.session = current
      })
      return null
    }
    await render(
      <SyncProvider deps={d}>
        <Grab />
        <Probe />
      </SyncProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('checked|-|-')).toBeTruthy()
    })
    const me = grabbed.session?.identity
    if (!me) throw new Error('no identity')
    const started = await startBoard(d, me, {
      boardName: 'Home',
      displayName: 'Alice',
      locale: 'en',
    })
    if (!isOk(started)) throw new Error('could not start')
    await act(async () => {
      await grabbed.session?.adopt(started.value, me)
    })
    expect(screen.getByText('checked|Home|Alice')).toBeTruthy()
  })
})
