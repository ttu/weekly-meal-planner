import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from '@/shared/motion'

/**
 * Which days another Member has just changed. The design asks for a two-second
 * sage edge and nothing else: no toast, no scroll jump — a change someone else
 * made must never move the card under your thumb.
 */
export const useRecentlyChangedDays = (): {
  changedDays: ReadonlySet<string>
  markChanged: (date: string) => void
} => {
  const [changedDays, setChangedDays] = useState<ReadonlySet<string>>(new Set())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const markChanged = useCallback((date: string) => {
    setChangedDays((current) => new Set(current).add(date))

    const existing = timers.current.get(date)
    if (existing !== undefined) clearTimeout(existing)

    timers.current.set(
      date,
      setTimeout(() => {
        setChangedDays((current) => {
          const next = new Set(current)
          next.delete(date)
          return next
        })
        timers.current.delete(date)
      }, motion.duration.linger),
    )
  }, [])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  return { changedDays, markChanged }
}
