import { ok, err, type Result } from '@/shared/types/result'
import { brand } from '@/shared/types/brand'
import type { AppSupabaseClient, SlotKey } from '@/features/household'
import type { CookEventId, LeftoverId } from '../domain/types'

export type AddLeftoverError = 'write-failed'

type Input = {
  readonly cookEventId: CookEventId
  readonly date: string
  readonly slotKey: SlotKey
}

export const addLeftover = async (
  client: AppSupabaseClient,
  { cookEventId, date, slotKey }: Input,
): Promise<Result<LeftoverId, AddLeftoverError>> => {
  const { data, error } = await client
    .from('leftover')
    .insert({ cook_event_id: cookEventId, date, slot_key: slotKey })
    .select('id')
    .single()

  if (error !== null) return err('write-failed')

  return ok(brand<string, 'LeftoverId'>(data.id))
}
