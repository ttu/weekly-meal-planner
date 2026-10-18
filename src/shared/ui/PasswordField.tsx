import { useState, type Ref } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInput,
  type TextInputProps,
} from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { Field } from '@/shared/ui/Field'
import { useTranslation } from '@/shared/i18n'

/**
 * A board password, with a way to look at it.
 *
 * Hiding it by default is right — these screens are filled in with someone
 * reading over your shoulder — but a board password is said out loud to a
 * family, not a bank PIN, and typing six characters blind into a field that
 * then rejects you is the worst of both.
 */
type Props = {
  readonly value: string
  readonly onChangeText: (value: string) => void
  readonly placeholder?: string | undefined
  readonly hasError?: boolean | undefined
  /** Choosing a password rather than entering one: tells the OS to offer a
   *  strong one instead of filling in a saved one. */
  readonly isNew?: boolean | undefined
  readonly testID: string
  /** For chaining focus from the field before it, or to the one after. */
  readonly inputRef?: Ref<TextInput> | undefined
  readonly returnKeyType?: TextInputProps['returnKeyType']
  readonly submitBehavior?: TextInputProps['submitBehavior']
  readonly onSubmitEditing?: TextInputProps['onSubmitEditing']
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center' },
    field: { flex: 1, marginBottom: 0 },
    toggle: { position: 'absolute', right: tokens.space.md, paddingVertical: tokens.space.sm },
    toggleText: { ...tokens.type.support, fontWeight: '600', color: tokens.color.textMuted },
  }),
)

export const PasswordField = ({
  value,
  onChangeText,
  placeholder,
  hasError = false,
  isNew = false,
  testID,
  inputRef,
  returnKeyType,
  submitBehavior,
  onSubmitEditing,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)

  return (
    <View style={styles.wrap}>
      <Field
        style={styles.field}
        hasError={hasError}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!shown}
        placeholder={placeholder}
        autoCapitalize="none"
        autoComplete={isNew ? 'new-password' : 'current-password'}
        textContentType={isNew ? 'newPassword' : 'password'}
        accessibilityLabel={t('board.password')}
        returnKeyType={returnKeyType}
        submitBehavior={submitBehavior}
        onSubmitEditing={onSubmitEditing}
        ref={inputRef}
        testID={testID}
      />
      <Pressable
        style={styles.toggle}
        onPress={() => {
          setShown((current) => !current)
        }}
        accessibilityRole="button"
        accessibilityLabel={shown ? t('board.hidePassword') : t('board.showPassword')}
        testID={`${testID}-show`}
      >
        <Text style={styles.toggleText}>
          {shown ? t('board.hidePassword') : t('board.showPassword')}
        </Text>
      </Pressable>
    </View>
  )
}
