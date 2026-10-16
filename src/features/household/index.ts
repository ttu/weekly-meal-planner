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
export {
  loadHousehold,
  loadMember,
  saveLocale,
  saveSize,
  saveSlots,
  type LoadHouseholdError,
  type LoadMemberError,
  type SaveSlotsError,
} from './infrastructure/household-repository'
export { SessionProvider, useSession } from './ui/SessionProvider'
export { signIn, signOut, type SignInError } from './application/sign-in'
export { addEmail, type AddEmailError } from './application/add-email'
export { isPlausibleEmail } from './domain/email'
export { useAuthSession, type AuthSession } from './ui/useAuthSession'
export { SignInScreen } from './ui/SignInScreen'
export { NoHouseholdScreen } from './ui/NoHouseholdScreen'
export { usePresence, type PresentMember } from './ui/usePresence'
export {
  createBoard,
  joinBoard,
  boardPreview,
  boardUrl,
  type BoardPreview,
  type CreateBoardError,
  type JoinBoardError,
  type NewBoard,
} from './application/boards'
export { ShareSheet } from './ui/ShareSheet'
export { StartBoardScreen } from './ui/StartBoardScreen'
export { EnterInviteScreen } from './ui/EnterInviteScreen'
export { SettingsScreen } from './ui/SettingsScreen'
export { inviteToken } from './domain/invite'
export { JoinBoardScreen } from './ui/JoinBoardScreen'
export { useBetaKeyRequired } from './ui/useBetaKeyRequired'
export {
  useHouseholdSession,
  useRefreshHousehold,
  type HouseholdSession,
} from './ui/useHouseholdSession'
export { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from './domain/demo-accounts'
export { BoardMenu } from './ui/BoardMenu'
