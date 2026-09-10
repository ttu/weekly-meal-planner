import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/household'
import type { WeekStart } from '../domain/types'

/**
 * Subscribes to row changes on the week's tables and invalidates the queries
 * that render them, so two Members planning together see each other's edits.
 *
 * Invalidating rather than patching the cache: the payload carries raw rows,
 * and the board needs Meal names and Member colours that come from joins. A
 * hand-built patch would guess at both.
 */
export const useWeekRealtime = (weekStart: WeekStart): void => {
  const { client, household } = useSession()
  const queryClient = useQueryClient()
  const householdId = household?.id

  useEffect(() => {
    if (householdId === undefined) return

    const invalidate = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['week', householdId, weekStart] })
      void queryClient.invalidateQueries({ queryKey: ['shopping', householdId, weekStart] })
    }

    const channel = client
      .channel(`week:${householdId}:${weekStart}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cook_event' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leftover' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'backlog_item' }, invalidate)
      .subscribe()

    // Unsubscribing matters: a channel outlives the screen otherwise, and
    // subscriptions are one of the few real leak sources in this app.
    return () => {
      void client.removeChannel(channel)
    }
  }, [client, householdId, queryClient, weekStart])
}
