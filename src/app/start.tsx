import { useState } from 'react'
import { router } from 'expo-router'
import { isErr } from '@/shared/types/result'
import { useTranslation } from '@/shared/i18n'
import { StartBoardScreen, startBoard } from '@/features/household'
import { loadIdentity, useSync } from '@/features/sync'

export default function Start(): React.JSX.Element {
  const { deps, adopt } = useSync()
  const { i18n } = useTranslation()
  const [isPending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <StartBoardScreen
      isPending={isPending}
      failed={failed}
      onJoinInstead={() => {
        router.push('/join')
      }}
      onCreate={({ boardName, displayName }) => {
        setPending(true)
        setFailed(false)
        // Always the device's own keys, never a joined seat's: the person who made
        // that invite knows those secrets.
        void loadIdentity(deps.vault, deps.random)
          .then(async (me) => {
            const result = await startBoard(deps, me, {
              boardName,
              displayName,
              locale: i18n.language === 'fi' ? 'fi' : 'en',
            })
            if (isErr(result)) {
              setPending(false)
              setFailed(true)
              return
            }
            await adopt(result.value, me)
            setPending(false)
            router.replace('/')
          })
          .catch(() => {
            setPending(false)
            setFailed(true)
          })
      }}
    />
  )
}
