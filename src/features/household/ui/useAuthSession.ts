import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

export type AuthSession = {
  readonly userId: string | undefined
  /** The address on the account, once one has been added and confirmed.
   *  Undefined on an anonymous identity, which is most of them (ADR 0010). */
  readonly email: string | undefined
  /** An address that has been given but not yet clicked through from the
   *  inbox. The account is still anonymous until it is. */
  readonly pendingEmail: string | undefined
  readonly isLoading: boolean
}

/** Supabase keeps an unconfirmed address on `new_email` until the link in the
 *  inbox is clicked, and only then moves it to `email`. */
const read = (user: User | undefined): AuthSession => ({
  userId: user?.id,
  email: user?.email === undefined || user.email === '' ? undefined : user.email,
  pendingEmail: typeof user?.new_email === 'string' ? user.new_email : undefined,
  isLoading: false,
})

export const useAuthSession = (client: AppSupabaseClient): AuthSession => {
  const [session, setSession] = useState<AuthSession>({
    userId: undefined,
    email: undefined,
    pendingEmail: undefined,
    isLoading: true,
  })

  useEffect(() => {
    void client.auth.getSession().then(({ data }) => {
      setSession(read(data.session?.user))
    })

    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(read(next?.user))
    })

    // Unsubscribing matters: this listener outlives the screen otherwise, and
    // subscriptions are one of the few real leak sources in this app.
    return () => {
      data.subscription.unsubscribe()
    }
  }, [client])

  return session
}
