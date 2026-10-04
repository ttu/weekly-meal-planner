import { brand } from '@/shared/types/brand'
import { ok, err, type Result } from '@/shared/types/result'
import type { Slot, SlotKey } from './types'

/**
 * The Slots a household can pick from without naming anything themselves.
 * Translation keys, so a board shared between a Finnish phone and an English
 * one reads correctly on both (ADR 0009). Anything outside this list is named
 * by the household and is monolingual by nature — "Eväät" is their word.
 */
export const SLOT_PRESETS: readonly Slot[] = [
  { key: brand<string, 'SlotKey'>('breakfast'), labelKey: 'slot.breakfast' },
  { key: brand<string, 'SlotKey'>('lunch'), labelKey: 'slot.lunch' },
  { key: brand<string, 'SlotKey'>('snack'), labelKey: 'slot.snack' },
  { key: brand<string, 'SlotKey'>('dinner'), labelKey: 'slot.dinner' },
  { key: brand<string, 'SlotKey'>('supper'), labelKey: 'slot.supper' },
]

/**
 * Six is not a rule about eating, it is a rule about the board: a day column
 * with more rows than this stops being readable on a phone, which is where
 * the week actually gets planned.
 */
export const MAX_SLOTS = 6

export type SlotEditError = 'duplicate-slot' | 'too-many-slots' | 'last-slot' | 'name-required'

/** What a Slot is called: the household's own word if they gave one, the
 *  translated preset otherwise. */
export const slotName = (
  slot: { readonly labelKey: string; readonly label?: string | undefined },
  translate: (key: string) => string,
): string => slot.label ?? translate(slot.labelKey)

/**
 * A key for a Slot a household named. It ends up in `cook_event.slot_key` and
 * must stay stable and readable in a URL-ish way; the counter is for the
 * household that wants two Slots both called "Eväät".
 */
const keyFor = (label: string, taken: readonly SlotKey[]): SlotKey => {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 16) || 'slot'

  let candidate = base
  let n = 2
  while (taken.includes(brand<string, 'SlotKey'>(candidate))) {
    candidate = `${base}-${String(n)}`
    n += 1
  }
  return brand<string, 'SlotKey'>(candidate)
}

export const addPresetSlot = (
  slots: readonly Slot[],
  preset: Slot,
): Result<readonly Slot[], SlotEditError> => {
  if (slots.length >= MAX_SLOTS) return err('too-many-slots')
  if (slots.some((s) => s.key === preset.key)) return err('duplicate-slot')
  return ok([...slots, preset])
}

export const addNamedSlot = (
  slots: readonly Slot[],
  rawLabel: string,
): Result<readonly Slot[], SlotEditError> => {
  const label = rawLabel.trim()
  if (label.length === 0) return err('name-required')
  if (slots.length >= MAX_SLOTS) return err('too-many-slots')

  const key = keyFor(
    label,
    slots.map((s) => s.key),
  )
  return ok([...slots, { key, labelKey: key, label }])
}

/**
 * Removing the last Slot would leave a board with nowhere to put a Meal, so
 * it is refused rather than silently ignored. Meals already planned in the
 * Slot survive — the board skips a Slot it no longer knows, and putting the
 * Slot back brings them into view again.
 */
export const removeSlot = (
  slots: readonly Slot[],
  key: SlotKey,
): Result<readonly Slot[], SlotEditError> => {
  if (slots.length <= 1) return err('last-slot')
  const remaining = slots.filter((s) => s.key !== key)
  return ok(remaining)
}

/** Slots are ordered by when the household eats, so the board reads down the
 *  day. `by` is -1 for earlier, 1 for later; at either end nothing moves. */
export const moveSlot = (slots: readonly Slot[], key: SlotKey, by: -1 | 1): readonly Slot[] => {
  const from = slots.findIndex((s) => s.key === key)
  const to = from + by
  if (from === -1 || to < 0 || to >= slots.length) return slots

  const reordered = [...slots]
  const [moved] = reordered.splice(from, 1)
  if (moved === undefined) return slots
  reordered.splice(to, 0, moved)
  return reordered
}
