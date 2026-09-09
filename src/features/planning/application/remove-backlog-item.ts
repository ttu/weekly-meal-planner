import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import type { BacklogItemId } from '../domain/types'

export type RemoveBacklogItemError = 'write-failed'

export const removeBacklogItem = async (
  client: AppSupabaseClient,
  id: BacklogItemId,
): Promise<Result<void, RemoveBacklogItemError>> => {
  const { error } = await client.from('backlog_item').delete().eq('id', id)
  if (error !== null) return err('write-failed')
  return ok(undefined)
}
