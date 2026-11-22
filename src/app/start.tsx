import { useState } from 'react'
import { router } from 'expo-router'
import { createLogger } from '@/shared/logger/logger'
import { isErr } from '@/shared/types/result'
import { useTranslation } from '@/shared/i18n'
import { ReplaceBoardSheet, StartBoardScreen, startBoard } from '@/features/household'
import { loadIdentity, useSync } from '@/features/sync'
import { DemoBoardPanel } from '@/dev/DemoBoardPanel'
import { seedDemoBoard, type DemoLink } from '@/dev/demo-board'

type StartInput = { boardName: string; displayName: string }
/** What waits for the Member to agree that the open board may be replaced. */
type Held = StartInput | 'demo'

const origin = (): string =>
  process.env.EXPO_OS === 'web' ? window.location.origin : 'https://menami.app'

export default function Start(): React.JSX.Element {
  const { deps, engine, adopt } = useSync()
  const { i18n } = useTranslation()
  const [logger] = useState(() => createLogger('start'))
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<'failed' | 'not-saved' | undefined>(undefined)
  // Held while the Member is asked whether the open board may be replaced.
  const [held, setHeld] = useState<Held | undefined>(undefined)
  const [demo, setDemo] = useState<{
    pending: boolean
    failed: boolean
    links?: readonly DemoLink[]
  }>({
    pending: false,
    failed: false,
  })

  const seedDemo = async (): Promise<void> => {
    setDemo({ pending: true, failed: false })
    try {
      const me = await loadIdentity(deps.vault, deps.random)
      const locale = i18n.language === 'fi' ? 'fi' : 'en'
      const seeded = await seedDemoBoard(deps, me, origin(), locale)
      await adopt(seeded.engine, me)
      setDemo({ pending: false, failed: false, links: seeded.links })
    } catch (cause) {
      logger.log('error', 'dev.demo-failed', { cause: String(cause) })
      setDemo({ pending: false, failed: true })
    }
  }

  const create = async ({ boardName, displayName }: StartInput): Promise<void> => {
    setPending(true)
    setError(undefined)
    // Always the device's own keys, never a joined seat's: the person who made
    // that invite knows those secrets.
    const made = await loadIdentity(deps.vault, deps.random)
      .then(async (me) => {
        const result = await startBoard(deps, me, {
          boardName,
          displayName,
          locale: i18n.language === 'fi' ? 'fi' : 'en',
        })
        return isErr(result) ? undefined : { engine: result.value, me }
      })
      .catch((cause: unknown) => {
        logger.log('error', 'start.failed', { cause: String(cause) })
        return undefined
      })
    if (made === undefined) {
      setPending(false)
      setError('failed')
      return
    }
    try {
      await adopt(made.engine, made.me)
    } catch (cause) {
      logger.log('error', 'start.not-saved', { cause: String(cause) })
      setPending(false)
      setError('not-saved')
      return
    }
    setPending(false)
    router.replace('/')
  }

  return (
    <>
      <StartBoardScreen
        isPending={isPending}
        error={error}
        onJoinInstead={() => {
          router.push('/join')
        }}
        onCreate={(input) => {
          if (engine) setHeld(input)
          else void create(input)
        }}
      >
        {__DEV__ && (
          <DemoBoardPanel
            isPending={demo.pending}
            failed={demo.failed}
            links={demo.links}
            onSeed={() => {
              if (engine) setHeld('demo')
              else void seedDemo()
            }}
            onOpenBoard={() => {
              router.replace('/')
            }}
          />
        )}
      </StartBoardScreen>
      <ReplaceBoardSheet
        visible={held !== undefined}
        onConfirm={() => {
          setHeld(undefined)
          if (held === 'demo') void seedDemo()
          else if (held) void create(held)
        }}
        onCancel={() => {
          setHeld(undefined)
        }}
      />
    </>
  )
}
