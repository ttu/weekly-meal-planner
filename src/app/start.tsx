import { useState } from 'react'
import { router } from 'expo-router'
import { isErr } from '@/shared/types/result'
import { useTranslation } from '@/shared/i18n'
import { StartBoardScreen, startBoard } from '@/features/household'
import { useSync } from '@/features/sync'

export default function Start(): React.JSX.Element {
  const { deps, identity, adopt } = useSync()
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
        if (identity === undefined) return
        setPending(true)
        setFailed(false)
        void startBoard(deps, identity, {
          boardName,
          displayName,
          locale: i18n.language === 'fi' ? 'fi' : 'en',
        }).then(async (result) => {
          if (isErr(result)) {
            setPending(false)
            setFailed(true)
            return
          }
          await adopt(result.value, identity)
          setPending(false)
          router.replace('/')
        })
      }}
    />
  )
}
