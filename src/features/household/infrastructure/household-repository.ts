import { z } from 'zod'
import type { AppSupabaseClient } from './supabase-client'
import { brand } from '@/shared/types/brand'
import { ok, err, isErr, type Result } from '@/shared/types/result'
import type { Locale } from '@/shared/i18n'
import { parseSlots } from '../domain/slot'
import type { Household, HouseholdId, Member, Slot } from '../domain/types'

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

export type SaveSlotsError = 'write-failed'

/**
 * The Household's Slots, replaced wholesale — they are one ordered list, and
 * a partial update would let two tabs interleave into an order neither chose.
 * RLS decides whether this caller may write them (ADR 0002).
 */
export const saveSlots = async (
  client: AppSupabaseClient,
  householdId: HouseholdId,
  slots: readonly Slot[],
): Promise<Result<readonly Slot[], SaveSlotsError>> => {
  const { error } = await client
    .from('household')
    .update({ slots: slots.map((slot) => ({ ...slot })) })
    .eq('id', householdId)

  if (error !== null) return err('write-failed')
  return ok(slots)
}

/** The language the whole board speaks (ADR 0009). A Household setting, not a
 *  device one: everyone on the board sees the same Catalogue. */
export const saveLocale = async (
  client: AppSupabaseClient,
  householdId: HouseholdId,
  locale: Locale,
): Promise<Result<Locale, SaveSlotsError>> => {
  const { error } = await client.from('household').update({ locale }).eq('id', householdId)
  if (error !== null) return err('write-failed')
  return ok(locale)
}
