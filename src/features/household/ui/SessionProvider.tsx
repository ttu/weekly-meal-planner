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
  /** The confirmed address on this identity, and one given but not yet
   *  clicked through. Anonymous identities have neither (ADR 0010). */
  readonly email?: string | undefined
  readonly pendingEmail?: string | undefined
  /** Whether the Household lookup has finished. Distinguishes "still loading"
   *  from "signed in but a Member of nothing", which look identical otherwise. */
  readonly householdChecked: boolean
}

const SessionContext = createContext<SessionValue | undefined>(undefined)

export const SessionProvider = ({
  client,
  household,
  member,
  userId,
  email,
  pendingEmail,
  householdChecked,
  children,
}: SessionValue & { readonly children: ReactNode }): React.JSX.Element => {
  const value = useMemo(
    () => ({ client, household, member, userId, email, pendingEmail, householdChecked }),
    [client, household, member, userId, email, pendingEmail, householdChecked],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = (): SessionValue => {
  const value = useContext(SessionContext)
  if (value === undefined) throw new Error('useSession used outside SessionProvider')
  return value
}
