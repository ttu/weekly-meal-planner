import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { createAppStateSource } from '@/shared/net/useQueryLifecycle'
import { dataOf, type Data } from '../application/data'
import { forgetBoard, loadIdentity, recallBoard, rememberBoard } from '../application/device'
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
  /** Make this the board the device shows, as this identity, and remember both. */
  readonly adopt: (engine: Engine, identity: Identity) => Promise<void>
  /** Stop showing the open board on this device. Does not give up the seat. */
  readonly leave: () => Promise<void>
}

const SessionContext = createContext<Session | undefined>(undefined)

const useSession = (): Session => {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSync needs a SyncProvider')
  return session
}

export const useSync = useSession

type Props = {
  readonly deps: Deps
  /** A board already open, to skip looking for one: what tests and the first screens after start hand over. */
  readonly initial?: { readonly engine: Engine; readonly identity: Identity } | undefined
  readonly children: React.ReactNode
}

/** Opens the board this device had, keeps it syncing, and offers it to the screens. */
export const SyncProvider = ({ deps, initial, children }: Props): React.JSX.Element => {
  const [identity, setIdentity] = useState<Identity | undefined>(initial?.identity)
  const [engine, setEngine] = useState<Engine | undefined>(initial?.engine)
  const [ready, setReady] = useState(initial !== undefined)

  useEffect(() => {
    if (initial) return undefined
    const task = { live: true }
    void (async () => {
      const board = await recallBoard(deps)
      const opened = board ? await openHousehold(deps, board.identity, board.household) : undefined
      const me = board?.identity ?? (await loadIdentity(deps.vault, deps.random))
      if (!task.live) return
      setIdentity(me)
      setEngine(opened)
      setReady(true)
    })()
    return () => {
      task.live = false
    }
  }, [deps, initial])

  useEffect(() => {
    if (!engine) return undefined
    return startSyncLoop(engine, createAppStateSource(), platformTimers)
  }, [engine])

  const adopt = useCallback(
    async (next: Engine, as: Identity) => {
      await rememberBoard(deps, next.household, as)
      setIdentity(as)
      setEngine(next)
    },
    [deps],
  )

  const leave = useCallback(async () => {
    await forgetBoard(deps)
    // The seat's keys are known to whoever made the invite: never start anything on them.
    setIdentity(await loadIdentity(deps.vault, deps.random))
    setEngine(undefined)
  }, [deps])

  const session = useMemo(
    () => ({ ready, deps, identity, engine, adopt, leave }),
    [ready, deps, identity, engine, adopt, leave],
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
