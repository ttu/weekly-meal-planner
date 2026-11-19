import { isErr, ok, err, type Result } from '@/shared/types/result'
import type { Locale } from '@/shared/i18n'
import {
  createHousehold,
  dataOf,
  joinHousehold,
  type Engine,
  type Identity,
  type JoinError,
  type RelayError,
  type SyncDeps,
} from '@/features/sync'
import type { InviteSeat } from '../domain/invite-link'
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
  await saveProfile(dataOf(engine), engine.view().me, {
    name: displayName,
    colour: colourFor(engine),
  })
  await engine.sync()
  return ok(engine)
}
