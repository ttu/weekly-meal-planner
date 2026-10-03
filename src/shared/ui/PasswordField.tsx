import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
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
  readonly testID: string
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  field: { flex: 1, marginBottom: 0 },
  toggle: { position: 'absolute', right: tokens.space.md, paddingVertical: tokens.space.sm },
  toggleText: { ...tokens.type.support, fontWeight: '600', color: tokens.color.textMuted },
})

export const PasswordField = ({
  value,
  onChangeText,
  placeholder,
  hasError = false,
  testID,
}: Props): React.JSX.Element => {
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
        accessibilityLabel={t('board.password')}
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
