import { useState } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'

/**
 * A text field that shows where you are.
 *
 * The browser's own focus ring is blue, which is the one colour this palette
 * does not contain — the design puts a terracotta edge on the field being
 * filled in. Tracked here rather than per screen so every form agrees.
 *
 * An invalid field is drawn differently from a focused one: a heavier, darker
 * edge, so it is still told apart while the person is typing in it. Colour
 * alone is not enough, so `errorMessage` (already through `t()` at the call
 * site) says what is wrong, and the field is marked invalid for screen readers.
 */
type Props = TextInputProps & {
  readonly hasError?: boolean | undefined
  readonly errorMessage?: string | undefined
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    /** Input and message share one column, so a caller that lays Field out in a
     *  row gets the message under the input, not beside it. The wrapper owns the
     *  outer bottom margin the input used to carry. */
    wrap: { marginBottom: tokens.space.md },
    /** The browser's own ring is suppressed because this replaces it; see
     *  src/types/react-native-web.d.ts. */
    field: { outlineStyle: 'none', marginBottom: 0 },
    focused: { borderColor: tokens.color.action, borderWidth: 2 },
    error: { borderColor: tokens.color.actionPressed, borderWidth: 3 },
    message: {
      ...tokens.type.support,
      color: tokens.color.actionPressed,
      marginTop: tokens.space.xs,
    },
  }),
)

/** Style keys that place the Field in its parent rather than style the input. */
const LAYOUT_KEYS: ReadonlySet<string> = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
])

/** Splits a caller's style into what positions the Field and what styles the input. */
const splitLayout = (style: TextInputProps['style']): { wrapper: ViewStyle; input: TextStyle } => {
  const wrapper: Record<string, unknown> = {}
  // flatten(undefined) is undefined at runtime, whatever its signature says.
  const flat = style ? StyleSheet.flatten(style) : {}
  const input: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    ;(LAYOUT_KEYS.has(key) ? wrapper : input)[key] = value
  }
  return { wrapper, input }
}

export const Field = ({
  hasError = false,
  errorMessage,
  style,
  ...props
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  const formStyles = useFormStyles()
  const [focused, setFocused] = useState(false)

  const { t } = useTranslation()
  const { wrapper, input } = splitLayout(style)

  const showMessage = hasError && errorMessage !== undefined
  const invalidHint = showMessage
    ? t('field.invalidBecause', { message: errorMessage })
    : t('field.invalid')
  // aria-invalid is only mapped by react-native-web; VoiceOver and TalkBack have
  // no invalid state on accessibilityState, so say it in the hint as well.
  const accessibilityHint = hasError
    ? [props.accessibilityHint, invalidHint].filter(Boolean).join('. ')
    : props.accessibilityHint

  return (
    <View style={[styles.wrap, wrapper]}>
      <TextInput
        {...props}
        aria-invalid={hasError || undefined}
        accessibilityHint={accessibilityHint}
        style={[
          formStyles.field,
          styles.field,
          focused && styles.focused,
          hasError && styles.error,
          input,
        ]}
        placeholderTextColor={theme.color.textGhost}
        onFocus={(event) => {
          setFocused(true)
          props.onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          props.onBlur?.(event)
        }}
      />
      {showMessage && (
        <Text style={styles.message} accessibilityRole="alert">
          {errorMessage}
        </Text>
      )}
    </View>
  )
}
