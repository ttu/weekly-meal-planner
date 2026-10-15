import { useEffect, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { isErr } from '@/shared/types/result'
import {
  JoinBoardScreen,
  boardPreview,
  joinBoard,
  useBetaKeyRequired,
  useRefreshHousehold,
  useSession,
  type BoardPreview,
  type JoinBoardError,
} from '@/features/household'

export default function Join(): React.JSX.Element {
  const params = useLocalSearchParams<{ token: string }>()
  const { client } = useSession()
  const refreshHousehold = useRefreshHousehold()
  const askBetaKey = useBetaKeyRequired()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<JoinBoardError | undefined>(undefined)
  const [preview, setPreview] = useState<BoardPreview | undefined>(undefined)

  // Whose board this is, so the screen can name it and the people on it.
  useEffect(() => {
    let current = true
    void boardPreview(client, params.token).then((found) => {
      if (current) setPreview(found)
    })
    return () => {
      current = false
    }
  }, [client, params.token])

  return (
    <JoinBoardScreen
      isPending={isPending}
      error={error}
      preview={preview}
      askBetaKey={askBetaKey}
      onStartOwn={() => {
        router.replace('/start')
      }}
      onJoin={({ password, displayName, betaKey }) => {
        setPending(true)
        setError(undefined)
        void joinBoard(client, params.token, password, displayName, betaKey).then((result) => {
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
