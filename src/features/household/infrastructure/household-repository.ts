import { z } from 'zod'
import type { AppSupabaseClient } from './supabase-client'
import { brand } from '@/shared/types/brand'
import { ok, err, isErr, type Result } from '@/shared/types/result'
import { parseSlots } from '../domain/slot'
import type { Household, Member } from '../domain/types'

const rowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  locale: z.enum(['fi', 'en']),
  slots: z.unknown(),
  share_token: z.string(),
})

export type LoadHouseholdError = 'not-found' | 'invalid-row'

export const loadHousehold = async (
  client: AppSupabaseClient,
): Promise<Result<Household, LoadHouseholdError>> => {
  // No household_id filter: RLS already restricts the row set to the Member's
  // own Household (ADR 0002). A filter here would be a second enforcement point.
  const { data } = await client
    .from('household')
    .select('id,name,locale,slots,share_token')
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
    shareToken: row.data.share_token,
  })
}

const memberSchema = z.object({
  user_id: z.uuid(),
  household_id: z.uuid(),
  display_name: z.string(),
  colour: z.string(),
  avatar_url: z.string().nullable(),
})

export type LoadMemberError = 'not-found' | 'invalid-row'

/** The signed-in Member's own row. RLS already restricts this to their
 *  Household, so the only filter needed is their user id. */
export const loadMember = async (
  client: AppSupabaseClient,
  userId: string,
): Promise<Result<Member, LoadMemberError>> => {
  const { data } = await client
    .from('household_member')
    .select('user_id,household_id,display_name,colour,avatar_url')
    .eq('user_id', userId)
    .maybeSingle()

  if (data === null) return err('not-found')

  const row = memberSchema.safeParse(data)
  if (!row.success) return err('invalid-row')

  return ok({
    id: brand<string, 'MemberId'>(row.data.user_id),
    householdId: brand<string, 'HouseholdId'>(row.data.household_id),
    displayName: row.data.display_name,
    colour: row.data.colour,
    ...(row.data.avatar_url === null ? {} : { avatarUrl: row.data.avatar_url }),
  })
}
