import { useRef } from 'react'
import { Platform, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { motion } from '@/shared/motion'
import { useDrag, type DragPayload, type DropTarget } from './DragContext'

type Props = {
  readonly payload: DragPayload
  readonly onDropped?: ((payload: DragPayload, target: DropTarget) => void) | undefined
  readonly onTap?: (() => void) | undefined
  readonly accessibilityLabel: string
  readonly testID?: string | undefined
  readonly children: React.ReactNode
}

/**
 * A card you can either tap or carry across the whole board.
 *
 * The card in your hand is drawn by DragLayer, not here: this one stays put and
 * fades to a placeholder. An earlier version translated the card itself, which
 * meant it vanished the moment it left the Backlog shelf — a scrolling strip
 * clips its children, and no amount of zIndex changes that.
 *
 * Tap and drag both, never one or the other: dragging is the accelerator and
 * tapping is the path that works on every screen and with a screen reader.
 */
export const DraggableCard = ({
  payload,
  onDropped,
  onTap,
  accessibilityLabel,
  testID,
  children,
}: Props): React.JSX.Element => {
  const { dragging, pointer, begin, moveTo, end } = useDrag()
  const ref = useRef<View>(null)

  const isMe =
    dragging !== undefined &&
    (dragging.kind === 'backlog' && payload.kind === 'backlog'
      ? dragging.item.id === payload.item.id
      : dragging.kind === 'cook-event' &&
        payload.kind === 'cook-event' &&
        dragging.cookEvent.id === payload.cookEvent.id)

  /** Measured here rather than in the provider: only this card knows where it
   *  is, and the grab offset is what keeps the card under the finger. */
  const start = (): void => {
    ref.current?.measureInWindow((x, y, width, height) => {
      begin(payload, { x, y, width, height })
    })
  }

  const finish = (): void => {
    const target = end()
    if (target !== undefined) onDropped?.(payload, target)
  }

  const pan = Gesture.Pan()
    .activateAfterLongPress(Platform.OS === 'web' ? 0 : 180)
    .minDistance(Platform.OS === 'web' ? 6 : 0)
    .onBegin((event) => {
      pointer.x.value = event.absoluteX
      pointer.y.value = event.absoluteY
    })
    .onStart(() => {
      scheduleOnRN(start)
    })
    .onUpdate((event) => {
      pointer.x.value = event.absoluteX
      pointer.y.value = event.absoluteY
      scheduleOnRN(moveTo, event.absoluteX, event.absoluteY)
    })
    .onFinalize(() => {
      scheduleOnRN(finish)
    })

  const tap = Gesture.Tap().onEnd(() => {
    if (onTap !== undefined) scheduleOnRN(onTap)
  })

  const gesture = Gesture.Exclusive(pan, tap)

  const placeholder = useAnimatedStyle(() => ({
    opacity: withTiming(isMe ? 0.35 : 1, { duration: motion.duration.instant }),
  }))

  // The measuring ref sits on a wrapper, not on the gesture's own child:
  // GestureDetector attaches its ref to that child, and the second ref loses.
  // A null ref here means the drag silently never begins.
  return (
    <View ref={ref} collapsable={false}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={placeholder}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          testID={testID}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
