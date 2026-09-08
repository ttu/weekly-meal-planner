import type { Brand } from '@/shared/types/brand'
import type { Locale } from '@/shared/i18n'

export type HouseholdId = Brand<string, 'HouseholdId'>
export type MemberId = Brand<string, 'MemberId'>
export type SlotKey = Brand<string, 'SlotKey'>

/** `labelKey` is a translation key, never display text: storing "Lounas" would
 *  make the board monolingual (ADR 0009). */
export type Slot = { readonly key: SlotKey; readonly labelKey: string }

export type Household = {
  readonly id: HouseholdId
  readonly name: string
  readonly locale: Locale
  readonly slots: readonly Slot[]
}

export type Member = {
  readonly id: MemberId
  readonly householdId: HouseholdId
  readonly displayName: string
  readonly colour: string
  readonly avatarUrl?: string
}
