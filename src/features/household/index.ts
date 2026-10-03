export type { Household, HouseholdId, Member, MemberId, Slot, SlotKey } from './domain/types'
export { parseSlots, type ParseSlotsError } from './domain/slot'
export { createSupabaseClient, type AppSupabaseClient } from './infrastructure/supabase-client'
export {
  loadHousehold,
  loadMember,
  type LoadHouseholdError,
  type LoadMemberError,
} from './infrastructure/household-repository'
export { SessionProvider, useSession } from './ui/SessionProvider'
export { signIn, signOut, type SignInError } from './application/sign-in'
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
export { StartBoardScreen } from './ui/StartBoardScreen'
export { JoinBoardScreen } from './ui/JoinBoardScreen'
export {
  useHouseholdSession,
  useRefreshHousehold,
  type HouseholdSession,
} from './ui/useHouseholdSession'
