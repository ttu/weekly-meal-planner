import type { ReactNode } from 'react'
import { randomBytes } from '@noble/hashes/utils'
import { startBoard } from '@/features/household'
import {
  SyncProvider,
  dataOf,
  newIdentity,
  type Data,
  type Engine,
  type KeyValue,
  type SyncDeps,
} from '@/features/sync'
import { isOk } from '@/shared/types/result'
import { memoryRelay } from './memory-relay'

const memoryKv = (): KeyValue => {
  const map = new Map<string, string>()
  return {
    get: (k) => Promise.resolve(map.get(k)),
    set: (k, v) => {
      map.set(k, v)
      return Promise.resolve()
    },
  }
}

export type TestBoard = {
  readonly deps: SyncDeps
  readonly engine: Engine
  /** Rows of the board, for arranging what a test needs and reading what it left. */
  readonly data: Data
  readonly wrapper: (props: { readonly children: ReactNode }) => React.JSX.Element
}

/**
 * A real board on the real sync engine, over a relay in memory: the only things
 * faked are the network and the device's storage, which a test may hand in to
 * make it fail. `wrapper` mounts the provider with that board open, so hooks see
 * what the app would.
 */
export const testBoard = async (
  locale: 'fi' | 'en' = 'en',
  device: Partial<Pick<SyncDeps, 'storage' | 'vault'>> = {},
): Promise<TestBoard> => {
  const deps: SyncDeps = {
    relay: memoryRelay(),
    storage: device.storage ?? memoryKv(),
    vault: device.vault ?? memoryKv(),
    random: randomBytes,
    clock: { now: () => new Date() },
  }
  const identity = newIdentity(randomBytes)
  const started = await startBoard(deps, identity, {
    boardName: 'Koti',
    displayName: 'Sanni',
    locale,
  })
  if (!isOk(started)) throw new Error('could not start a test board')
  const engine = started.value
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <SyncProvider deps={deps} initial={{ engine, identity }}>
      {children}
    </SyncProvider>
  )
  return { deps, engine, data: dataOf(engine), wrapper }
}

/** Device storage that refuses writes to the keys `refuses` picks once `broken.now` is set. */
export const breakableKv = (
  refuses: (key: string) => boolean = () => true,
): { readonly kv: KeyValue; readonly broken: { now: boolean } } => {
  const inner = memoryKv()
  const broken = { now: false }
  return {
    broken,
    kv: {
      get: inner.get,
      set: (k, v) =>
        broken.now && refuses(k) ? Promise.reject(new Error('disk full')) : inner.set(k, v),
    },
  }
}
