import { useEffect, useState } from 'react'
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import { useSession } from './SessionProvider'

export type PresentMember = {
  readonly userId: string
  readonly displayName: string
  readonly colour: string
}

/**
 * Who else is looking at this week. A separate channel from row changes: this
 * is ephemeral state that belongs to nobody's table, and mixing it into the
 * row stream would mean writing presence to the database.
 */
export const usePresence = (
  key: string,
  me: { displayName: string; colour: string } | undefined,
): readonly PresentMember[] => {
  const { client, household, userId } = useSession()
  const [present, setPresent] = useState<readonly PresentMember[]>([])
  const householdId = household?.id

  useEffect(() => {
    if (householdId === undefined || userId === undefined || me === undefined) return

    const channel = client.channel(`presence:${householdId}:${key}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresentMember>()
        setPresent(
          Object.values(state)
            .flat()
            .filter((entry) => entry.userId !== userId),
        )
      })
      .subscribe((status) => {
        // Tracking before the channel is subscribed silently does nothing.
        if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) return
        void channel.track({ userId, displayName: me.displayName, colour: me.colour })
      })

    return () => {
      void client.removeChannel(channel)
    }
  }, [client, householdId, key, me, userId])

  return present
}
