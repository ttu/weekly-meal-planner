import { ed25519, x25519 } from '@noble/curves/ed25519'
import { bytesToHex } from '@noble/hashes/utils'
import { newKeyPair, type KeyPair, type Random } from './crypto'

/** A Member's two key pairs: one signs what they write, one receives sealed epoch keys. */
export type Identity = {
  readonly signSecretKey: Uint8Array
  readonly signPublicKey: Uint8Array
  readonly box: KeyPair
}

export const newIdentity = (random: Random): Identity => {
  const signSecretKey = random(32)
  return {
    signSecretKey,
    signPublicKey: ed25519.getPublicKey(signSecretKey),
    box: newKeyPair(random),
  }
}

/** A Member is identified by their signing public key, so an id cannot be claimed by someone else. */
export const memberKeyOf = (identity: Identity): string => bytesToHex(identity.signPublicKey)

/** Rebuilds an identity from the two secret keys, as a seat in an invite carries them. */
export const identityFromSecrets = (
  signSecretKey: Uint8Array,
  boxSecretKey: Uint8Array,
): Identity => ({
  signSecretKey,
  signPublicKey: ed25519.getPublicKey(signSecretKey),
  box: { secretKey: boxSecretKey, publicKey: x25519.getPublicKey(boxSecretKey) },
})
