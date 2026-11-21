import { isErr, ok, err, type Result } from '@/shared/types/result'
import type { Locale } from '@/shared/i18n'
import {
  createHousehold,
  dataOf,
  identityFromInvite,
  joinHousehold,
  type Engine,
  type Identity,
  type JoinError,
  type RelayError,
  type SyncDeps,
} from '@/features/sync'
import { inviteLink, parseInviteLink, type InviteSeat } from '../domain/invite-link'
import { nextColour, readMembers, saveProfile, saveSettings } from './board-data'

const colourFor = (engine: Engine): string => {
  const data = dataOf(engine)
  return nextColour(readMembers(engine.view(), data).map((m) => m.colour))
}

/** Start a board: this device becomes its first admin, named and coloured. */
export const startBoard = async (
  deps: SyncDeps,
  me: Identity,
  input: { readonly boardName: string; readonly displayName: string; readonly locale: Locale },
): Promise<Result<Engine, RelayError>> => {
  const created = await createHousehold(deps, me)
  if (isErr(created)) return created
  const engine = created.value
  const data = dataOf(engine)
  await saveSettings(data, { name: input.boardName, locale: input.locale })
  await saveProfile(data, engine.view().me, {
    name: input.displayName,
    colour: colourFor(engine),
  })
  // Sent now so the others see the name soon; offline, the loop sends it later.
  await engine.sync()
  return ok(engine)
}

/** Take the seat an invite holds, then say who is sitting in it. */
export const joinBoard = async (
  deps: SyncDeps,
  seat: InviteSeat,
  displayName: string,
): Promise<Result<Engine, JoinError>> => {
  const joined = await joinHousehold(deps, seat)
  if (isErr(joined)) return err(joined.error)
  const engine = joined.value
  const me = engine.view().me
  // A recovery link is a seat someone already sits in: they keep their name and colour.
  const restoring = readMembers(engine.view(), dataOf(engine)).some(
    (m) => m.id === me && m.displayName !== '',
  )
  // A blank name is not written: the Member shows as unnamed until they give one.
  if (!restoring && displayName.trim() !== '')
    await saveProfile(dataOf(engine), me, { name: displayName, colour: colourFor(engine) })
  await engine.sync()
  return ok(engine)
}

/** What a person can be told when joining does not work. */
export type JoinFailure = 'bad-link' | 'offline' | 'rejected'

/** Join from whatever was pasted. The seat is read first, so a bad paste costs no network. */
export const joinFromLink = async (
  deps: SyncDeps,
  pasted: string,
  displayName: string,
): Promise<Result<{ readonly engine: Engine; readonly identity: Identity }, JoinFailure>> => {
  const seat = parseInviteLink(pasted)
  if (!seat) return err('bad-link')
  const joined = await joinBoard(deps, seat, displayName)
  if (isErr(joined)) return err(joined.error === 'offline' ? 'offline' : 'rejected')
  return ok({ engine: joined.value, identity: identityFromInvite(seat) })
}

/** A link for a new seat on the open board. Only an admin can make one. */
export const createInviteLink = async (
  engine: Engine,
  origin: string,
  role: 'admin' | 'member' = 'member',
): Promise<Result<string, 'failed'>> => {
  const made = await engine.invite(role)
  return isErr(made) ? err('failed') : ok(inviteLink(origin, made.value))
}

/**
 * This device's own seat as a link, to keep somewhere safe and open on a new
 * device. Whoever holds it is this Member until an admin removes them.
 */
export const recoveryLink = (engine: Engine, origin: string): string | undefined => {
  const seat = engine.ownSeat()
  return seat && inviteLink(origin, seat)
}
