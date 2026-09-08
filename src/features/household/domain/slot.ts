import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { ok, err, type Result } from '@/shared/types/result'
import type { Slot } from './types'

const slotSchema = z.array(
  z.object({ key: z.string().min(1).max(24), labelKey: z.string().min(1) }),
)

export type ParseSlotsError = 'invalid-slots'

export const parseSlots = (input: unknown): Result<readonly Slot[], ParseSlotsError> => {
  const parsed = slotSchema.safeParse(input)
  if (!parsed.success) return err('invalid-slots')

  const keys = parsed.data.map((s) => s.key)
  if (new Set(keys).size !== keys.length) return err('invalid-slots')

  return ok(
    parsed.data.map((s) => ({ key: brand<string, 'SlotKey'>(s.key), labelKey: s.labelKey })),
  )
}
