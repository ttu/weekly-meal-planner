export type {
  Household,
  HouseholdId,
  HouseholdSize,
  Member,
  MemberId,
  Slot,
  SlotKey,
} from './domain/types'
export { parseSlots, type ParseSlotsError } from './domain/slot'
export {
  MAX_SLOTS,
  SLOT_PRESETS,
  addNamedSlot,
  addPresetSlot,
  moveSlot,
  removeSlot,
  slotName,
  type SlotEditError,
} from './domain/slot-edit'
export { DEFAULT_SIZE, MAX_SIZE, MIN_SIZE, stepSize } from './domain/size'
export { createSupabaseClient, type AppSupabaseClient } from './infrastructure/supabase-client'
export { SessionProvider, useSession } from './ui/SessionProvider'
export { NoHouseholdScreen } from './ui/NoHouseholdScreen'
export { ShareSheet } from './ui/ShareSheet'
export { StartBoardScreen } from './ui/StartBoardScreen'
export { SettingsScreen } from './ui/SettingsScreen'
export { JoinBoardScreen } from './ui/JoinBoardScreen'
export { BoardMenu } from './ui/BoardMenu'
export { inviteLink, parseInviteLink, type InviteSeat } from './domain/invite-link'
export {
  readMembers,
  readSettings,
  saveProfile,
  saveSettings,
  type BoardMember,
  type BoardSettings,
} from './application/board-data'
export { joinBoard as joinBoardWithInvite, startBoard } from './application/board-flow'
export { MembersSection } from './ui/MembersSection'
export { useBoardSession, type BoardSession } from './ui/useBoardSession'
export { createInviteLink, joinFromLink, type JoinFailure } from './application/board-flow'
