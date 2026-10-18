import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { Avatar } from '@/shared/ui/Avatar'
import { Field } from '@/shared/ui/Field'
import { PasswordField } from '@/shared/ui/PasswordField'
import { Wordmark } from '@/shared/ui/Wordmark'
import { useTranslation } from '@/shared/i18n'
import type { BoardPreview, JoinBoardError } from '../application/boards'
import { BetaKeyField } from './BetaKeyField'
import { KeyboardAvoiding } from '@/shared/ui/KeyboardAvoiding'

/** "Dad", "Dad and Mum", "Dad, Mum and Sanni" — the people to go and ask. */
const listNames = (names: readonly string[], and: string): string => {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} ${and} ${String(names[names.length - 1])}`
}

type Props = {
  readonly isPending: boolean
  readonly error?: JoinBoardError | undefined
  /** Whose board this is. Absent when the link matches nothing — which is also
   *  what a wrong password is told, so the screen must not give that away. */
  readonly preview?: BoardPreview | undefined
  /** True while a beta key is set; see supabase/schemas/12_beta_key.sql. */
  readonly askBetaKey?: boolean | undefined
  readonly onJoin: (input: { password: string; displayName: string; betaKey: string }) => void
  readonly onStartOwn?: (() => void) | undefined
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    faces: { flexDirection: 'row', marginBottom: tokens.space.md },
    overlap: { marginLeft: -9 },
    gap: { height: tokens.space.md },
    title: { ...tokens.type.display, color: tokens.color.textPrimary },
    body: { ...tokens.type.body, color: tokens.color.textMuted, marginBottom: tokens.space.lg },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: tokens.space.md,
      marginBottom: tokens.space.lg,
    },
    muted: { ...tokens.type.meta, color: tokens.color.textSupport },
    link: { ...tokens.type.meta, fontWeight: '600', color: tokens.color.action },
  }),
)

export const JoinBoardScreen = ({
  isPending,
  error,
  preview,
  askBetaKey = false,
  onJoin,
  onStartOwn,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  const formStyles = useFormStyles()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [betaKey, setBetaKey] = useState('')

  const names = preview?.members.map((m) => m.name) ?? []
  // "Dad and Mum are already planning", but "check with Dad or Mum" — either
  // of them can tell you, and the error is asking you to go and pick one.
  const asList = listNames(names, t('board.and'))
  const asChoice = listNames(names, t('board.or'))

  const errorText = (): string => {
    if (error === 'rate-limited') return t('board.joinRateLimited')
    if (error === 'invalid-beta-key') return t('board.invalidBetaKey')
    // A wrong link and a wrong password say the same thing, because the server
    // does not distinguish them either (ADR 0010). Naming the Members is only
    // possible when the link was real, and then it is the useful thing to say.
    return names.length > 0
      ? t('board.joinRejectedNamed', { names: asChoice })
      : t('board.joinRejected')
  }

  return (
    <KeyboardAvoiding>
      <ScrollView
        style={formStyles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[formStyles.content, { paddingTop: insets.top + tokens.space.xl }]}
        testID="join-board-screen"
      >
        <Wordmark />
        {preview !== undefined && preview.members.length > 0 && (
          <View style={styles.faces} testID="join-faces">
            {preview.members.map((member, index) => (
              <View key={member.name} style={index > 0 && styles.overlap}>
                <Avatar
                  name={member.name}
                  colour={member.colour}
                  size="large"
                  ringColour={theme.color.surface}
                />
              </View>
            ))}
          </View>
        )}

        <Text style={styles.title}>
          {preview === undefined
            ? t('board.joinTitle')
            : t('board.joinTitleNamed', { board: preview.name })}
        </Text>
        <Text style={styles.body}>
          {names.length > 0
            ? t('board.joinBodyNamed', { names: asList, count: names.length })
            : t('board.joinBody')}
        </Text>

        <Text style={formStyles.label}>{t('board.yourName')}</Text>
        <Field
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          autoCapitalize="words"
          returnKeyType="next"
          placeholder={t('board.yourNamePlaceholder')}
          accessibilityLabel={t('board.yourName')}
          testID="join-your-name"
        />

        <Text style={formStyles.label}>{t('board.password')}</Text>
        <PasswordField
          value={password}
          onChangeText={setPassword}
          hasError={error !== undefined && error !== 'invalid-beta-key'}
          testID="join-password"
        />

        {askBetaKey && (
          <>
            <View style={styles.gap} />
            <BetaKeyField
              value={betaKey}
              onChangeText={setBetaKey}
              hasError={error === 'invalid-beta-key'}
              testID="join-beta-key"
            />
          </>
        )}

        {error !== undefined && (
          <Text style={[formStyles.error, { marginTop: tokens.space.sm }]} testID="join-error">
            {errorText()}
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [
            formStyles.primary,
            { marginTop: tokens.space.lg },
            pressed && formStyles.primaryPressed,
          ]}
          disabled={isPending}
          onPress={() => {
            onJoin({ password, displayName, betaKey })
          }}
          accessibilityRole="button"
          accessibilityLabel={t('board.join')}
          testID="join-submit"
        >
          <Text style={formStyles.primaryText}>{t('board.join')}</Text>
        </Pressable>

        {onStartOwn !== undefined && (
          <View style={styles.footer}>
            <Text style={styles.muted}>{t('board.notThisOne')}</Text>
            <Pressable
              onPress={onStartOwn}
              accessibilityRole="button"
              accessibilityLabel={t('board.startYourOwn')}
              testID="join-start-own"
            >
              <Text style={styles.link}>{t('board.startYourOwn')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoiding>
  )
}
