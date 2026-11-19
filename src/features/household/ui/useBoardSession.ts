import { useMemo } from 'react'
import { brand } from '@/shared/types/brand'
import { useData, useSync, useView } from '@/features/sync'
import { readMembers, readSettings } from '../application/board-data'
import type { Household, Member } from '../domain/types'

export type BoardSession = {
  readonly household: Household | undefined
  /** This device's Member on the open board. */
  readonly member: Member | undefined
  readonly userId: string | undefined
  /** False until the device has looked for the board it had. */
  readonly checked: boolean
}

const NONE = { household: undefined, member: undefined, userId: undefined } as const

/**
 * The Household and Member the screens see, read from the synced board. A
 * Member who has been removed sees no Household, as a stranger would.
 */
export const useBoardSession = (): BoardSession => {
  const { ready } = useSync()
  const view = useView()
  const data = useData()
  return useMemo(() => {
    if (!view || !data || view.status === 'removed') return { ...NONE, checked: ready }
    const me = readMembers(view, data).find((m) => m.id === brand<string, 'MemberId'>(view.me))
    return {
      household: readSettings(view, data),
      member: me,
      userId: view.me,
      checked: ready,
    }
  }, [view, data, ready])
}
