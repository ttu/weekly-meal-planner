import { useState } from 'react'
import { Platform } from 'react-native'
import { Redirect, router } from 'expo-router'
import { isErr, isOk, ok, type Result } from '@/shared/types/result'
import { DEFAULT_LOCALE } from '@/shared/i18n'
import {
  SettingsScreen,
  addEmail,
  saveLocale,
  addNamedSlot,
  addPresetSlot,
  moveSlot,
  removeSlot,
  saveSlots,
  useRefreshHousehold,
  useSession,
  type Slot,
  type AddEmailError,
  type SlotEditError,
  type SlotKey,
} from '@/features/household'

/** Where the link in the inbox lands. Back on Settings, which is where the
 *  person was standing when they asked for it. */
const redirectTo = (): string =>
  Platform.OS === 'web' ? `${window.location.origin}/settings` : 'mealplanner://settings'

export default function Settings(): React.JSX.Element {
  const { client, household, householdChecked, email, pendingEmail } = useSession()
  const refreshHousehold = useRefreshHousehold()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<SlotEditError | 'write-failed' | undefined>(undefined)
  const [emailPending, setEmailPending] = useState(false)
  const [emailError, setEmailError] = useState<AddEmailError | undefined>(undefined)
  const [sentTo, setSentTo] = useState<string | undefined>(undefined)

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
      locale={household?.locale ?? DEFAULT_LOCALE}
      onChangeLocale={(next) => {
        if (household === undefined) return
        setPending(true)
        setError(undefined)
        void saveLocale(client, household.id, next).then((written) => {
          setPending(false)
          if (!isOk(written)) {
            setError('write-failed')
            return
          }
          refreshHousehold()
        })
      }}
      account={{
        ...(email === undefined ? {} : { email }),
        ...((pendingEmail ?? sentTo) === undefined ? {} : { pendingEmail: pendingEmail ?? sentTo }),
        isPending: emailPending,
        ...(emailError === undefined ? {} : { error: emailError }),
        onAddEmail: (next) => {
          setEmailPending(true)
          setEmailError(undefined)
          void addEmail(client, next, redirectTo()).then((result) => {
            setEmailPending(false)
            if (isErr(result)) {
              setEmailError(result.error)
              return
            }
            setSentTo(next.trim())
          })
        },
      }}
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
