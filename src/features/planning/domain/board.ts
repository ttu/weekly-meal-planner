import type { Slot, SlotKey } from '@/features/household'
import { weekDates } from './week'
import type { BoardCard, CookEvent, Leftover, WeekStart } from './types'

export type BoardSlot = {
  readonly slotKey: SlotKey
  readonly labelKey: string
  /** Set only for a Slot the household named itself; see Slot in household. */
  readonly label?: string | undefined
  readonly cards: readonly BoardCard[]
}

export type BoardDay = { readonly date: string; readonly slots: readonly BoardSlot[] }

export type BuildBoardInput = {
  readonly weekStart: WeekStart
  readonly slots: readonly Slot[]
  readonly cookEvents: readonly CookEvent[]
  readonly leftovers: readonly Leftover[]
}

type PlacedCard = { readonly card: BoardCard; readonly date: string; readonly slotKey: SlotKey }

const place = ({ cookEvents, leftovers }: BuildBoardInput): readonly PlacedCard[] => [
  ...cookEvents.map((cookEvent) => ({
    card: { kind: 'cook-event' as const, cookEvent },
    date: cookEvent.date,
    slotKey: cookEvent.slotKey,
  })),
  ...leftovers.map((leftover) => ({
    card: { kind: 'leftover' as const, leftover },
    date: leftover.date,
    slotKey: leftover.slotKey,
  })),
]

export const buildBoard = (input: BuildBoardInput): readonly BoardDay[] => {
  const placed = place(input)

  return weekDates(input.weekStart).map((date) => ({
    date,
    // A Slot that no longer exists in the Household config is skipped, not an
    // error: removing a Slot must never delete the Meals planned in it.
    slots: input.slots.map((slot) => ({
      slotKey: slot.key,
      labelKey: slot.labelKey,
      ...(slot.label === undefined ? {} : { label: slot.label }),
      cards: placed.filter((p) => p.date === date && p.slotKey === slot.key).map((p) => p.card),
    })),
  }))
}
