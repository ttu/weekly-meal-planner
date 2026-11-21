import { hexToBytes } from '@noble/hashes/utils'
import { isOk } from '@/shared/types/result'
import { decrypt, openKey, type EpochKey } from '../domain/crypto'
import { decodeEvent } from '../domain/event-codec'
import { isPlausibleHlc, receiveHlc } from '../domain/hlc'
import { memberKeyOf, type Identity } from '../domain/identity'
import { applyOp, opId, parseSignedOp, type OpBody, type SignedOp } from '../domain/membership'
import type { RelayRecord } from '../domain/relay'
import { applyEvents } from '../domain/store'
import type { EngineState } from './state'

export type Ingested = {
  readonly state: EngineState
  readonly applied: readonly string[]
  /** The state's `lastSeq` went back, to fetch records that were dropped. */
  readonly rewound?: boolean
}

const unhex = (hex: string): Uint8Array | undefined => {
  try {
    return hexToBytes(hex)
  } catch {
    return undefined
  }
}

const withKey = (state: EngineState, epoch: number, key: EpochKey): EngineState => ({
  ...state,
  keys: { ...state.keys, [String(epoch)]: key },
})

/** Open one sealed delivery meant for this device. A bad one is skipped, not fatal. */
const open = (state: EngineState, me: Identity, epoch: number, sealed: string): EngineState => {
  const bytes = unhex(sealed)
  const opened = bytes && openKey(bytes, { household: state.household, epoch }, me.box.secretKey)
  return opened && isOk(opened) ? withKey(state, epoch, opened.value) : state
}

/** What a membership change means for this device's keys and standing. */
const takeKeys = (state: EngineState, me: Identity, body: OpBody): EngineState => {
  const mine = memberKeyOf(me)
  if (body.kind === 'add' && body.member.sign === mine) {
    return body.keys.reduce((s, k) => open(s, me, k.epoch, k.sealed), state)
  }
  if (body.kind === 'create' && body.admin.sign === mine && body.sealed !== undefined) {
    return open(state, me, 1, body.sealed)
  }
  if (body.kind !== 'remove') return state
  if (body.member === mine) return { ...state, status: 'removed' }
  const delivery = body.keys.find((k) => k.member === mine)
  return delivery ? open(state, me, body.epoch, delivery.sealed) : state
}

const ingestMembership = (state: EngineState, record: RelayRecord, me: Identity): Ingested => {
  const bytes = unhex(record.payload)
  const parsed = bytes && safeJson(bytes)
  const op: SignedOp | undefined = parsed ? signedOf(parsed) : undefined
  if (!op) return { state, applied: [] }
  if (op.body.kind === 'create' && op.body.household !== state.household)
    return { state, applied: [] }
  const next = applyOp(state.membership, op)
  if (!isOk(next)) return { state, applied: [] }
  return { state: takeKeys({ ...state, membership: next.value }, me, op.body), applied: [opId(op)] }
}

const safeJson = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return undefined
  }
}

const signedOf = (input: unknown): SignedOp | undefined => {
  const parsed = parseSignedOp(input)
  return isOk(parsed) ? parsed.value : undefined
}

/** A bound on what a Member can make us keep for epochs we may never get a key to. */
const MAX_HELD = 2000

const ingestEvent = (state: EngineState, record: RelayRecord, now: number): Ingested => {
  const key = state.keys[String(record.epoch)]
  if (!key) {
    if (state.held.some((r) => r.seq === record.seq)) return { state, applied: [] }
    if (state.held.length < MAX_HELD)
      return { state: { ...state, held: [...state.held, record] }, applied: [] }
    return { state: { ...state, dropped: state.dropped ?? record.seq }, applied: [] }
  }
  const bytes = unhex(record.payload)
  const plain = bytes && decrypt(key, { household: state.household, epoch: record.epoch }, bytes)
  const decoded = plain && isOk(plain) ? decodeEvent(plain.value) : undefined
  if (!decoded || !isOk(decoded)) return { state, applied: [] }
  const event = { ...decoded.value, receivedAt: record.receivedAt }
  const store = applyEvents(state.store, [event])
  // Stay ahead of what we have seen so our next write sorts after it. A stamp
  // the clock rules refuse is not allowed to move our clock either.
  const hlc = isPlausibleHlc(event.hlc, record.receivedAt)
    ? advance(state, event.hlc, now)
    : state.hlc
  return { state: { ...state, store, hlc }, applied: [] }
}

const advance = (state: EngineState, remote: EngineState['hlc'], now: number) => {
  try {
    return receiveHlc(state.hlc, remote, now)
  } catch {
    return state.hlc
  }
}

/** Events that were waiting for a key get another go once it arrives. */
const release = (state: EngineState, now: number): EngineState => {
  const ready = state.held.filter((r) => state.keys[String(r.epoch)])
  if (ready.length === 0) return state
  const rest = state.held.filter((r) => !state.keys[String(r.epoch)])
  return ready.reduce<EngineState>((s, r) => ingestEvent(s, r, now).state, { ...state, held: rest })
}

/** Apply one relay record to a device's state. Pure: never throws, whatever the record holds. */
export const ingest = (
  state: EngineState,
  record: RelayRecord,
  me: Identity,
  now: number,
): Ingested => {
  const result =
    record.kind === 'membership'
      ? ingestMembership(state, record, me)
      : ingestEvent(state, record, now)
  const mine = result.state.membership?.members[memberKeyOf(me)]
  const lostSeat = state.membership?.members[memberKeyOf(me)] && !mine
  const standing = lostSeat ? { ...result.state, status: 'removed' as const } : result.state
  const gotKey = Object.keys(standing.keys).length > Object.keys(state.keys).length
  // The invite token is only for reaching the first key; after that the key's own token is used.
  if (!gotKey) return { ...result, state: standing }
  const settled = release({ ...standing, bootToken: undefined }, now)
  if (settled.dropped === undefined) return { ...result, state: settled }
  const rewind = { ...settled, lastSeq: settled.dropped - 1, dropped: undefined }
  return { ...result, state: rewind, rewound: true }
}
