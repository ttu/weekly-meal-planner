import { useState } from 'react'
import { router } from 'expo-router'
import { isErr } from '@/shared/types/result'
import { useTranslation } from '@/shared/i18n'
import { memberColours } from '@/shared/theme/tokens'
import {
  StartBoardScreen,
  createBoard,
  useRefreshHousehold,
  useSession,
  type CreateBoardError,
} from '@/features/household'

export default function Start(): React.JSX.Element {
  const { client } = useSession()
  const refreshHousehold = useRefreshHousehold()
  const { i18n } = useTranslation()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<CreateBoardError | undefined>(undefined)

  return (
    <StartBoardScreen
      isPending={isPending}
      error={error}
      onSignInInstead={() => {
        router.push('/sign-in')
      }}
      onCreate={({ boardName, displayName, password }) => {
        setPending(true)
        setError(undefined)
        void createBoard(client, {
          boardName,
          displayName,
          colour: memberColours[0],
          locale: i18n.language === 'fi' ? 'fi' : 'en',
          password,
        }).then((result) => {
          setPending(false)
          if (isErr(result)) {
            setError(result.error)
            return
          }
          refreshHousehold()
          router.replace('/')
        })
      }}
    />
  )
}
