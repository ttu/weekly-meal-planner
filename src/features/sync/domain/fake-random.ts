import { sha256 } from '@noble/hashes/sha2'
import type { Random } from './crypto'

/** Deterministic stand-in for the platform's secure random, for tests only. */
export const fakeRandom = (seed: string): Random => {
  let counter = 0
  return (length) => {
    const out = new Uint8Array(length)
    for (let offset = 0; offset < length; offset += 32) {
      const block = sha256(new TextEncoder().encode(`${seed}:${String(counter++)}`))
      out.set(block.subarray(0, Math.min(32, length - offset)), offset)
    }
    return out
  }
}
