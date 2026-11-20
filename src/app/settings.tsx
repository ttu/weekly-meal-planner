import { useState } from 'react'
import { Share } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Redirect, router } from 'expo-router'
import { isErr, isOk, ok, type Result } from '@/shared/types/result'
import { DEFAULT_LOCALE } from '@/shared/i18n'
import {
  SettingsScreen,
  DEFAULT_SIZE,
  addNamedSlot,
  addPresetSlot,
  moveSlot,
  removeSlot,
  readMembers,
  recoveryLink,
  saveSettings,
  useBoardSession,
  type Slot,
  type SlotEditError,
  type SlotKey,
} from '@/features/household'
import { useData, useSync, useView } from '@/features/sync'

export default function Settings(): React.JSX.Element {
  const { household, checked: householdChecked, userId } = useBoardSession()
  const { engine } = useSync()
  const view = useView()
  const data = useData()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<SlotEditError | 'write-failed' | undefined>(undefined)
  const [recoveryCopied, setRecoveryCopied] = useState(false)

  if (householdChecked && household === undefined) return <Redirect href="/" />

  const members = view && data ? readMembers(view, data) : []
  const isAdmin = view?.role === 'admin'

  /** Settings are rows of the board: written here at once, sent when there is a connection. */
  const write = (fields: Parameters<typeof saveSettings>[1]): void => {
    if (!data) return
    setError(undefined)
    setPending(true)
    void saveSettings(data, fields)
      .catch(() => {
        setError('write-failed')
      })
      .finally(() => {
        setPending(false)
      })
  }

  /** Every Slot edit is "work out the new list, then write the whole list": the
   *  Slots are one ordered value, not rows. */
  const apply = (edit: Result<readonly Slot[], SlotEditError>): void => {
    if (isErr(edit)) {
      setError(edit.error)
      return
    }
    write({ slots: edit.value })
  }

  /** A removal or role change is an admin's signed act; the relay may refuse it. */
  const admin = (act: Promise<Result<void, unknown>> | undefined): void => {
    setError(undefined)
    void act?.then((result) => {
      if (!isOk(result)) setError('write-failed')
    })
  }

  const slots = household?.slots ?? []

  // Copy on web, the OS share sheet on a phone: there it goes into a password manager or Notes.
  const saveRecoveryLink = (): void => {
    const link =
      engine &&
      recoveryLink(
        engine,
        process.env.EXPO_OS === 'web' ? window.location.origin : 'https://menami.app',
      )
    if (link === undefined) return
    if (process.env.EXPO_OS !== 'web') {
      void Share.share({ message: link })
      return
    }
    void Clipboard.setStringAsync(link).then(() => {
      setRecoveryCopied(true)
      setTimeout(() => {
        setRecoveryCopied(false)
      }, 2000)
    })
  }

  return (
    <SettingsScreen
      locale={household?.locale ?? DEFAULT_LOCALE}
      onChangeLocale={(next) => {
        write({ locale: next })
      }}
      size={household?.size ?? DEFAULT_SIZE}
      onChangeSize={(next) => {
        write({ size: next })
      }}
      members={members}
      me={userId}
      isAdmin={isAdmin}
      onSetRole={(member, role) => {
        admin(engine?.setRole(member, role))
      }}
      onRemoveMember={(member) => {
        admin(engine?.removeMember(member))
      }}
      slots={slots}
      isPending={isPending}
      error={error}
      onBack={() => {
        router.back()
      }}
      onSaveRecoveryLink={saveRecoveryLink}
      recoveryCopied={recoveryCopied}
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
