import type { ReactNode } from 'react'
import { Pressable, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { motion, useReducedMotion } from './index'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

type Props = {
  readonly children: ReactNode
  readonly onPress?: (() => void) | undefined
  readonly style?: StyleProp<ViewStyle> | undefined
  readonly accessibilityLabel: string
  readonly testID?: string | undefined
  readonly disabled?: boolean | undefined
}

/**
 * A press that answers. Touch targets in this app are often the whole row, and
 * without feedback a tap on a large surface feels like nothing happened —
 * especially on a shared board where the result may be a card moving elsewhere.
 */
export const PressableScale = ({
  children,
  onPress,
  style,
  accessibilityLabel,
  testID,
  disabled,
}: Props): React.JSX.Element => {
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const to = (value: number): void => {
    if (reduced) return
    scale.value = withTiming(value, {
      duration: motion.duration.instant,
      easing: motion.easing.standard,
    })
  }

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPress={onPress}
      onPressIn={() => {
        to(0.97)
      }}
      onPressOut={() => {
        to(1)
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </AnimatedPressable>
  )
}
