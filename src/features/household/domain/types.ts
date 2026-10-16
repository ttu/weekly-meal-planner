import type { Locale } from '@/shared/i18n'
import type { Brand } from '@/shared/types/brand'
import type { HouseholdId, MemberId, SlotKey } from '@/shared/types/ids'

export type { HouseholdId, MemberId, SlotKey } from '@/shared/types/ids'

/** How many people the Household cooks for. The number a new Meal starts at. */
export type HouseholdSize = Brand<number, 'HouseholdSize'>

/**
 * `labelKey` is a translation key, never display text: storing "Lounas" there
 * would make the board monolingual (ADR 0009).
 *
 * `label` is the exception, and only for a Slot the household named itself —
 * "Eväät" has no translation key because nobody but them uses it. Read both
 * through `slotName`, never `labelKey` alone.
 */
export type Slot = {
  readonly key: SlotKey
  readonly labelKey: string
  readonly label?: string | undefined
}

export type Household = {
  readonly id: HouseholdId
  readonly name: string
  readonly locale: Locale
  readonly slots: readonly Slot[]
  readonly size: HouseholdSize
  /** The token the board is shared with. Held by Members only — RLS keeps the
   *  household row out of everyone else's reach (ADR 0010). */
  readonly shareToken: string
}

export type Member = {
  readonly id: MemberId
  readonly householdId: HouseholdId
  readonly displayName: string
  readonly colour: string
  readonly avatarUrl?: string
}
