import { z } from 'zod'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import type { Random } from '../domain/crypto'
import { identityFromSecrets, newIdentity, type Identity } from '../domain/identity'
import type { KeyValue } from './engine'

const IDENTITY = 'sync/device'
const CURRENT = 'sync/current'

const secrets = z.object({ sign: z.string(), box: z.string() })

/**
 * This device's own keys, made on first use and kept in the vault. Losing them
 * loses the seat, so a stored value that cannot be read is an error, never a
 * reason to quietly make a new identity.
 */
export const loadIdentity = async (vault: KeyValue, random: Random): Promise<Identity> => {
  const stored = await vault.get(IDENTITY)
  if (stored === undefined) {
    const made = newIdentity(random)
    await vault.set(
      IDENTITY,
      JSON.stringify({ sign: bytesToHex(made.signSecretKey), box: bytesToHex(made.box.secretKey) }),
    )
    return made
  }
  const parsed = secrets.safeParse(JSON.parse(stored))
  if (!parsed.success) throw new Error('The stored device identity is unreadable')
  return identityFromSecrets(hexToBytes(parsed.data.sign), hexToBytes(parsed.data.box))
}

/** Which board this device has open. Not a secret. */
export const currentHousehold = (storage: KeyValue): Promise<string | undefined> =>
  storage.get(CURRENT)

export const rememberHousehold = (storage: KeyValue, household: string): Promise<void> =>
  storage.set(CURRENT, household)
