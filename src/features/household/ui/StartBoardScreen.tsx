import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { formStyles } from '@/shared/theme/form-styles'
import { Field } from '@/shared/ui/Field'
import { PasswordField } from '@/shared/ui/PasswordField'
import { useTranslation } from '@/shared/i18n'
import type { CreateBoardError } from '../application/boards'

const errorKey = (error: CreateBoardError): string =>
  error === 'short-password' ? 'board.shortPassword' : 'board.createFailed'

type Props = {
  readonly isPending: boolean
  readonly error?: CreateBoardError | undefined
  readonly onCreate: (input: { boardName: string; displayName: string; password: string }) => void
  readonly onSignInInstead: () => void
  readonly onJoinInstead?: (() => void) | undefined
}

const styles = StyleSheet.create({
  title: { ...tokens.type.display, color: tokens.color.textPrimary },
  body: { ...tokens.type.body, color: tokens.color.textMuted, marginBottom: tokens.space.lg },
  /** Under a field, saying what it is for rather than what it must contain. */
  hint: { ...tokens.type.meta, color: tokens.color.textSupport, marginBottom: tokens.space.md },
  /**
   * The one thing an anonymous board must say out loud: this device is the
   * only key. Tinted rather than red — it is a fact to absorb, not a failure.
   */
  keyNote: {
    flexDirection: 'row',
    gap: tokens.space.sm,
    backgroundColor: tokens.color.surfaceInset,
    borderRadius: tokens.radius.md,
    padding: tokens.space.md,
    marginTop: tokens.space.lg,
    marginBottom: tokens.space.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: tokens.color.backlog,
    marginTop: 7,
  },
  keyNoteText: { ...tokens.type.meta, color: tokens.color.textMuted, flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    flexWrap: 'wrap',
    marginTop: tokens.space.md,
    marginBottom: tokens.space.lg,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muted: { ...tokens.type.meta, color: tokens.color.textSupport },
  link: { ...tokens.type.meta, fontWeight: '600', color: tokens.color.action },
})

/**
 * The first screen for someone with no account. It asks for three things and
 * nothing else — a board name, their own name, and the password the family
 * will use to join (ADR 0010).
 */
export const StartBoardScreen = ({
  isPending,
  error,
  onCreate,
  onSignInInstead,
  onJoinInstead,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [boardName, setBoardName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')

  return (
    <ScrollView
      style={formStyles.screen}
      contentContainerStyle={[formStyles.content, { paddingTop: insets.top + tokens.space.xl }]}
      testID="start-board-screen"
    >
      <Text style={styles.title}>{t('board.startTitle')}</Text>
      <Text style={styles.body}>{t('board.startBody')}</Text>

      <Text style={formStyles.label}>{t('board.boardName')}</Text>
      <Field
        value={boardName}
        onChangeText={setBoardName}
        placeholder={t('board.boardNamePlaceholder')}
        accessibilityLabel={t('board.boardName')}
        testID="start-board-name"
      />

      <Text style={formStyles.label}>{t('board.yourName')}</Text>
      <Field
        style={{ marginBottom: tokens.space.xs }}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder={t('board.yourNamePlaceholder')}
        accessibilityLabel={t('board.yourName')}
        testID="start-your-name"
      />
      <Text style={styles.hint}>{t('board.yourNameHint')}</Text>

      <Text style={formStyles.label}>{t('board.password')}</Text>
      <PasswordField
        value={password}
        onChangeText={setPassword}
        placeholder={t('board.passwordPlaceholder')}
        hasError={error === 'short-password'}
        testID="start-password"
      />
      <Text style={[styles.hint, { marginTop: tokens.space.xs }]}>{t('board.passwordHint')}</Text>

      {error !== undefined && (
        <Text style={formStyles.error} testID="start-error">
          {t(errorKey(error))}
        </Text>
      )}

      <View style={styles.keyNote}>
        <View style={styles.dot} />
        <Text style={styles.keyNoteText}>{t('board.keyWarning')}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [formStyles.primary, pressed && formStyles.primaryPressed]}
        disabled={isPending}
        onPress={() => {
          onCreate({ boardName, displayName, password })
        }}
        accessibilityRole="button"
        accessibilityLabel={t('board.create')}
        testID="start-create"
      >
        <Text style={formStyles.primaryText}>{t('board.create')}</Text>
      </Pressable>

      <View style={styles.footer}>
        {/* Shown only once there is somewhere for it to go: an invite arrives
            as a link, and there is no screen yet that takes one typed in. */}
        {onJoinInstead === undefined ? (
          <View />
        ) : (
          <View style={styles.footerLeft}>
            <Text style={styles.muted}>{t('board.haveInvite')}</Text>
            <Pressable
              onPress={onJoinInstead}
              accessibilityRole="button"
              accessibilityLabel={t('board.joinABoard')}
              testID="start-join-instead"
            >
              <Text style={styles.link}>{t('board.joinABoard')}</Text>
            </Pressable>
          </View>
        )}
        <Pressable
          onPress={onSignInInstead}
          accessibilityRole="button"
          accessibilityLabel={t('board.signInInstead')}
          testID="start-sign-in-instead"
        >
          <Text style={styles.muted}>{t('board.signInInstead')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
