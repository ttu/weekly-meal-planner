import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'
import { Easing } from 'react-native-reanimated'

/**
 * Durations and easing for the whole app, so motion reads as one system rather
 * than as per-screen decisions.
 *
 * Short and unshowy on purpose: this motion exists to say what changed on a
 * board several people are editing, not to be noticed.
 */
export const motion = {
  duration: { instant: 120, quick: 180, settle: 260, linger: 2000 },
  easing: {
    /** Decelerating: things arriving. */
    enter: Easing.out(Easing.cubic),
    /** Accelerating: things leaving. */
    exit: Easing.in(Easing.cubic),
    standard: Easing.inOut(Easing.quad),
  },
} as const

/**
 * Honoured by every animation in the app. A family member with vestibular
 * sensitivity uses this in a kitchen; motion is never the only signal that
 * something changed.
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduced(enabled)
    })

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)

    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  return reduced
}

/** Duration for a given animation, collapsed to nothing when the Member has
 *  asked for reduced motion. */
export const durationFor = (reduced: boolean, duration: number): number => (reduced ? 0 : duration)
