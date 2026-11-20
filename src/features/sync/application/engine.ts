import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { err, isErr, isOk, ok, type Result } from '@/shared/types/result'
import type { Clock } from '@/shared/time/clock'
import { encrypt, newEpochKey, sealKey, type Random } from '../domain/crypto'
import { encodeEvent, type EventBody } from '../domain/event-codec'
import { tickHlc } from '../domain/hlc'
import { identityFromSecrets, memberKeyOf, newIdentity, type Identity } from '../domain/identity'
import {
  applyOp,
  householdIdFor,
  opId,
  signOp,
  type Membership,
  type MembershipError,
  type Role,
  type SignedOp,
} from '../domain/membership'
import { tokenFor, type Relay, type RelayError, type RelayRecord } from '../domain/relay'
import { applyEvents, emptyStore, type FieldValue, type Store } from '../domain/store'
import { ingest } from './ingest'
import { deserialise, serialise, type EngineState, type Status } from './state'

/** Persistent key-value storage: AsyncStorage for data, the secure store for secrets. */
export type KeyValue = {
  readonly get: (key: string) => Promise<string | undefined>
  readonly set: (key: string, value: string) => Promise<void>
}

export type Deps = {
  readonly relay: Relay
  /** Ordinary data. */
  readonly storage: KeyValue
  /** Secrets: epoch keys. */
  readonly vault: KeyValue
  readonly random: Random
  readonly clock: Clock
}

/** A seat on the board, handed to someone as a link. Whoever holds it is that Member. */
export type Invite = {
  readonly household: string
  readonly token: string
  readonly signSecretKey: string
  readonly boxSecretKey: string
}

export type View = {
  readonly household: string
  readonly me: string
  readonly role: Role | undefined
  readonly epoch: number
  readonly status: Status
  readonly store: Store
  readonly membership: Membership | undefined
  /** Writes made here that the relay has not yet taken. */
  readonly pending: number
}

export type AdminError = MembershipError | RelayError | 'conflict' | 'noKey'
export type JoinError = RelayError | 'noSeat'

export type Engine = {
  readonly household: string
  readonly view: () => View
  readonly subscribe: (listener: () => void) => () => void
  readonly write: (entity: string, field: string, value: FieldValue) => Promise<void>
  readonly sync: () => Promise<Result<void, RelayError>>
  readonly invite: (role: Role) => Promise<Result<Invite, AdminError>>
  readonly setRole: (member: string, role: Role) => Promise<Result<void, AdminError>>
  readonly removeMember: (member: string) => Promise<Result<void, AdminError>>
  /** This device's own seat, to take on a new device. Undefined before the keys arrive. */
  readonly ownSeat: () => Invite | undefined
  /** The epoch keys this device holds. For tests: nothing in the app needs them. */
  readonly debugKeys: () => EngineState['keys']
}

const snapshotKey = (household: string) => `sync/${household}`
const keysKey = (household: string) => `sync/${household}/keys`
const PULL_ROUNDS = 50
const toHex = (value: unknown): string =>
  bytesToHex(new TextEncoder().encode(JSON.stringify(value)))

const tokenOf = (state: EngineState): string | undefined => {
  const key = state.keys[String(state.membership?.epoch ?? 0)]
  return key ? tokenFor(key, state.household) : state.bootToken
}

