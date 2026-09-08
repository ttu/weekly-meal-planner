import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'
import type { Household, MemberId } from '../domain/types'

type SessionValue = {
  readonly client: AppSupabaseClient
  readonly household: Household | undefined
  readonly memberId: MemberId | undefined
}

const SessionContext = createContext<SessionValue | undefined>(undefined)

export const SessionProvider = ({
  client,
  household,
  memberId,
  children,
}: SessionValue & { readonly children: ReactNode }): React.JSX.Element => {
  const value = useMemo(() => ({ client, household, memberId }), [client, household, memberId])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = (): SessionValue => {
  const value = useContext(SessionContext)
  if (value === undefined) throw new Error('useSession used outside SessionProvider')
  return value
}
