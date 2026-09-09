import type { SlotKey } from '@/features/household'
import type { BoardDay } from './board'

export type PlacementDescription = {
  readonly existingCount: number
  readonly willJoinExisting: boolean
}

export type DescribePlacementInput = {
  readonly board: readonly BoardDay[]
  readonly date: string
  readonly slotKey: SlotKey
}

/**
 * What the plan sheet should tell the Member about the Slot they have chosen.
 *
 * Pure, and tested, because the message it drives — "Tuesday dinner already has
 * 2 Meals. Yours will join them." — is the app's clearest statement that it will
 * not refuse an edit.
 */
export const describePlacement = ({
  board,
  date,
  slotKey,
}: DescribePlacementInput): PlacementDescription => {
  const day = board.find((d) => d.date === date)
  const slot = day?.slots.find((s) => s.slotKey === slotKey)
  const existingCount = slot?.cards.length ?? 0

  return { existingCount, willJoinExisting: existingCount > 0 }
}
