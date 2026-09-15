import { Platform } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
// The gesture runs on the UI thread; these hop back to JS, where the drag state
// and the mutation live.
import { scheduleOnRN } from 'react-native-worklets'
import { motion, useReducedMotion } from '@/shared/motion'
import { MealCard } from '@/features/meals'
import { useDrag, type DropTarget } from './DragContext'
import type { BacklogItem } from '../domain/types'

type Props = {
  readonly item: BacklogItem
  readonly onDropped?: ((item: BacklogItem, target: DropTarget) => void) | undefined
  readonly onTap: (item: BacklogItem) => void
}

/**
 * A Backlog card you can either tap or carry onto a day and Slot.
 *
 * Both, not one or the other: an earlier version swapped the tappable card for
 * a draggable one on wide screens, which quietly removed tap-to-plan for
 * anyone on a laptop.
 */
export const DraggableBacklogCard = ({ item, onDropped, onTap }: Props): React.JSX.Element => {
  const { begin, moveTo, end } = useDrag()
  const reduced = useReducedMotion()

  const offsetX = useSharedValue(0)
  const offsetY = useSharedValue(0)
  const scale = useSharedValue(1)

  const settle = (): void => {
    const duration = reduced ? 0 : motion.duration.settle
    offsetX.value = withTiming(0, { duration, easing: motion.easing.enter })
    offsetY.value = withTiming(0, { duration, easing: motion.easing.enter })
    scale.value = withTiming(1, { duration, easing: motion.easing.enter })
  }

  const onEnd = (): void => {
    const target = end()
    if (target !== undefined) onDropped?.(item, target)
    settle()
  }

  const pan = Gesture.Pan()
    // On a pointer, waiting out a hold before the card moves feels broken. On
    // touch the hold is what stops a drag stealing the shelf's own scroll.
    .manualActivation(false)
    .activateAfterLongPress(Platform.OS === 'web' ? 0 : 180)
    .minDistance(Platform.OS === 'web' ? 6 : 0)
    .onStart(() => {
      scale.value = withTiming(1.04, { duration: motion.duration.instant })
      scheduleOnRN(begin, item)
    })
    .onUpdate((event) => {
      offsetX.value = event.translationX
      offsetY.value = event.translationY
      scheduleOnRN(moveTo, event.absoluteX, event.absoluteY)
    })
    .onFinalize(() => {
      scheduleOnRN(onEnd)
    })

  const tap = Gesture.Tap().onEnd(() => {
    scheduleOnRN(onTap, item)
  })

  // Pan wins once it activates; until then a clean press is a tap.
  const gesture = Gesture.Exclusive(pan, tap)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
    zIndex: offsetX.value === 0 && offsetY.value === 0 ? 0 : 10,
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={animatedStyle}
        accessibilityRole="button"
        accessibilityLabel={item.mealName}
        testID={`backlog-item-${item.id}`}
      >
        <MealCard
          variant="backlog"
          name={item.mealName}
          addedBy={item.addedByName}
          addedByColour={item.addedByColour}
        />
      </Animated.View>
    </GestureDetector>
  )
}
