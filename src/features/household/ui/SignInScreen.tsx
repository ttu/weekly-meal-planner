import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import { isErr } from '@/shared/types/result'
import { Avatar } from '@/shared/ui/Avatar'
import { BackLink } from '@/shared/ui/BackLink'
import { Wordmark } from '@/shared/ui/Wordmark'
import type { DemoAccount } from '../domain/demo-accounts'
import { signIn, type SignInError } from '../application/sign-in'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'
import { KeyboardAvoiding } from '@/shared/ui/KeyboardAvoiding'

const sheets = themed((tokens) =>
  StyleSheet.create({
    /** Set apart from the form: a developer convenience sitting below the
     *  real thing, never mistakable for part of it. */
    demo: {
      marginTop: tokens.space.xl,
      paddingTop: tokens.space.md,
      borderTopWidth: 1,
      borderTopColor: tokens.color.rule,
      gap: tokens.space.xs,
    },
    demoTitle: {
      ...tokens.type.label,
      color: tokens.color.textSupport,
      textTransform: 'uppercase',
    },
    demoHint: {
      ...tokens.type.meta,
      color: tokens.color.textSupport,
      marginBottom: tokens.space.xs,
    },
    demoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.space.sm,
      minHeight: 54,
      paddingHorizontal: tokens.space.sm,
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderColor: tokens.color.cardBorder,
      backgroundColor: tokens.color.surfaceRaised,
    },
    demoRowPressed: { backgroundColor: tokens.color.surfaceInset },
    demoText: { flex: 1 },
    demoName: { ...tokens.type.support, fontWeight: '600', color: tokens.color.textPrimary },
    demoEmail: { ...tokens.type.meta, color: tokens.color.textSupport },
    title: {
      ...tokens.type.display,
      color: tokens.color.textPrimary,
      marginBottom: tokens.space.lg,
    },
    submit: {
      backgroundColor: tokens.color.action,
      borderRadius: 8,
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitPressed: { backgroundColor: tokens.color.actionPressed },
    submitText: { ...tokens.type.mealName, color: tokens.color.onAction },
  }),
)

const errorKey = (error: SignInError): string =>
  error === 'invalid-credentials' ? 'auth.invalid' : 'auth.unavailable'

/** The list the seed writes, handed in by the route only when `__DEV__`. The
 *  screen itself knows nothing about which build it is in. */
const DemoLogins = ({
  accounts,
  onPick,
}: {
  readonly accounts: readonly DemoAccount[]
  readonly onPick: (account: DemoAccount) => void
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.demo} testID="demo-logins">
      <Text style={styles.demoTitle}>{t('auth.demoTitle')}</Text>
      <Text style={styles.demoHint}>{t('auth.demoHint')}</Text>
      {accounts.map((account) => (
        <Pressable
          key={account.email}
          style={({ pressed }) => [styles.demoRow, pressed && styles.demoRowPressed]}
          onPress={() => {
            onPick(account)
          }}
          accessibilityRole="button"
          accessibilityLabel={`${account.displayName} — ${account.email}`}
          testID={`demo-login-${account.displayName.toLowerCase()}`}
        >
          <Avatar name={account.displayName} colour={account.colour} size="small" />
          <View style={styles.demoText}>
            <Text style={styles.demoName}>
              {account.role === 'owner'
                ? `${account.displayName} · ${t('auth.demoOwner')}`
                : account.displayName}
            </Text>
            <Text style={styles.demoEmail}>{account.email}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  )
}

type Props = {
  readonly client: AppSupabaseClient
  /** Omitted in a production build, which is what keeps the list out of it. */
  readonly demoAccounts?: readonly DemoAccount[] | undefined
  readonly onBack?: (() => void) | undefined
}

export const SignInScreen = ({ client, demoAccounts, onBack }: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const formStyles = useFormStyles()
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
    <KeyboardAvoiding style={formStyles.screen} testID="sign-in-screen">
      <View style={[formStyles.content, { paddingTop: insets.top + tokens.space.xl }]}>
        {onBack !== undefined && <BackLink onPress={onBack} label={t('auth.back')} />}
        <Wordmark />

        <Text style={[formStyles.title, { marginBottom: tokens.space.lg }]}>{t('auth.title')}</Text>

        <Text style={formStyles.label}>{t('auth.email')}</Text>
        <TextInput
          style={formStyles.field}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          returnKeyType="next"
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
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
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

        {demoAccounts !== undefined && demoAccounts.length > 0 && (
          <DemoLogins
            accounts={demoAccounts}
            onPick={(account) => {
              setEmail(account.email)
              setPassword(account.password)
              setError(undefined)
            }}
          />
        )}
      </View>
    </KeyboardAvoiding>
  )
}
