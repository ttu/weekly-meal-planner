import { ok, err, type Result } from '@/shared/types/result'
import { isPlausibleEmail } from '../domain/email'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

export type AddEmailError = 'invalid-email' | 'taken' | 'rate-limited' | 'unavailable'

/**
 * Puts an address on the identity this device already holds, so the seat on
 * the board survives clearing browser data.
 *
 * Nothing changes until the link in the inbox is clicked: Supabase holds the
 * address as pending and the account stays anonymous, which is exactly the
 * verification this is for. The start screen has promised "add an email later
 * to keep it safe" since the first version; this is the thing it promised.
 */
export const addEmail = async (
  client: AppSupabaseClient,
  email: string,
  redirectTo: string,
): Promise<Result<undefined, AddEmailError>> => {
  const trimmed = email.trim()
  if (!isPlausibleEmail(trimmed)) return err('invalid-email')

  const { error } = await client.auth.updateUser(
    { email: trimmed },
    { emailRedirectTo: redirectTo },
  )
  if (error === null) return ok(undefined)

  if (error.status === 429) return err('rate-limited')
  if (error.status === 422 || error.status === 400) return err('taken')
  return err('unavailable')
}
