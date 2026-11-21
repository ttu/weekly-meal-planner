import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import { z } from 'zod'
import type { EpochKey } from '../domain/crypto'
import { brand } from '@/shared/types/brand'
import { eventBody, fieldValueSchema, hlcSchema, type EventBody } from '../domain/event-codec'
import type { Hlc } from '../domain/hlc'
import type { Membership } from '../domain/membership'
import type { RelayRecord } from '../domain/relay'
import type { Store } from '../domain/store'

export type Status = 'ok' | 'removed' | 'lockedOut'

/** Everything a device knows about one Household. Plain data, so it can be saved and rebuilt. */
export type EngineState = {
  readonly household: string
  readonly membership: Membership | undefined
  /** Keyed by epoch number as a string. */
  readonly keys: { readonly [epoch: string]: EpochKey }
  readonly store: Store
  /** The last relay record applied; the next pull asks for everything after it. */
  readonly lastSeq: number
  /** The last membership record seen; a rotation names it so the relay refuses one built on old state. */
  readonly membershipSeq: number
  readonly hlc: Hlc
  readonly outbox: readonly EventBody[]
  readonly status: Status
  /** Event records that arrived before the key to read them; retried when a key does. */
  readonly held: readonly RelayRecord[]
  /** The first record not held for lack of room; pulled again once a key arrives. */
  readonly dropped: number | undefined
  /** Until the first key arrives, the token from the invite is all a joiner has. */
  readonly bootToken: string | undefined
}

const hex = z.string().regex(/^[0-9a-f]{64}$/)

const snapshotSchema = z.object({
  household: z.string(),
  membership: z
    .object({
      household: z.string(),
      epoch: z.number(),
      head: z.string(),
      members: z.record(hex, z.object({ box: hex, role: z.enum(['admin', 'member']) })),
    })
    .optional(),
  store: z.record(
    z.string(),
    z.record(z.string(), z.object({ hlc: hlcSchema, value: fieldValueSchema })),
  ),
  lastSeq: z.number(),
  membershipSeq: z.number().default(-1),
  dropped: z.number().optional(),
  hlc: hlcSchema,
  outbox: z.array(eventBody),
  status: z.enum(['ok', 'removed', 'lockedOut']),
  held: z.array(
    z.object({
      seq: z.number(),
      kind: z.enum(['membership', 'event']),
      epoch: z.number(),
      payload: z.string(),
      receivedAt: z.number(),
    }),
  ),
})

const secretsSchema = z.object({ keys: z.record(z.string(), hex), bootToken: hex.optional() })

/** Epoch keys and the invite token are secrets: they go to the vault, never into the ordinary snapshot. */
export const serialise = (state: EngineState): { snapshot: string; keys: string } => ({
  snapshot: JSON.stringify({ ...state, keys: undefined, bootToken: undefined }),
  keys: JSON.stringify({
    keys: Object.fromEntries(
      Object.entries(state.keys).map(([epoch, key]) => [epoch, bytesToHex(key)]),
    ),
    bootToken: state.bootToken,
  }),
})

export const deserialise = (snapshot: string, keys: string): EngineState | undefined => {
  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(snapshot))
    const parsedKeys = secretsSchema.safeParse(JSON.parse(keys))
    if (!parsed.success || !parsedKeys.success) return undefined
    return {
      ...parsed.data,
      membership: parsed.data.membership,
      dropped: parsed.data.dropped,
      bootToken: parsedKeys.data.bootToken,
      keys: Object.fromEntries(
        Object.entries(parsedKeys.data.keys).map(([epoch, key]) => [
          epoch,
          brand<Uint8Array, 'EpochKey'>(hexToBytes(key)),
        ]),
      ),
    }
  } catch {
    return undefined
  }
}
