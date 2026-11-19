import { useState } from 'react'
import { router } from 'expo-router'
import { isErr } from '@/shared/types/result'
import { JoinBoardScreen, joinFromLink, type JoinFailure } from '@/features/household'
import { useSync } from '@/features/sync'

/**
 * An opened invite link keeps its seat in the fragment, which only the browser
 * sees. It is read once and then taken out of the address bar, so it does not
 * stay in history or get copied along with the page.
 */
const takeLinkFromAddress = (): string => {
  if (process.env.EXPO_OS !== 'web') return ''
  const link = window.location.hash.slice(1)
  if (link !== '') window.history.replaceState(null, '', window.location.pathname)
  return link
}

export default function Join(): React.JSX.Element {
  const { deps, adopt } = useSync()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<JoinFailure | undefined>(undefined)
  const [initialLink] = useState(takeLinkFromAddress)

  return (
    <JoinBoardScreen
      isPending={isPending}
      error={error}
      initialLink={initialLink}
      onStartOwn={() => {
        router.replace('/start')
      }}
      onJoin={({ link, displayName }) => {
        setPending(true)
        setError(undefined)
        void joinFromLink(deps, link, displayName).then(async (result) => {
          if (isErr(result)) {
            setPending(false)
            setError(result.error)
            return
          }
          await adopt(result.value.engine, result.value.identity)
          setPending(false)
          router.replace('/')
        })
      }}
    />
  )
}
