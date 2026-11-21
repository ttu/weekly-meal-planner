import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'

/**
 * The mailbox (ADR 0013): opaque records in the order received, and one check,
 * that the caller knows the board's token. It holds no key and reads no
 * plaintext. One board is one `Kv`; on Cloudflare that is one Durable Object's
 * storage, which also serialises the calls.
 */
export type Kv = {
  get: <T>(key: string) => Promise<T | undefined>
  /** Every entry lands, or none does. */
  put: (entries: Record<string, unknown>) => Promise<void>
  /** Entries from `start` (inclusive) while they share `prefix`, in key order. */
  list: <T>(options: { prefix: string; start: string; limit: number }) => Promise<Map<string, T>>
}

export type Reason =
  'forbidden' | 'epoch' | 'exists' | 'busy' | 'full' | 'bad_request' | 'same_token'

export class RelayFailure extends Error {
  constructor(readonly reason: Reason) {
    super(`relay_${reason}`)
  }
}

export type Kind = 'membership' | 'event'
export type Stamp = { readonly seq: number; readonly epoch: number; readonly receivedAt: number }
export type Row = Stamp & { readonly kind: Kind; readonly payload: string }

type EpochRow = { epoch: number; tokenHash: string; endsAt?: number }
type Meta = {
  epoch: number
  lastSeq: number
  epochs: EpochRow[]
  /** The last membership record. Missing on boards made before it was kept. */
  membershipSeq?: number
  /** When recent membership records were appended, to cap them. */
  membershipAt?: number[]
  /** Payload characters held. Missing on boards made before it was kept, which count from zero. */
  bytes?: number
}

/** In hex characters. The app checks its writes against the same number (MAX_SEALED_HEX in src/features/sync/application/engine.ts). */
const MAX_PAYLOAD = 65_536
const MAX_BYTES = 50_000_000
// The same headroom as for records, so a full board can still cut a Member off.
const MAX_BYTES_ROTATE = MAX_BYTES + 1_000_000
const MAX_RECORDS = 100_000
// A little headroom, so a full board can still cut a Member off.
const MAX_RECORDS_ROTATE = 100_100
// The epoch list is one stored value, so it is kept small.
const MAX_EPOCHS = 500
const PAGE = 500
/** A page also ends at this much payload, so one pull stays a reasonable download. */
const PAGE_BYTES = 1_000_000
/**
 * Any Member can append a membership record, and each one makes a pending
 * rotation retry. Capped so a Member cannot keep an admin from removing them.
 */
const MAX_MEMBERSHIP_PER_MINUTE = 20
const TOKEN = /^[0-9a-f]{64}$/
const BOARD = /^[\w-]{8,128}$/

const key = (seq: number): string => `r:${String(seq).padStart(10, '0')}`
const hash = (token: string): string => bytesToHex(sha256(utf8ToBytes(token)))
const fail = (reason: Reason): never => {
  throw new RelayFailure(reason)
}

const isToken = (value: unknown): value is string => typeof value === 'string' && TOKEN.test(value)
export const isBoard = (value: unknown): value is string =>
  typeof value === 'string' && BOARD.test(value)
const isPayload = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_PAYLOAD

/** One answer for "no such board" and "wrong token", so a board cannot be probed. */
const current = async (kv: Kv, token: unknown): Promise<Meta> => {
  if (!isToken(token)) return fail('forbidden')
  const meta = await kv.get<Meta>('meta')
  return meta?.epochs.at(-1)?.tokenHash === hash(token) ? meta : fail('forbidden')
}

const record = (
  kind: Kind,
  epoch: number,
  seq: number,
  payload: string,
  receivedAt: number,
): Row => ({ seq, epoch, kind, payload, receivedAt })

const stamp = (row: Row): Stamp => ({ seq: row.seq, epoch: row.epoch, receivedAt: row.receivedAt })

export const createBoard = async (
  kv: Kv,
  board: unknown,
  token: unknown,
  payload: unknown,
  now: number,
): Promise<Stamp> => {
  if (!isBoard(board) || !isToken(token) || !isPayload(payload)) return fail('bad_request')
  if (await kv.get('meta')) return fail('exists')
  const first = record('membership', 1, 0, payload, now)
  await kv.put({
    meta: {
      epoch: 1,
      lastSeq: 0,
      epochs: [{ epoch: 1, tokenHash: hash(token) }],
      membershipSeq: 0,
      bytes: payload.length,
    } satisfies Meta,
    [key(0)]: first,
  })
  return stamp(first)
}

