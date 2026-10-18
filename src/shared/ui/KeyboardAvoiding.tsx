import { KeyboardAvoidingView, StyleSheet, View, type ViewProps } from 'react-native'

/**
 * Keeps the primary action above the keyboard.
 *
 * iOS and Android both pad. Android is edge-to-edge (mandatory since Expo SDK
 * 54), so the window is no longer resized for the keyboard: it is an inset
 * drawn over the content, and without padding it covers the bottom of the
 * screen. React Native's KeyboardAvoidingView reads the keyboard frame rather
 * than relying on the window, so it works there. A Modal is its own window and
 * is edge-to-edge too, so the pickers wrap their content inside the Modal.
 *
 * The web browser scrolls the focused field into view itself; a plain View
 * there keeps it exactly as it was. No native library: Expo Go must work.
 */
export const keyboardBehavior = (os: string | undefined): 'padding' | undefined =>
  os === 'ios' || os === 'android' ? 'padding' : undefined

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
