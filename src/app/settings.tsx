import { useState } from 'react'
import { Redirect, router } from 'expo-router'
import { isErr, isOk, ok, type Result } from '@/shared/types/result'
import {
  SettingsScreen,
  addNamedSlot,
  addPresetSlot,
  moveSlot,
  removeSlot,
  saveSlots,
  useRefreshHousehold,
  useSession,
  type Slot,
  type SlotEditError,
  type SlotKey,
} from '@/features/household'

export default function Settings(): React.JSX.Element {
  const { client, household, householdChecked } = useSession()
  const refreshHousehold = useRefreshHousehold()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<SlotEditError | 'write-failed' | undefined>(undefined)

  if (householdChecked && household === undefined) return <Redirect href="/" />

  /** Every edit is "work out the new list, then write the whole list": the
   *  Slots are one ordered value, not rows. */
  const apply = (edit: Result<readonly Slot[], SlotEditError>): void => {
    setError(undefined)
    if (isErr(edit)) {
      setError(edit.error)
      return
    }
    if (household === undefined) return

    setPending(true)
    void saveSlots(client, household.id, edit.value).then((written) => {
      setPending(false)
      if (!isOk(written)) {
        setError('write-failed')
        return
      }
      refreshHousehold()
    })
  }

  const slots = household?.slots ?? []

  return (
    <SettingsScreen
      slots={slots}
      isPending={isPending}
      error={error}
      onBack={() => {
        router.back()
      }}
      onAddPreset={(preset) => {
        apply(addPresetSlot(slots, preset))
      }}
      onAddNamed={(label) => {
        apply(addNamedSlot(slots, label))
      }}
      onRemove={(key: SlotKey) => {
        apply(removeSlot(slots, key))
      }}
      onMove={(key: SlotKey, by) => {
        apply(ok(moveSlot(slots, key, by)))
      }}
    />
  )
}
