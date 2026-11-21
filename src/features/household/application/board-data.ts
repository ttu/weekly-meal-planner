import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { isErr } from '@/shared/types/result'
import { memberColours } from '@/shared/theme/tokens'
import type { Locale } from '@/shared/i18n'
import type { Data, Doc, FieldValue, SyncView } from '@/features/sync'
import { DEFAULT_SIZE, MAX_SIZE, MIN_SIZE } from '../domain/size'
import { parseSlots } from '../domain/slot'
import { SLOT_PRESETS } from '../domain/slot-edit'
import type { Household, HouseholdSize, Member, Slot } from '../domain/types'

/** Longer is read back as no name at all, so it is cut where it is written. */
export const MAX_BOARD_NAME = 80
export const MAX_MEMBER_NAME = 40

/**
 * The Household's settings and its Members' names, as rows of the synced board.
 * The access list itself (who is a Member, who is an admin) is the signed
 * membership log; a Member's row here is only how they are shown.
 */
const KIND = 'household'
const ID = 'main'
const PROFILE = 'member'

export type BoardSettings = Household
export type BoardMember = Member & { readonly role: 'admin' | 'member' }

const DEFAULT_SLOTS = SLOT_PRESETS.filter((s) => s.key === 'lunch' || s.key === 'dinner')

const settingsSchema = z.object({
  name: z.string().min(1).max(MAX_BOARD_NAME).catch(''),
  locale: z.enum(['fi', 'en']).catch('fi'),
  size: z.number().int().min(MIN_SIZE).max(MAX_SIZE).catch(DEFAULT_SIZE),
  slots: z.unknown().optional(),
})

const slotsOf = (raw: unknown): readonly Slot[] => {
  const parsed = parseSlots(raw)
  return isErr(parsed) ? DEFAULT_SLOTS : parsed.value
}

/** Never throws, whatever another Member wrote: bad fields fall back to defaults. */
export const readSettings = (view: SyncView, data: Data): BoardSettings => {
  const parsed = settingsSchema.parse(data.get(KIND, ID) ?? {})
  return {
    id: brand<string, 'HouseholdId'>(view.household),
    name: parsed.name,
    locale: parsed.locale,
    size: brand<number, 'HouseholdSize'>(parsed.size),
    slots: slotsOf(parsed.slots),
  }
}

const profileSchema = z.object({
  name: z.string().min(1).max(MAX_MEMBER_NAME).catch(''),
  colour: z.string().max(16).catch(''),
})

export const readMembers = (view: SyncView, data: Data): readonly BoardMember[] =>
  Object.entries(view.membership?.members ?? {}).map(([key, seat]) => {
    const profile = profileSchema.parse(data.get(PROFILE, key) ?? {})
    return {
      id: brand<string, 'MemberId'>(key),
      householdId: brand<string, 'HouseholdId'>(view.household),
      displayName: profile.name,
      colour: profile.colour,
      role: seat.role,
    }
  })

/** The first palette colour nobody on the board has, so Members look different. */
export const nextColour = (taken: readonly string[]): string =>
  memberColours.find((c) => !taken.includes(c)) ??
  memberColours[taken.length % memberColours.length] ??
  memberColours[0]

const put = (data: Data, kind: string, id: string, fields: Doc) => data.put(kind, id, fields)

export const saveProfile = (
  data: Data,
  member: string,
  profile: { readonly name: string; readonly colour: string },
): Promise<void> =>
  put(data, PROFILE, member, {
    name: profile.name.trim().slice(0, MAX_MEMBER_NAME),
    colour: profile.colour,
  })

export const saveSettings = (
  data: Data,
  fields: {
    readonly name?: string
    readonly locale?: Locale
    readonly size?: HouseholdSize
    readonly slots?: readonly Slot[]
  },
): Promise<void> => {
  const doc: Record<string, FieldValue> = {}
  if (fields.name !== undefined) doc.name = fields.name.trim().slice(0, MAX_BOARD_NAME)
  if (fields.locale !== undefined) doc.locale = fields.locale
  if (fields.size !== undefined) doc.size = fields.size
  if (fields.slots !== undefined) {
    doc.slots = fields.slots.map((s) => ({
      key: s.key,
      labelKey: s.labelKey,
      ...(s.label === undefined ? {} : { label: s.label }),
    }))
  }
  return put(data, KIND, ID, doc)
}
