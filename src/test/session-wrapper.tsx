import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider, type AppSupabaseClient, type HouseholdSize } from '@/features/household'
import { SelectedWeekProvider } from '@/features/planning'
import { fixedClock } from '@/shared/time/clock'
import type { HouseholdId, MemberId } from '@/shared/types/ids'

export const testClock = fixedClock('2026-03-11T10:00:00Z')

/** A fresh cache per test, and no automatic retries: a test that wants a retry
 *  presses the button. */
export const newQueryClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })

/**
 * The providers every data hook sits under: a Query cache, a signed-in Member
 * of one Household, and the week on screen. The Supabase client is the only
 * thing faked.
 */
export const sessionWrapper = (
  client: AppSupabaseClient,
  queryClient: QueryClient = newQueryClient(),
): ((props: { readonly children: ReactNode }) => React.JSX.Element) => {
  const Wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <SessionProvider
        client={client}
        household={{
          id: 'h1' as HouseholdId,
          name: 'Koti',
          locale: 'en',
          slots: [],
          size: 4 as HouseholdSize,
          shareToken: 't',
        }}
        member={{
          id: 'm1' as MemberId,
          householdId: 'h1' as HouseholdId,
          displayName: 'Sanni',
          colour: '#5F7355',
        }}
        userId="u1"
        householdChecked
      >
        <SelectedWeekProvider clock={testClock}>{children}</SelectedWeekProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
  return Wrapper
}
