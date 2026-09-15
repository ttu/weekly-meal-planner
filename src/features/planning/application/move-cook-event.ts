import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient, SlotKey } from '@/features/household'
import type { CookEventId } from '../domain/types'

export type MoveCookEventError = 'write-failed'

type Input = {
  readonly cookEventId: CookEventId
  readonly date: string
  readonly slotKey: SlotKey
}

/**
 * Moves a planned Meal to another day or Slot.
 *
 * A plain update rather than an RPC: nothing else changes with it, so there is
 * no pair of statements to keep atomic. Its Leftovers stay where they are —
 * a Leftover has its own date and Slot (ADR 0004), and moving Wednesday's
 * dinner should not drag Thursday's lunch along with it.
 */
export const moveCookEvent = async (
  client: AppSupabaseClient,
  input: Input,
): Promise<Result<CookEventId, MoveCookEventError>> => {
  const { error } = await client
    .from('cook_event')
    .update({ date: input.date, slot_key: input.slotKey })
    .eq('id', input.cookEventId)

  if (error !== null) return err('write-failed')

  return ok(input.cookEventId)
}
