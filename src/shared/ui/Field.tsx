import { useState } from 'react'
import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'

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
    /** The browser's own ring is suppressed because this replaces it; see
     *  src/types/react-native-web.d.ts. */
    field: { outlineStyle: 'none' },
    focused: { borderColor: tokens.color.action, borderWidth: 2 },
    error: { borderColor: tokens.color.actionPressed, borderWidth: 3 },
    /** Sits close under its field, which gives up its own bottom margin. */
    withMessage: { marginBottom: tokens.space.xs },
    message: {
      ...tokens.type.support,
      color: tokens.color.actionPressed,
      marginBottom: tokens.space.md,
    },
  }),
)

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

  const showMessage = hasError && errorMessage !== undefined

  return (
    <>
      <TextInput
        {...props}
        aria-invalid={hasError || undefined}
        style={[
          formStyles.field,
          styles.field,
          focused && styles.focused,
          hasError && styles.error,
          showMessage && styles.withMessage,
          style,
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
    </>
  )
}
