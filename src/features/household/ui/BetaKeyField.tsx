import type { Ref } from 'react'
import { StyleSheet, Text, type TextInput } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { Field } from '@/shared/ui/Field'
import { useTranslation } from '@/shared/i18n'

type Props = {
  readonly value: string
  readonly onChangeText: (value: string) => void
  readonly hasError: boolean
  readonly testID: string
  readonly inputRef?: Ref<TextInput> | undefined
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    field: { marginBottom: tokens.space.xs },
    hint: { ...tokens.type.meta, color: tokens.color.textSupport, marginBottom: tokens.space.md },
  }),
)

/**
 * The closed-beta key, asked for on both ways onto a board while one is set
 * (supabase/schemas/12_beta_key.sql). Shown in the clear: it is shared with
 * everyone invited, and a mistyped hidden key is a support message.
 */
export const BetaKeyField = ({
  value,
  onChangeText,
  hasError,
  testID,
  inputRef,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const formStyles = useFormStyles()
  const { t } = useTranslation()

  return (
    <>
      <Text style={formStyles.label}>{t('board.betaKey')}</Text>
      <Field
        style={styles.field}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        hasError={hasError}
        accessibilityLabel={t('board.betaKey')}
        ref={inputRef}
        returnKeyType="done"
        testID={testID}
      />
      <Text style={styles.hint}>{t('board.betaKeyHint')}</Text>
    </>
  )
}
