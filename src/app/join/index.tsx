import { useState } from 'react'
import { router } from 'expo-router'
import { createLogger } from '@/shared/logger/logger'
import { isErr } from '@/shared/types/result'
import {
  JoinBoardScreen,
  ReplaceBoardSheet,
  joinFromLink,
  type JoinFailure,
} from '@/features/household'
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

type JoinInput = { link: string; displayName: string }

export default function Join(): React.JSX.Element {
  const { deps, engine, adopt } = useSync()
  const [logger] = useState(() => createLogger('join'))
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<JoinFailure | 'not-saved' | undefined>(undefined)
  const [initialLink] = useState(takeLinkFromAddress)
  // Held while the Member is asked whether the open board may be replaced.
  const [held, setHeld] = useState<JoinInput | undefined>(undefined)

  const join = async ({ link, displayName }: JoinInput): Promise<void> => {
    setPending(true)
    setError(undefined)
    const result = await joinFromLink(deps, link, displayName).catch((cause: unknown) => {
      logger.log('error', 'join.failed', { cause: String(cause) })
      return undefined
    })
    if (result === undefined || isErr(result)) {
      setPending(false)
      setError(result?.error ?? 'rejected')
      return
    }
    try {
      await adopt(result.value.engine, result.value.identity)
    } catch (cause) {
      logger.log('error', 'join.not-saved', { cause: String(cause) })
      setPending(false)
      setError('not-saved')
      return
    }
    setPending(false)
    router.replace('/')
  }

  return (
    <>
      <JoinBoardScreen
        isPending={isPending}
        error={error}
        initialLink={initialLink}
        onStartOwn={() => {
          router.replace('/start')
        }}
        onJoin={(input) => {
          if (engine) setHeld(input)
          else void join(input)
        }}
      />
      <ReplaceBoardSheet
        visible={held !== undefined}
        onConfirm={() => {
          setHeld(undefined)
          if (held) void join(held)
        }}
        onCancel={() => {
          setHeld(undefined)
        }}
      />
    </>
  )
}
