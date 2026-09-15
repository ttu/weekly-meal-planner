import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import type { LeftoverId } from '../domain/types'

export type RemoveLeftoverError = 'write-failed'

/**
 * Removes one Leftover card and nothing else. Its Cook Event stays: eating the
 * leftovers on Thursday was a plan that changed, not a meal that was never
 * cooked.
 */
export const removeLeftover = async (
  client: AppSupabaseClient,
  leftoverId: LeftoverId,
): Promise<Result<void, RemoveLeftoverError>> => {
  const { error } = await client.from('leftover').delete().eq('id', leftoverId)

  if (error !== null) return err('write-failed')

  return ok(undefined)
}
