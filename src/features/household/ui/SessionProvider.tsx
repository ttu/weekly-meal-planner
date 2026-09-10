import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'
import type { Household, Member } from '../domain/types'

type SessionValue = {
  readonly client: AppSupabaseClient
  readonly household: Household | undefined
  readonly member: Member | undefined
  /** The signed-in Member's user id. household_member has no separate primary
   *  key — its identity is (household_id, user_id). */
  readonly userId: string | undefined
}

const SessionContext = createContext<SessionValue | undefined>(undefined)

export const SessionProvider = ({
  client,
  household,
  member,
  userId,
  children,
}: SessionValue & { readonly children: ReactNode }): React.JSX.Element => {
  const value = useMemo(
    () => ({ client, household, member, userId }),
    [client, household, member, userId],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = (): SessionValue => {
  const value = useContext(SessionContext)
  if (value === undefined) throw new Error('useSession used outside SessionProvider')
  return value
}
