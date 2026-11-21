import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex } from '@noble/hashes/utils'
import type { Result } from '@/shared/types/result'
import type { EpochKey } from './crypto'

export type RelayKind = 'membership' | 'event'

/** One opaque record, in the order the relay received it. `receivedAt` is the relay's clock. */
export type RelayRecord = {
  readonly seq: number
  readonly kind: RelayKind
  readonly epoch: number
  readonly payload: string
  readonly receivedAt: number
}

/** `offline` is a network failure; the rest are answers from the relay itself. */
export type RelayError = 'forbidden' | 'epoch' | 'exists' | 'offline' | 'rejected'

/** The mailbox, as the engine sees it. Implemented over HTTP (`http-relay.ts`) against `relay/`. */
export type Relay = {
  create: (
    board: string,
    token: string,
    payload: string,
  ) => Promise<Result<RelayRecord, RelayError>>
  append: (
    board: string,
    token: string,
    epoch: number,
    kind: RelayKind,
    payload: string,
  ) => Promise<Result<RelayRecord, RelayError>>
  /** Moves to the next epoch and records the membership change that caused it, atomically. */
  rotate: (
    board: string,
    token: string,
    newToken: string,
    payload: string,
    /** The last membership record this change builds on; refused as `epoch` if another landed since. */
    afterMembership: number,
  ) => Promise<Result<RelayRecord, RelayError>>
  pull: (
    board: string,
    token: string,
    afterSeq: number,
  ) => Promise<Result<readonly RelayRecord[], RelayError>>
}

/** What the relay checks instead of identity: knowledge of the current epoch's key. */
export const tokenFor = (key: EpochKey, household: string): string =>
  bytesToHex(hkdf(sha256, key, new TextEncoder().encode('menami/v1/relay-token'), household, 32))

const KNOWN: readonly RelayError[] = ['forbidden', 'epoch', 'exists']

/** The relay answers `relay_<reason>`; anything else is a refusal we do not understand. */
export const relayErrorFromMessage = (message: string): RelayError =>
  KNOWN.find((reason) => message.includes(`relay_${reason}`)) ?? 'rejected'
