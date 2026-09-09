import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { formStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import { isErr } from '@/shared/types/result'
import { signIn, type SignInError } from '../application/sign-in'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

const styles = StyleSheet.create({
  title: { ...tokens.type.display, color: tokens.color.textPrimary, marginBottom: tokens.space.lg },
  submit: {
    backgroundColor: tokens.color.action,
    borderRadius: 8,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitPressed: { backgroundColor: tokens.color.actionPressed },
  submitText: { ...tokens.type.mealName, color: tokens.color.surfaceRaised },
})

const errorKey = (error: SignInError): string =>
  error === 'invalid-credentials' ? 'auth.invalid' : 'auth.unavailable'

type Props = { readonly client: AppSupabaseClient }

export const SignInScreen = ({ client }: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<SignInError | undefined>(undefined)
  const [isPending, setIsPending] = useState(false)

  const submit = (): void => {
    setIsPending(true)
    setError(undefined)
    void signIn(client, email.trim(), password).then((result) => {
      setIsPending(false)
      if (isErr(result)) setError(result.error)
    })
  }

  return (
    <View
      style={[formStyles.screen, { paddingTop: insets.top + tokens.space.xl }]}
      testID="sign-in-screen"
    >
      <Text style={formStyles.title}>{t('auth.title')}</Text>

      <Text style={formStyles.label}>{t('auth.email')}</Text>
      <TextInput
        style={formStyles.field}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        accessibilityLabel={t('auth.email')}
        testID="sign-in-email"
      />

      <Text style={formStyles.label}>{t('auth.password')}</Text>
      <TextInput
        style={formStyles.field}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        accessibilityLabel={t('auth.password')}
        testID="sign-in-password"
      />

      {error !== undefined && (
        <Text style={formStyles.error} testID="sign-in-error">
          {t(errorKey(error))}
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}
        onPress={submit}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel={t('auth.submit')}
        testID="sign-in-submit"
      >
        <Text style={styles.submitText}>{t('auth.submit')}</Text>
      </Pressable>
    </View>
  )
}
