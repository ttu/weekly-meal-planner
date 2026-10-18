import { useEffect, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { durationFor, motion, useReducedMotion } from '@/shared/motion'
import { themed, useThemed } from '@/shared/theme/theme'
import { shouldDismiss } from './sheetDismiss'

const sheets = themed((tokens) =>
  StyleSheet.create({
    /** Gesture Handler needs its own root inside a Modal: on Android a Modal is
     *  a separate window, out of reach of the root in the app layout. */
    root: { flex: 1, backgroundColor: tokens.color.scrim, justifyContent: 'flex-end' },
    dismissArea: { flex: 1 },
    sheet: {
      backgroundColor: tokens.color.surface,
      borderTopLeftRadius: tokens.radius.sheet,
      borderTopRightRadius: tokens.radius.sheet,
      width: '100%',
      maxWidth: tokens.layout.readable,
      alignSelf: 'center',
    },
    /** A grip is 4pt tall; the hit area around it is what a thumb can find. */
    handleZone: {
      alignItems: 'center',
      paddingTop: tokens.space.md,
      paddingBottom: tokens.space.sm,
    },
    grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.color.dashed },
  }),
)

type Props = {
  readonly visible: boolean
  readonly onDismiss: () => void
  /** What the backdrop and the grab handle say to a screen reader. */
  readonly dismissLabel: string
  /** Padding and gap for what is inside; the surface itself is the Sheet's. */
  readonly contentStyle?: StyleProp<ViewStyle> | undefined
  readonly testID?: string | undefined
  readonly children: ReactNode
}

const GrabHandle = ({
  onPress,
  label,
  testID,
}: {
  readonly onPress: () => void
  readonly label: string
  readonly testID: string | undefined
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  return (
    <Pressable
      style={styles.handleZone}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={styles.grip} />
    </Pressable>
  )
}

/**
 * A bottom sheet that closes four ways: the back button, a tap outside, a tap
 * on the grab handle (the route for a screen reader), and a swipe down on it.
 *
 * Only the handle takes the swipe. A sheet whose body scrolls or holds
 * steppers and chips would otherwise fight its own content for the gesture.
 */
export const Sheet = ({
  visible,
  onDismiss,
  dismissLabel,
  contentStyle,
  testID,
  children,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const reduced = useReducedMotion()
  const offset = useSharedValue(0)

  // A sheet kept mounted and shown again must not reopen where it was flung.
  useEffect(() => {
    if (visible) offset.value = 0
  }, [visible, offset])

  const pan = Gesture.Pan()
    .withTestId('sheet-pan')
    .runOnJS(true)
    .onUpdate((event) => {
      offset.value = Math.max(0, event.translationY)
    })
    .onEnd((event) => {
      if (shouldDismiss(event)) {
        onDismiss()
        return
      }
      offset.value = withTiming(0, {
        duration: durationFor(reduced, motion.duration.quick),
        easing: motion.easing.enter,
      })
    })

  const moved = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }))

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          style={styles.dismissArea}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          testID={testID === undefined ? undefined : `${testID}-backdrop`}
        />
        <Animated.View style={[styles.sheet, moved]} testID={testID}>
          <GestureDetector gesture={pan}>
            <GrabHandle
              onPress={onDismiss}
              label={dismissLabel}
              testID={testID === undefined ? undefined : `${testID}-handle`}
            />
          </GestureDetector>
          <View style={contentStyle}>{children}</View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}
