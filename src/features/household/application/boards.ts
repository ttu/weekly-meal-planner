import { ok, err, type Result } from '@/shared/types/result'
import { brand } from '@/shared/types/brand'
import type { HouseholdId } from '@/shared/types/ids'
import type { Locale } from '@/shared/i18n'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

export type CreateBoardError = 'short-password' | 'invalid-beta-key' | 'write-failed'
export type JoinBoardError = 'rejected' | 'rate-limited' | 'invalid-beta-key' | 'write-failed'

export type NewBoard = { readonly householdId: HouseholdId; readonly shareToken: string }

/**
 * Signs in anonymously if the person has no identity yet, then creates the
 * board. Anonymous first: the point is that starting a board asks for nothing
 * but a board name (ADR 0010).
 */
export const createBoard = async (
  client: AppSupabaseClient,
  input: {
    readonly boardName: string
    readonly displayName: string
    readonly colour: string
    readonly locale: Locale
    readonly password: string
    /** Only checked while a beta key is set (supabase/schemas/12_beta_key.sql). */
    readonly betaKey?: string | undefined
  },
): Promise<Result<NewBoard, CreateBoardError>> => {
  if (input.password.length < 6) return err('short-password')

  const { data: session } = await client.auth.getSession()
  if (session.session === null) {
    const { error } = await client.auth.signInAnonymously()
    if (error !== null) return err('write-failed')
  }

  const { data, error } = await client.rpc('create_board', {
    p_name: input.boardName,
    p_display_name: input.displayName,
    p_colour: input.colour,
    p_locale: input.locale,
    p_password: input.password,
    p_beta_key: input.betaKey ?? '',
  })

  const row = Array.isArray(data) ? data[0] : undefined
  if (error !== null || row === undefined) return err('write-failed')
  // A status, not an error: the server has to record the wrong guess, and
  // raising would roll the record back (supabase/schemas/42_sharing_rpc.sql).
  if (row.out_status === 'invalid-beta-key') return err('invalid-beta-key')

  return ok({
    householdId: brand<string, 'HouseholdId'>(row.out_household_id),
    shareToken: row.out_share_token,
  })
}

/**
 * The link is a bearer credential and the password is the second factor. The
 * server answers 'rejected' for a wrong link and a wrong password alike, so
 * this cannot be used to discover which links are real.
 *
 * The name is asked for here rather than assigned: a Backlog card says who
 * wanted the Meal, and a board of people all called "Member" answers that
 * question with "somebody". The colour is dealt by the server from the same
 * palette, so no two Members of a household look alike.
 */
export const joinBoard = async (
  client: AppSupabaseClient,
  shareToken: string,
  password: string,
  displayName: string,
  betaKey?: string,
): Promise<Result<HouseholdId, JoinBoardError>> => {
  const { data: session } = await client.auth.getSession()
  if (session.session === null) {
    const { error } = await client.auth.signInAnonymously()
    if (error !== null) return err('write-failed')
  }

  const { data, error } = await client.rpc('join_board', {
    p_share_token: shareToken,
    p_password: password,
    p_display_name: displayName,
    p_beta_key: betaKey ?? '',
  })

  const row = Array.isArray(data) ? data[0] : undefined
  if (error !== null || row === undefined) return err('write-failed')

  if (row.out_status === 'rate-limited') return err('rate-limited')
  if (row.out_status === 'invalid-beta-key') return err('invalid-beta-key')
  // 'joined' is the only status that carries a Household id; every other one
  // returns null beside it.
  if (row.out_status !== 'joined') return err('rejected')

  return ok(brand<string, 'HouseholdId'>(row.out_household_id))
}

/**
 * Whether starting or joining a board asks for the beta key. If the answer
 * cannot be had, ask: a field nobody needed is a nuisance, a missing one is a
 * dead end.
 */
export const betaKeyRequired = async (client: AppSupabaseClient): Promise<boolean> => {
  const { data, error } = await client.rpc('beta_key_required')
  return error !== null || data
}

/** The URL a board is shared with. The token travels here; the password does
 *  not, and the UI says to send it separately. */
export const boardUrl = (origin: string, shareToken: string): string =>
  `${origin}/join/${shareToken}`

export type BoardPreview = {
  readonly name: string
  readonly members: readonly { readonly name: string; readonly colour: string }[]
}

/**
 * Whose board this link opens, before anyone is let in.
 *
 * The join screen names the household and the people already planning, so a
 * password prompt becomes something a person can act on — "ask Dad or Mum".
 * Returns undefined for a link that matches nothing, which is also what a
 * wrong password gets told: see ADR 0010 for why the two stay alike.
 */
export const boardPreview = async (
  client: AppSupabaseClient,
  shareToken: string,
): Promise<BoardPreview | undefined> => {
  const { data, error } = await client.rpc('board_preview', { p_share_token: shareToken })

  const row = Array.isArray(data) ? data[0] : undefined
  if (error !== null || row === undefined) return undefined

  const names = row.out_member_names
  const colours = row.out_member_colours

  return {
    name: row.out_name,
    members: names.map((name, index) => ({ name, colour: colours[index] ?? '' })),
  }
}
