import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
// The gesture runs on the UI thread; these hop back to JS, where the drag state
// and the mutation live. runOnJS is deprecated in Reanimated 4.
import { scheduleOnRN } from 'react-native-worklets'
import { motion, useReducedMotion } from '@/shared/motion'
import { MealCard } from '@/features/meals'
import { useDrag, type DropTarget } from './DragContext'
import type { BacklogItem } from '../domain/types'

const styles = StyleSheet.create({
  card: { width: 200 },
  lifted: { opacity: 0.95 },
})

type Props = {
  readonly item: BacklogItem
  readonly onDropped: (item: BacklogItem, target: DropTarget) => void
}

/**
 * A Backlog card that can be carried onto a day and Slot.
 *
 * Dragging is the wide-screen accelerator, never the only path: tapping the
 * same card still opens the plan sheet, which is what a phone uses.
 *
 * Let go anywhere that is not a Slot and the card returns rather than snapping,
 * so a mis-drag reads as "nothing happened" instead of "something broke".
 */
export const DraggableBacklogCard = ({ item, onDropped }: Props): React.JSX.Element => {
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
    if (target !== undefined) onDropped(item, target)
    settle()
  }

  const pan = Gesture.Pan()
    // A short hold before the card lifts, so scrolling the shelf does not start
    // a drag by accident.
    .activateAfterLongPress(180)
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
    zIndex: offsetX.value === 0 && offsetY.value === 0 ? 0 : 10,
  }))

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, animatedStyle]} testID={`draggable-${item.id}`}>
        <View style={styles.lifted}>
          <MealCard variant="backlog" name={item.mealName} addedBy={item.addedByName} />
        </View>
      </Animated.View>
    </GestureDetector>
  )
}
