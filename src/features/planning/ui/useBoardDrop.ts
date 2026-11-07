import { useState } from 'react'
import type { MealId } from '@/features/meals'
import type { BoardDay } from '../domain/board'
import { resolveDrop, type DropAction } from '../domain/drop'
import { breaksLeftoverOrder } from '../domain/leftover-order'
import type { DragPayload, DropTarget } from './DragContext'
import type { PlanRequest } from './usePlanMeal'
import type { PlanningActions } from './usePlanningActions'

/** How long the board says why a card went home. */
const REFUSED_MS = 4000

type Input = {
  readonly board: readonly BoardDay[]
  /** Undefined on a week nobody has planned into yet; the mutation makes the Week Plan. */
  readonly weekPlanId: string | undefined
  readonly add: (mealId: MealId) => void
  readonly plan: (request: PlanRequest) => void
  readonly actions: Pick<PlanningActions, 'move' | 'moveLeftoverTo' | 'unplan'>
}

/** The two drops that can break the order, as the rule wants them. */
const orderedMove = (
  action: DropAction,
  payload: DragPayload,
): Parameters<typeof breaksLeftoverOrder>[0] | undefined => {
  if (action.kind === 'move-leftover' && payload.kind === 'leftover') {
    return { kind: 'leftover', cookEventId: payload.leftover.cookEventId, to: action }
  }
  if (action.kind === 'move') {
    return { kind: 'cook-event', cookEventId: action.cookEventId, to: action }
  }
  return undefined
}

/**
 * What a drop means is decided in the domain; this only carries it out,
 * through the same mutations the tap path uses.
 */
export const useBoardDrop = ({
  board,
  weekPlanId,
  add,
  plan,
  actions,
}: Input): {
  readonly onDropped: (payload: DragPayload, target: DropTarget) => void
  /** True for a few seconds after a drop was refused for breaking Leftover order. */
  readonly orderRefused: boolean
} => {
  const [orderRefused, setOrderRefused] = useState(false)

  const onDropped = (payload: DragPayload, target: DropTarget): void => {
    const action = resolveDrop(payload, target)

    // A Leftover is a second sitting of a pot already cooked, so it cannot be
    // carried back past its Meal — nor the Meal forward past it. The card goes
    // home and the board says why, rather than leaving Wednesday eating the
    // leftovers of Friday's dinner.
    const order = orderedMove(action, payload)
    if (order !== undefined) {
      const allCards = board.flatMap((day) => day.slots).flatMap((slot) => slot.cards)
      // The Household's own order of Slots, which is what "before" means within a day.
      const slotOrder = (board[0]?.slots ?? []).map((slot) => slot.slotKey)
      if (breaksLeftoverOrder(order, allCards, slotOrder)) {
        setOrderRefused(true)
        setTimeout(() => {
          setOrderRefused(false)
        }, REFUSED_MS)
        return
      }
    }

    switch (action.kind) {
      case 'want':
        add(action.mealId)
        return
      case 'plan':
        plan({ weekPlanId, ...action })
        return
      case 'move':
        actions.move(action)
        return
      case 'move-leftover':
        actions.moveLeftoverTo(action)
        return
      case 'unplan':
        actions.unplan(action.cookEventId)
        return
      case 'none':
        return
    }
  }

  return { onDropped, orderRefused }
}
