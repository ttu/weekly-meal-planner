import { useEffect, useState } from 'react'

/**
 * Whether the device thinks it can reach the network.
 *
 * Used to say so out loud, not to block anything: writes are optimistic and
 * queue either way, but a list that quietly stops agreeing with the server is
 * a list nobody trusts in a shop.
 *
 * `navigator.onLine` is a web API; where it is missing the value stays true
 * and the banner never appears, which is the right default — a wrong
 * "offline" is worse than no banner at all.
 */
const readOnline = (): boolean =>
  typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean'
    ? true
    : navigator.onLine

export const useIsOnline = (): boolean => {
  // Read once at mount rather than assumed-true-then-corrected: a setState in
  // an effect is a second render before the first has been seen.
  const [online, setOnline] = useState(readOnline)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator.onLine !== 'boolean') return undefined

    const up = (): void => {
      setOnline(true)
    }
    const down = (): void => {
      setOnline(false)
    }
    window.addEventListener('online', up)
    window.addEventListener('offline', down)

    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return online
}
