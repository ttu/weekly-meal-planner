import { KeyboardAvoidingView, StyleSheet, View, type ViewProps } from 'react-native'

/**
 * Keeps the primary action above the keyboard.
 *
 * Only iOS needs padding: Android resizes the window for the keyboard, and the
 * web browser scrolls the focused field into view. A plain View there keeps
 * those platforms exactly as they were. No native library — Expo Go must work.
 */
export const keyboardBehavior = (os: string | undefined): 'padding' | undefined =>
  os === 'ios' ? 'padding' : undefined

const styles = StyleSheet.create({
  fill: { flex: 1 },
})

export const KeyboardAvoiding = ({ style, ...props }: ViewProps): React.JSX.Element => {
  const behavior = keyboardBehavior(process.env.EXPO_OS)
  return behavior === undefined ? (
    <View style={[styles.fill, style]} {...props} />
  ) : (
    <KeyboardAvoidingView behavior={behavior} style={[styles.fill, style]} {...props} />
  )
}
