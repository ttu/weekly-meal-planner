import { useEffect, useState } from 'react'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

export type AuthSession = {
  readonly userId: string | undefined
  readonly isLoading: boolean
}

export const useAuthSession = (client: AppSupabaseClient): AuthSession => {
  const [session, setSession] = useState<AuthSession>({ userId: undefined, isLoading: true })

  useEffect(() => {
    void client.auth.getSession().then(({ data }) => {
      setSession({ userId: data.session?.user.id, isLoading: false })
    })

    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession({ userId: next?.user.id, isLoading: false })
    })

    // Unsubscribing matters: this listener outlives the screen otherwise, and
    // subscriptions are one of the few real leak sources in this app.
    return () => {
      data.subscription.unsubscribe()
    }
  }, [client])

  return session
}
