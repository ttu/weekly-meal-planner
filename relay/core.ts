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
type Meta = { epoch: number; lastSeq: number; epochs: EpochRow[] }

const MAX_PAYLOAD = 65_536
const MAX_RECORDS = 100_000
// A little headroom, so a full board can still cut a Member off.
const MAX_RECORDS_ROTATE = 100_100
// The epoch list is one stored value, so it is kept small.
const MAX_EPOCHS = 500
const PAGE = 500
const TOKEN = /^[0-9a-f]{64}$/
const BOARD = /^[\w-]{8,128}$/

const key = (seq: number): string => `r:${String(seq).padStart(10, '0')}`
const hash = (token: string): string => bytesToHex(sha256(utf8ToBytes(token)))
const fail = (reason: Reason): never => {
  throw new RelayFailure(reason)
}

const isToken = (value: unknown): value is string => typeof value === 'string' && TOKEN.test(value)
const isPayload = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_PAYLOAD

/** One answer for "no such board" and "wrong token", so a board cannot be probed. */
const current = async (kv: Kv, token: unknown): Promise<Meta> => {
  const meta = await kv.get<Meta>('meta')
  const known = typeof token === 'string' && meta?.epochs.at(-1)?.tokenHash === hash(token)
  return meta && known ? meta : fail('forbidden')
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
  if (typeof board !== 'string' || !BOARD.test(board) || !isToken(token) || !isPayload(payload))
    return fail('bad_request')
  if (await kv.get('meta')) return fail('exists')
  const first = record('membership', 1, 0, payload, now)
  await kv.put({
    meta: { epoch: 1, lastSeq: 0, epochs: [{ epoch: 1, tokenHash: hash(token) }] } satisfies Meta,
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
  if (meta.lastSeq >= MAX_RECORDS) return fail('full')
  const row = record(kind, meta.epoch, meta.lastSeq + 1, payload, now)
  await kv.put({ meta: { ...meta, lastSeq: row.seq }, [key(row.seq)]: row })
  return stamp(row)
}

/** Moves to the next epoch and records the membership change that caused it, in one step. */
export const rotateBoard = async (
  kv: Kv,
  token: unknown,
  newToken: unknown,
  payload: unknown,
  now: number,
): Promise<Stamp> => {
  const meta = await current(kv, token)
  if (meta.lastSeq >= MAX_RECORDS_ROTATE || meta.epochs.length >= MAX_EPOCHS) return fail('full')
  if (!isToken(newToken) || !isPayload(payload)) return fail('bad_request')
  // Not the current token, and not any earlier one: taking an old token back would undo a removal.
  if (meta.epochs.some((e) => e.tokenHash === hash(newToken))) return fail('same_token')
  const row = record('membership', meta.epoch + 1, meta.lastSeq + 1, payload, now)
  const epochs = [
    ...meta.epochs.map((e) => (e.epoch === meta.epoch ? { ...e, endsAt: row.seq } : e)),
    { epoch: row.epoch, tokenHash: hash(newToken) },
  ]
  await kv.put({ meta: { epoch: row.epoch, lastSeq: row.seq, epochs }, [key(row.seq)]: row })
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
  const meta = await kv.get<Meta>('meta')
  const mine =
    typeof token === 'string' ? meta?.epochs.find((e) => e.tokenHash === hash(token)) : undefined
  if (!mine || !Number.isInteger(after)) return fail('forbidden')
  const found = await kv.list<Row>({
    prefix: 'r:',
    start: key(Math.max(Number(after) + 1, 0)),
    limit: PAGE,
  })
  return [...found.values()].filter((r) => r.seq <= (mine.endsAt ?? Infinity))
}

/** Creation is capped for everyone, as nothing authenticates a caller. Kept by one registry. */
export const admitCreation = async (kv: Kv, now: number): Promise<void> => {
  const HOUR = 3_600_000
  const recent = ((await kv.get<number[]>('created')) ?? []).filter((t) => t > now - HOUR)
  if (recent.length >= 1000) return fail('busy')
  await kv.put({ created: [...recent, now] })
}
