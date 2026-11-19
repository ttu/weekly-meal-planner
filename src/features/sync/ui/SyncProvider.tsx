import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { createAppStateSource } from '@/shared/net/useQueryLifecycle'
import { dataOf, type Data } from '../application/data'
import { currentHousehold, loadIdentity, rememberHousehold } from '../application/device'
import { openHousehold, type Deps, type Engine, type View } from '../application/engine'
import { startSyncLoop, platformTimers } from '../application/sync-loop'
import { viewStore } from '../application/view-store'
import type { Identity } from '../domain/identity'

type Session = {
  /** False until the device's keys and last board have been looked for. */
  readonly ready: boolean
  readonly deps: Deps
  readonly identity: Identity | undefined
  readonly engine: Engine | undefined
  /** Make this the board the device shows, and remember it. */
  readonly adopt: (engine: Engine) => Promise<void>
}

const SessionContext = createContext<Session | undefined>(undefined)

const useSession = (): Session => {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSync needs a SyncProvider')
  return session
}

export const useSync = useSession

type Props = { readonly deps: Deps; readonly children: React.ReactNode }

/** Opens the board this device had, keeps it syncing, and offers it to the screens. */
export const SyncProvider = ({ deps, children }: Props): React.JSX.Element => {
  const [identity, setIdentity] = useState<Identity | undefined>()
  const [engine, setEngine] = useState<Engine | undefined>()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const task = { live: true }
    void (async () => {
      const me = await loadIdentity(deps.vault, deps.random)
      const household = await currentHousehold(deps.storage)
      const opened = household ? await openHousehold(deps, me, household) : undefined
      if (!task.live) return
      setIdentity(me)
      setEngine(opened)
      setReady(true)
    })()
    return () => {
      task.live = false
    }
  }, [deps])

  useEffect(() => {
    if (!engine) return undefined
    return startSyncLoop(engine, createAppStateSource(), platformTimers)
  }, [engine])

  const adopt = useCallback(
    async (next: Engine) => {
      await rememberHousehold(deps.storage, next.household)
      setEngine(next)
    },
    [deps],
  )

  const session = useMemo(
    () => ({ ready, deps, identity, engine, adopt }),
    [ready, deps, identity, engine, adopt],
  )
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

const storeFor = new WeakMap<Engine, ReturnType<typeof viewStore>>()
const storeOf = (engine: Engine) => {
  const known = storeFor.get(engine)
  if (known) return known
  const made = viewStore(engine)
  storeFor.set(engine, made)
  return made
}

/** The open board's state, re-rendering when it changes. Undefined when no board is open. */
export const useView = (): View | undefined => {
  const { engine } = useSession()
  const store = useMemo(() => (engine ? storeOf(engine) : undefined), [engine])
  return useSyncExternalStore(
    (listener) => store?.subscribe(listener) ?? (() => undefined),
    () => store?.getSnapshot(),
  )
}

/** Rows of the open board, for the feature slices. Re-reads when the board changes. */
export const useData = (): Data | undefined => {
  const { engine } = useSession()
  useView()
  return useMemo(() => (engine ? dataOf(engine) : undefined), [engine])
}
