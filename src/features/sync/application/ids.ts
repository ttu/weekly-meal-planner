import { bytesToHex } from '@noble/hashes/utils'
import type { Random } from '../domain/crypto'

/** A fresh identifier for a row. 128 random bits, so two devices never collide. */
export const newId = (random: Random): string => bytesToHex(random(16))