export const appendRecord = async (
  kv: Kv,
  token: unknown,
  epoch: unknown,
  kind: unknown,
  payload: unknown,
  now: number,
): Promise<Stamp> => {
  const meta = await current(kv, token)
  if (
    !Number.isInteger(epoch) ||
    (kind !== 'event' && kind !== 'membership') ||
    !isPayload(payload)
  )
    return fail('bad_request')
  if (epoch !== meta.epoch) return fail('epoch')
  const bytes = (meta.bytes ?? 0) + payload.length
  if (meta.lastSeq >= MAX_RECORDS || bytes > MAX_BYTES) return fail('full')
  const row = record(kind, meta.epoch, meta.lastSeq + 1, payload, now)
  if (kind !== 'membership') {
    await kv.put({ meta: { ...meta, lastSeq: row.seq, bytes }, [key(row.seq)]: row })
    return stamp(row)
  }
  const recent = (meta.membershipAt ?? []).filter((t) => t > now - 60_000)
  if (recent.length >= MAX_MEMBERSHIP_PER_MINUTE) return fail('busy')
  await kv.put({
    meta: {
      ...meta,
      lastSeq: row.seq,
      membershipSeq: row.seq,
      membershipAt: [...recent, now],
      bytes,
    },
    [key(row.seq)]: row,
  })
  return stamp(row)
}

/**
 * Moves to the next epoch and records the membership change that caused it, in
 * one step. `afterMembership` is the last membership record the caller built on:
 * if another landed since, the change would be refused by every device after
 * the token already moved, so it is refused here instead.
 */
export const rotateBoard = async (
  kv: Kv,
  token: unknown,
  newToken: unknown,
  payload: unknown,
  now: number,
  afterMembership?: unknown,
): Promise<Stamp> => {
  const meta = await current(kv, token)
  if (
    afterMembership !== undefined &&
    meta.membershipSeq !== undefined &&
    afterMembership !== meta.membershipSeq
  )
    return fail('epoch')
  if (meta.lastSeq >= MAX_RECORDS_ROTATE || meta.epochs.length >= MAX_EPOCHS) return fail('full')
  if (!isToken(newToken) || !isPayload(payload)) return fail('bad_request')
  const bytes = (meta.bytes ?? 0) + payload.length
  if (bytes > MAX_BYTES_ROTATE) return fail('full')
  // Not the current token, and not any earlier one: taking an old token back would undo a removal.
  const newHash = hash(newToken)
  if (meta.epochs.some((e) => e.tokenHash === newHash)) return fail('same_token')
  const row = record('membership', meta.epoch + 1, meta.lastSeq + 1, payload, now)
  const epochs = [
    ...meta.epochs.map((e) => (e.epoch === meta.epoch ? { ...e, endsAt: row.seq } : e)),
    { epoch: row.epoch, tokenHash: newHash },
  ]
  await kv.put({
    meta: { epoch: row.epoch, lastSeq: row.seq, epochs, membershipSeq: row.seq, bytes },
    [key(row.seq)]: row,
  })
  return stamp(row)
}

/**
 * Any epoch's token may read, but an old one only up to the record that ended
 * its epoch: a Member who was not cut off can fetch their new key, and someone
 * who was sees nothing written after their removal.
 */
export const pullRecords = async (
  kv: Kv,
  token: unknown,
  after: unknown,
): Promise<readonly Row[]> => {
  // Checked and hashed once, whatever the token or the number of epochs.
  const tokenHash = isToken(token) ? hash(token) : undefined
  const meta = tokenHash === undefined ? undefined : await kv.get<Meta>('meta')
  const mine = meta?.epochs.find((e) => e.tokenHash === tokenHash)
  if (!mine || !Number.isInteger(after)) return fail('forbidden')
  const found = await kv.list<Row>({
    prefix: 'r:',
    start: key(Math.max(Number(after) + 1, 0)),
    limit: PAGE,
  })
  const page: Row[] = []
  let size = 0
  for (const row of found.values()) {
    if (row.seq > (mine.endsAt ?? Infinity)) break
    size += row.payload.length
    // Always at least one, or a pull could never get past a big record.
    if (page.length > 0 && size > PAGE_BYTES) break
    page.push(row)
  }
  return page
}

const HOUR = 3_600_000
const recentCreations = async (kv: Kv, now: number): Promise<number[]> =>
  ((await kv.get<number[]>('created')) ?? []).filter((t) => t > now - HOUR)

/**
 * Creation is capped for everyone, as nothing authenticates a caller. Kept by one
 * registry. Checked and counted in one call, so creations at once cannot pass
 * the cap together; returns the time counted, to release if the board is not made.
 */
export const reserveCreation = async (kv: Kv, now: number): Promise<number> => {
  const recent = await recentCreations(kv, now)
  if (recent.length >= 1000) return fail('busy')
  await kv.put({ created: [...recent, now] })
  return now
}

/** A refused creation costs the quota nothing. */
export const releaseCreation = async (kv: Kv, at: unknown): Promise<void> => {
  const created = (await kv.get<number[]>('created')) ?? []
  const index = created.indexOf(Number(at))
  if (index >= 0) await kv.put({ created: created.filter((_, i) => i !== index) })
}
