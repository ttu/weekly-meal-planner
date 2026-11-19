import { z } from 'zod'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import type { Random } from '../domain/crypto'
import { identityFromSecrets, newIdentity, type Identity } from '../domain/identity'
import type { Deps, KeyValue } from './engine'

const IDENTITY = 'sync/device'
const CURRENT = 'sync/current'
const SEAT = 'sync/current-seat'

const secrets = z.object({ sign: z.string(), box: z.string() })

const read = async (vault: KeyValue, key: string): Promise<Identity | undefined> => {
  const stored = await vault.get(key)
  if (stored === undefined) return undefined
  const parsed = secrets.safeParse(JSON.parse(stored))
  if (!parsed.success) throw new Error('The stored identity is unreadable')
  return identityFromSecrets(hexToBytes(parsed.data.sign), hexToBytes(parsed.data.box))
}

const write = (vault: KeyValue, key: string, identity: Identity): Promise<void> =>
  vault.set(
    key,
    JSON.stringify({
      sign: bytesToHex(identity.signSecretKey),
      box: bytesToHex(identity.box.secretKey),
    }),
  )

/**
 * This device's own keys, made on first use and kept in the vault. Losing them
 * loses the seat, so a stored value that cannot be read is an error, never a
 * reason to quietly make a new identity.
 */
export const loadIdentity = async (vault: KeyValue, random: Random): Promise<Identity> => {
  const existing = await read(vault, IDENTITY)
  if (existing) return existing
  const made = newIdentity(random)
  await write(vault, IDENTITY, made)
  return made
}

/**
 * The board this device has open, and who this device is on it: its own
 * identity for a board it started, the seat's for one it joined by invite.
 */
export const rememberBoard = async (
  deps: Pick<Deps, 'storage' | 'vault'>,
  household: string,
  identity: Identity,
): Promise<void> => {
  await write(deps.vault, SEAT, identity)
  await deps.storage.set(CURRENT, household)
}

/** Let go of the open board on this device; the next start shows none. */
export const forgetBoard = (deps: Pick<Deps, 'storage'>): Promise<void> =>
  deps.storage.set(CURRENT, '')

export const recallBoard = async (
  deps: Pick<Deps, 'storage' | 'vault'>,
): Promise<{ readonly household: string; readonly identity: Identity } | undefined> => {
  const household = await deps.storage.get(CURRENT)
  const identity = await read(deps.vault, SEAT)
  return household && identity ? { household, identity } : undefined
}
