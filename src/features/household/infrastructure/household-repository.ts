import { z } from 'zod'
import type { AppSupabaseClient } from './supabase-client'
import { brand } from '@/shared/types/brand'
import { ok, err, isErr, type Result } from '@/shared/types/result'
import { parseSlots } from '../domain/slot'
import type { Household } from '../domain/types'

const rowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  locale: z.enum(['fi', 'en']),
  slots: z.unknown(),
})

export type LoadHouseholdError = 'not-found' | 'invalid-row'

export const loadHousehold = async (
  client: AppSupabaseClient,
): Promise<Result<Household, LoadHouseholdError>> => {
  // No household_id filter: RLS already restricts the row set to the Member's
  // own Household (ADR 0002). A filter here would be a second enforcement point.
  const { data } = await client
    .from('household')
    .select('id,name,locale,slots')
    .limit(1)
    .maybeSingle()
  if (data === null) return err('not-found')

  const row = rowSchema.safeParse(data)
  if (!row.success) return err('invalid-row')

  const slots = parseSlots(row.data.slots)
  if (isErr(slots)) return err('invalid-row')

  return ok({
    id: brand<string, 'HouseholdId'>(row.data.id),
    name: row.data.name,
    locale: row.data.locale,
    slots: slots.value,
  })
}