const make = (deps: Deps, me: Identity, initial: EngineState): Engine => {
  let state = initial
  const listeners = new Set<() => void>()
  const applied = new Set<string>()
  const mine = memberKeyOf(me)
  const now = () => deps.clock.now().getTime()

  // One thing at a time: a write must not interleave with a pull that rewrites the state.
  let chain: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task)
    chain = run.catch(() => undefined)
    return run
  }

  const commit = async (next: EngineState): Promise<void> => {
    state = next
    const saved = serialise(next)
    await deps.storage.set(snapshotKey(next.household), saved.snapshot)
    await deps.vault.set(keysKey(next.household), saved.keys)
    listeners.forEach((l) => {
      l()
    })
  }

  const take = async (records: readonly RelayRecord[]): Promise<void> => {
    let next = state
    for (const record of records) {
      const result = ingest(next, record, me, now())
      result.applied.forEach((id) => applied.add(id))
      next = { ...result.state, lastSeq: Math.max(next.lastSeq, record.seq) }
    }
    await commit(next)
  }

  const pull = async (): Promise<Result<void, RelayError>> => {
    for (let round = 0; round < PULL_ROUNDS; round++) {
      const token = tokenOf(state)
      if (!token) return err('forbidden')
      const got = await deps.relay.pull(state.household, token, state.lastSeq)
      if (isErr(got)) return lockOut(got.error)
      if (got.value.length === 0) return ok(undefined)
      await take(got.value)
    }
    return ok(undefined)
  }

  // A refusal means this device lost access; being offline does not.
  const lockOut = async (error: RelayError): Promise<Result<void, RelayError>> => {
    if (error === 'forbidden' && state.status === 'ok')
      await commit({ ...state, status: 'lockedOut' })
    return err(error)
  }

  const flushOne = async (event: EventBody): Promise<Result<void, RelayError>> => {
    const epoch = state.membership?.epoch ?? 0
    const key = state.keys[String(epoch)]
    const token = tokenOf(state)
    if (!key || !token) return err('forbidden')
    const sealed = encrypt(
      key,
      { household: state.household, epoch },
      encodeEvent(event),
      deps.random,
    )
    const sent = await deps.relay.append(state.household, token, epoch, 'event', bytesToHex(sealed))
    if (isErr(sent)) return err(sent.error)
    await commit({ ...state, outbox: state.outbox.filter((e) => e.id !== event.id) })
    await take([sent.value])
    return ok(undefined)
  }

  const flush = async (): Promise<Result<void, RelayError>> => {
    for (const event of state.outbox) {
      const sent = await flushOne(event)
      if (isErr(sent)) return sent
    }
    return ok(undefined)
  }

  // A function, so the compiler does not assume the status is unchanged across an await.
  const active = (): boolean => state.status === 'ok'

  /**
   * Pull, then send. A rotation can land between the two, in which case the send
   * is refused for a stale epoch or token; pulling again fetches the new key.
   */
  const syncNow = async (): Promise<Result<void, RelayError>> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!active()) return err('forbidden')
      const pulled = await pull()
      if (isErr(pulled)) return pulled
      if (!active()) return err('forbidden')
      const sent = await flush()
      if (isOk(sent) || (sent.error !== 'epoch' && sent.error !== 'forbidden')) return sent
    }
    return err('epoch')
  }

  const requireAdmin = (): AdminError | undefined => {
    if (state.status !== 'ok') return 'forbidden'
    return state.membership?.members[mine]?.role === 'admin' ? undefined : 'notAdmin'
  }

  /** Publish an operation, then pull: it only counts if every replica, us included, applied it. */
  const publish = async (op: SignedOp, rotateTo?: string): Promise<Result<void, AdminError>> => {
    const token = tokenOf(state)
    const epoch = state.membership?.epoch
    if (!token || epoch === undefined) return err('noKey')
    const payload = toHex(op)
    const sent = rotateTo
      ? await deps.relay.rotate(state.household, token, rotateTo, payload)
      : await deps.relay.append(state.household, token, epoch, 'membership', payload)
    if (isErr(sent)) return err(sent.error)
    const synced = await pull()
    if (isErr(synced)) return err(synced.error)
    return applied.has(opId(op)) ? ok(undefined) : err('conflict')
  }

  /** Where the next operation attaches: this Household, after the last one applied. */
  const chained = () => ({ household: state.household, prev: state.membership?.head })

  const invite = (role: Role): Promise<Result<Invite, AdminError>> =>
    serial<Result<Invite, AdminError>>(async () => {
      const denied = requireAdmin()
      if (denied) return err(denied)
      const seat = newIdentity(deps.random)
      const next = applyAdd(seat, role)
      if (isErr(next)) return next
      const published = await publish(next.value)
      if (isErr(published)) return published
      const token = tokenOf(state)
      if (!token) return err('noKey')
      return ok({
        household: state.household,
        token,
        signSecretKey: bytesToHex(seat.signSecretKey),
        boxSecretKey: bytesToHex(seat.box.secretKey),
      })
    })

  const applyAdd = (seat: Identity, role: Role): Result<SignedOp, AdminError> => {
    const entry = { sign: memberKeyOf(seat), box: bytesToHex(seat.box.publicKey), role }
    const keys: { epoch: number; sealed: string }[] = []
    for (const [epochText, key] of Object.entries(state.keys)) {
      const epoch = Number(epochText)
      const sealed = sealKey(
        key,
        { household: state.household, epoch },
        seat.box.publicKey,
        deps.random,
      )
      if (isErr(sealed)) return err('badKeyset')
      keys.push({ epoch, sealed: bytesToHex(sealed.value) })
    }
    return ok(signOp({ kind: 'add', ...chained(), member: entry, keys }, me))
  }

  const setRole = (member: string, role: Role) =>
    serial<Result<void, AdminError>>(async () => {
      const denied = requireAdmin()
      if (denied) return err(denied)
      return publish(signOp({ kind: 'setRole', ...chained(), member, role }, me))
    })

  const removeMember = (member: string) =>
    serial<Result<void, AdminError>>(async () => {
      const denied = requireAdmin()
      if (denied) return err(denied)
      const current = state.membership
      if (!current) return err('noKey')
      const next = newEpochKey(deps.random)
      const epoch = current.epoch + 1
      const keys: { member: string; sealed: string }[] = []
      for (const [other, entry] of Object.entries(current.members)) {
        if (other === member) continue
        const sealed = sealKey(
          next,
          { household: state.household, epoch },
          hexToBytes(entry.box),
          deps.random,
        )
        if (isErr(sealed)) return err('badKeyset')
        keys.push({ member: other, sealed: bytesToHex(sealed.value) })
      }
      const op = signOp({ kind: 'remove', ...chained(), member, epoch, keys }, me)
      return publish(op, tokenFor(next, state.household))
    })

  const write = (entity: string, field: string, value: FieldValue): Promise<void> =>
    serial(async () => {
      const hlc = tickHlc(state.hlc, now())
      const id = bytesToHex(deps.random(16))
      await commit({ ...state, hlc, outbox: [...state.outbox, { id, hlc, entity, field, value }] })
    })

  return {
    household: initial.household,
    view: () => {
      // Writes still waiting for the relay show at once, judged against our own clock.
      const pending = state.outbox.map((e) => ({ ...e, receivedAt: now() }))
      return {
        household: state.household,
        me: mine,
        role: state.membership?.members[mine]?.role,
        epoch: state.membership?.epoch ?? 0,
        status: state.status,
        store: applyEvents(state.store, pending),
        membership: state.membership,
        pending: state.outbox.length,
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    write,
    sync: () => serial(syncNow),
    invite,
    setRole,
    removeMember,
    ownSeat: () => {
      const token = tokenOf(state)
      return token === undefined
        ? undefined
        : {
            household: state.household,
            token,
            signSecretKey: bytesToHex(me.signSecretKey),
            boxSecretKey: bytesToHex(me.box.secretKey),
          }
    },
    debugKeys: () => state.keys,
  }
}

const empty = (household: string, me: Identity, now: number): EngineState => ({
  household,
  membership: undefined,
  keys: {},
  store: emptyStore,
  lastSeq: -1,
  hlc: { wall: now, counter: 0, node: memberKeyOf(me) },
  outbox: [],
  status: 'ok',
  held: [],
  bootToken: undefined,
})

const save = async (deps: Deps, state: EngineState): Promise<void> => {
  const saved = serialise(state)
  await deps.storage.set(snapshotKey(state.household), saved.snapshot)
  await deps.vault.set(keysKey(state.household), saved.keys)
}

/** Start a new board: this device becomes its first admin. */
export const createHousehold = async (
  deps: Deps,
  me: Identity,
): Promise<Result<Engine, RelayError>> => {
  const nonce = bytesToHex(deps.random(32))
  const household = householdIdFor(memberKeyOf(me), nonce)
  const key = newEpochKey(deps.random)
  const sealed = sealKey(key, { household, epoch: 1 }, me.box.publicKey, deps.random)
  if (isErr(sealed)) return err('rejected')
  const genesis = signOp(
    {
      kind: 'create',
      household,
      nonce,
      prev: undefined,
      admin: { sign: memberKeyOf(me), box: bytesToHex(me.box.publicKey) },
      epoch: 1,
      sealed: bytesToHex(sealed.value),
    },
    me,
  )
  const membership = applyOp(undefined, genesis)
  if (!isOk(membership)) return err('rejected')
  const created = await deps.relay.create(household, tokenFor(key, household), toHex(genesis))
  if (isErr(created)) return err(created.error)
  const state: EngineState = {
    ...empty(household, me, deps.clock.now().getTime()),
    membership: membership.value,
    keys: { '1': key },
    lastSeq: created.value.seq,
  }
  await save(deps, state)
  return ok(make(deps, me, state))
}

/** The identity a seat in an invite stands for; the caller keeps it safe. */
export const identityFromInvite = (invite: Invite): Identity =>
  identityFromSecrets(hexToBytes(invite.signSecretKey), hexToBytes(invite.boxSecretKey))

/** Take a seat from an invite: pull the log, open the keys sent to it. */
export const joinHousehold = async (
  deps: Deps,
  invite: Invite,
): Promise<Result<Engine, JoinError>> => {
  const me = identityFromInvite(invite)
  const state = {
    ...empty(invite.household, me, deps.clock.now().getTime()),
    bootToken: invite.token,
  }
  const engine = make(deps, me, state)
  const synced = await engine.sync()
  if (isErr(synced)) return err(synced.error)
  return engine.view().role ? ok(engine) : err('noSeat')
}

/** Reopen a board this device already knows. */
export const openHousehold = async (
  deps: Deps,
  me: Identity,
  household: string,
): Promise<Engine | undefined> => {
  const snapshot = await deps.storage.get(snapshotKey(household))
  const keys = await deps.vault.get(keysKey(household))
  const state = snapshot && keys ? deserialise(snapshot, keys) : undefined
  return state ? make(deps, me, state) : undefined
}
