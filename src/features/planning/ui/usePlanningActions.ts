import { useBoardSession, type SlotKey } from '@/features/household'
import type { Servings } from '@/features/meals'
import { useData, useSync } from '@/features/sync'
import {
  addLeftover,
  moveCookEvent,
  moveLeftover,
  removeBacklogItem,
  removeLeftover,
  setServingsCooked,
  unplanMeal,
} from '../application/planning-data'
import type { BacklogItemId, CookEventId, LeftoverId } from '../domain/types'
import { useWrite } from './useWrite'

export type LeftoverRequest = {
  readonly cookEventId: CookEventId
  readonly date: string
  readonly slotKey: SlotKey
}

export type MoveRequest = {
  readonly cookEventId: CookEventId
  readonly date: string
  readonly slotKey: SlotKey
}

export type MoveLeftoverRequest = {
  readonly leftoverId: LeftoverId
  readonly date: string
  readonly slotKey: SlotKey
}

export type PlanningActions = {
  readonly addLeftoverFor: (request: LeftoverRequest) => void
  readonly move: (request: MoveRequest) => void
  readonly moveLeftoverTo: (request: MoveLeftoverRequest) => void
  readonly removeLeftoverCard: (id: LeftoverId) => void
  readonly unplan: (cookEventId: CookEventId) => void
  readonly setServings: (cookEventId: CookEventId, servingsCooked: Servings) => void
  readonly removeFromBacklog: (id: BacklogItemId) => void
  readonly leftoverFailed: boolean
  readonly moveFailed: boolean
  readonly unplanFailed: boolean
}

/** The board's additive and destructive actions, each a write to the synced rows. */
export const usePlanningActions = (): PlanningActions => {
  const { userId } = useBoardSession()
  const data = useData()
  const { deps } = useSync()
  const leftover = useWrite()
  const move = useWrite()
  const unplan = useWrite()
  const other = useWrite()

  return {
    addLeftoverFor: (request) => {
      if (data) leftover.run(() => addLeftover(data, deps.random, request))
    },
    move: (request) => {
      if (data) move.run(() => moveCookEvent(data, request))
    },
    moveLeftoverTo: (request) => {
      if (data) leftover.run(() => moveLeftover(data, request))
    },
    removeLeftoverCard: (id) => {
      if (data) leftover.run(() => removeLeftover(data, id))
    },
    unplan: (cookEventId) => {
      if (!data || userId === undefined) return
      unplan.run(() =>
        unplanMeal(data, deps.random, deps.clock.now().getTime(), cookEventId, userId),
      )
    },
    setServings: (cookEventId, servingsCooked) => {
      if (data) other.run(() => setServingsCooked(data, cookEventId, servingsCooked))
    },
    removeFromBacklog: (id) => {
      if (data) other.run(() => removeBacklogItem(data, id))
    },
    leftoverFailed: leftover.failed,
    moveFailed: move.failed,
    unplanFailed: unplan.failed,
  }
}
