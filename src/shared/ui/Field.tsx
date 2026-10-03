import { useState } from 'react'
import { StyleSheet, TextInput, type TextInputProps } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { formStyles } from '@/shared/theme/form-styles'

/**
 * A text field that shows where you are.
 *
 * The browser's own focus ring is blue, which is the one colour this palette
 * does not contain — the design puts a terracotta edge on the field being
 * filled in. Tracked here rather than per screen so every form agrees.
 */
type Props = TextInputProps & { readonly hasError?: boolean | undefined }

const styles = StyleSheet.create({
  /** The browser's own ring is suppressed because this replaces it; see
   *  src/types/react-native-web.d.ts. */
  field: { outlineStyle: 'none' },
  focused: { borderColor: tokens.color.action, borderWidth: 2 },
  error: { borderColor: tokens.color.action, borderWidth: 2 },
})

export const Field = ({ hasError = false, style, ...props }: Props): React.JSX.Element => {
  const [focused, setFocused] = useState(false)

  return (
    <TextInput
      {...props}
      style={[
        formStyles.field,
        styles.field,
        focused && styles.focused,
        hasError && styles.error,
        style,
      ]}
      placeholderTextColor={tokens.color.textGhost}
      onFocus={(event) => {
        setFocused(true)
        props.onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        props.onBlur?.(event)
      }}
    />
  )
}
