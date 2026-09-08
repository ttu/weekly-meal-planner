import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

export type SignInError = 'invalid-credentials' | 'unavailable'

/**
 * Password sign-in. An email link needs deep-link handling and a configured
 * mail sender, which belongs with the deployment work rather than here; the
 * seeded demo users have known passwords.
 *
 * A wrong password is an expected outcome, not an exception — it comes back as
 * a Result the screen can render.
 */
export const signIn = async (
  client: AppSupabaseClient,
  email: string,
  password: string,
): Promise<Result<void, SignInError>> => {
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error === null) return ok(undefined)
  return err(error.status === 400 ? 'invalid-credentials' : 'unavailable')
}

export const signOut = async (client: AppSupabaseClient): Promise<void> => {
  await client.auth.signOut()
}
