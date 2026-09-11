import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { isErr } from '@/shared/types/result'
import {
  JoinBoardScreen,
  joinBoard,
  useRefreshHousehold,
  useSession,
  type JoinBoardError,
} from '@/features/household'

export default function Join(): React.JSX.Element {
  const params = useLocalSearchParams<{ token: string }>()
  const { client } = useSession()
  const refreshHousehold = useRefreshHousehold()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<JoinBoardError | undefined>(undefined)

  return (
    <JoinBoardScreen
      isPending={isPending}
      error={error}
      onJoin={(password) => {
        setPending(true)
        setError(undefined)
        void joinBoard(client, params.token, password).then((result) => {
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
