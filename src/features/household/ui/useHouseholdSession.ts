import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isOk } from '@/shared/types/result'
import { setLocale } from '@/shared/i18n'
import { loadHousehold, loadMember } from '../infrastructure/household-repository'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'
import type { Household, Member } from '../domain/types'

export const HOUSEHOLD_QUERY_KEY = ['household'] as const

export type HouseholdSession = {
  readonly household: Household | undefined
  readonly member: Member | undefined
  readonly checked: boolean
}

/**
 * A query rather than a one-shot effect, because creating or joining a board
 * changes the answer: the effect version had already decided "no Household"
 * before create_board finished, and the person landed on the empty state they
 * had just spent a screen avoiding.
 */
export const useHouseholdSession = (
  client: AppSupabaseClient,
  userId: string | undefined,
): HouseholdSession => {
  const { data, isFetched } = useQuery({
    queryKey: [...HOUSEHOLD_QUERY_KEY, userId],
    enabled: userId !== undefined,
    queryFn: async () => {
      if (userId === undefined) return { household: undefined, member: undefined }

      const householdResult = await loadHousehold(client)
      const memberResult = await loadMember(client, userId)

      return {
        household: isOk(householdResult) ? householdResult.value : undefined,
        member: isOk(memberResult) ? memberResult.value : undefined,
      }
    },
  })

  const locale = data?.household?.locale

  useEffect(() => {
    // The Household's Locale overrides the device guess (ADR 0009).
    if (locale !== undefined) void setLocale(locale)
  }, [locale])

  return {
    household: data?.household,
    member: data?.member,
    checked: userId === undefined || isFetched,
  }
}

/**
 * Called after creating or joining a board, so the app stops believing the
 * person is a Member of nothing.
 *
 * Reset rather than invalidate. Signing in anonymously starts this query
 * immediately, so it is usually still in flight — reading "no Household"
 * moments before create_board creates one — when the board arrives. An
 * invalidated in-flight query is not restarted, and that stale empty answer
 * became the cached truth: a person who had just named their board landed on
 * the "no Household" screen. Reset cancels the fetch in flight and starts a
 * new one, which can only see the world after the board exists.
 */
export const useRefreshHousehold = (): (() => Promise<void>) => {
  const queryClient = useQueryClient()
  return () => queryClient.resetQueries({ queryKey: HOUSEHOLD_QUERY_KEY })
}
