import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient, SlotKey } from '@/features/household'
import type { LeftoverId } from '../domain/types'

export type MoveLeftoverError = 'write-failed'

type Input = {
  readonly leftoverId: LeftoverId
  readonly date: string
  readonly slotKey: SlotKey
}

/**
 * Moves a Leftover to another day or Slot.
 *
 * A Leftover has its own date and Slot and keeps its Cook Event: Wednesday's
 * chili eaten on Friday instead of Thursday is still Wednesday's chili, and it
 * still contributes nothing to the Shopping List (ADR 0004).
 */
export const moveLeftover = async (
  client: AppSupabaseClient,
  input: Input,
): Promise<Result<LeftoverId, MoveLeftoverError>> => {
  const { error } = await client
    .from('leftover')
    .update({ date: input.date, slot_key: input.slotKey })
    .eq('id', input.leftoverId)

  if (error !== null) return err('write-failed')

  return ok(input.leftoverId)
}
