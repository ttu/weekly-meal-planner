import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { isErr } from '@/shared/types/result'
import { signIn, type SignInError } from '../application/sign-in'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.surface, paddingHorizontal: tokens.space.lg },
  title: { ...tokens.type.display, color: tokens.color.textPrimary, marginBottom: tokens.space.lg },
  label: {
    ...tokens.type.label,
    color: tokens.color.textMuted,
    textTransform: 'uppercase',
    marginBottom: tokens.space.xs,
  },
  field: {
    ...tokens.type.body,
    color: tokens.color.textPrimary,
    backgroundColor: tokens.color.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.color.rule,
    borderRadius: 8,
    paddingHorizontal: tokens.space.md,
    minHeight: 54,
    marginBottom: tokens.space.md,
  },
  submit: {
    backgroundColor: tokens.color.action,
    borderRadius: 8,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitPressed: { backgroundColor: tokens.color.actionPressed },
  submitText: { ...tokens.type.mealName, color: tokens.color.surfaceRaised },
  error: { ...tokens.type.body, color: tokens.color.action, marginBottom: tokens.space.md },
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
      style={[styles.screen, { paddingTop: insets.top + tokens.space.xl }]}
      testID="sign-in-screen"
    >
      <Text style={styles.title}>{t('auth.title')}</Text>

      <Text style={styles.label}>{t('auth.email')}</Text>
      <TextInput
        style={styles.field}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        accessibilityLabel={t('auth.email')}
        testID="sign-in-email"
      />

      <Text style={styles.label}>{t('auth.password')}</Text>
      <TextInput
        style={styles.field}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        accessibilityLabel={t('auth.password')}
        testID="sign-in-password"
      />

      {error !== undefined && (
        <Text style={styles.error} testID="sign-in-error">
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
