import type { ReactNode } from 'react'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import { motion, useReducedMotion } from './index'

type Props = {
  readonly children: ReactNode
  readonly testID?: string | undefined
}

/**
 * Wraps a card so it settles in and out rather than appearing and vanishing.
 *
 * The board is a shared surface: another Member's edit arrives without warning,
 * and a card that simply blinks into existence reads as a glitch. The motion is
 * short and does not move neighbours further than the card's own height.
 */
export const AnimatedCard = ({ children, testID }: Props): React.JSX.Element => {
  const reduced = useReducedMotion()

  if (reduced) {
    return <Animated.View testID={testID}>{children}</Animated.View>
  }

  return (
    <Animated.View
      testID={testID}
      entering={FadeIn.duration(motion.duration.settle).easing(motion.easing.enter)}
      exiting={FadeOut.duration(motion.duration.quick).easing(motion.easing.exit)}
      layout={LinearTransition.duration(motion.duration.settle).easing(motion.easing.standard)}
    >
      {children}
    </Animated.View>
  )
}
