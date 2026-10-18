import { useEffect, useState } from 'react'
import { useNetworkSource } from './NetworkSourceContext'

/**
 * Whether the device thinks it can reach the network.
 *
 * Used to say so out loud, not to block anything: writes are optimistic and
 * queue either way, but a list that quietly stops agreeing with the server is
 * a list nobody trusts in a shop.
 *
 * Starts true until the platform has answered: a wrong "offline" is worse
 * than no banner at all.
 */
export const useIsOnline = (): boolean => {
  const source = useNetworkSource()
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let live = true
    void source.read().then((now) => {
      if (live) setOnline(now)
    })
    const stop = source.subscribe((now) => {
      setOnline(now)
    })

    return () => {
      live = false
      stop()
    }
  }, [source])

  return online
}
