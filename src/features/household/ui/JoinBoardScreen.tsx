import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { Field } from '@/shared/ui/Field'
import { Wordmark } from '@/shared/ui/Wordmark'
import { KeyboardAvoiding } from '@/shared/ui/KeyboardAvoiding'
import { useTranslation } from '@/shared/i18n'
import { MAX_MEMBER_NAME } from '../application/board-data'
import type { JoinFailure } from '../application/board-flow'

type Props = {
  readonly isPending: boolean
  /** `not-saved`: the seat was taken, but this device could not keep it. */
  readonly error?: JoinFailure | 'not-saved' | undefined
  /** The link, when the page was opened from one; otherwise it is pasted here. */
  readonly initialLink?: string | undefined
  readonly onJoin: (input: { link: string; displayName: string }) => void
  readonly onStartOwn?: (() => void) | undefined
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    title: { ...tokens.type.display, color: tokens.color.textPrimary },
    body: { ...tokens.type.body, color: tokens.color.textMuted, marginBottom: tokens.space.lg },
    gap: { height: tokens.space.md },
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

const errorKeys: Record<JoinFailure | 'not-saved', string> = {
  'bad-link': 'board.inviteUnreadable',
  offline: 'board.joinOffline',
  rejected: 'board.joinRejected',
  'not-saved': 'board.joinNotSaved',
}

/** Someone with an invite link: it carries their seat, so all that is left to ask is their name. */
export const JoinBoardScreen = ({
  isPending,
  error,
  initialLink = '',
  onJoin,
  onStartOwn,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const formStyles = useFormStyles()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [link, setLink] = useState(initialLink)
  const [displayName, setDisplayName] = useState('')

  return (
    <KeyboardAvoiding>
      <ScrollView
        style={formStyles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[formStyles.content, { paddingTop: insets.top + tokens.space.xl }]}
        testID="join-board-screen"
      >
        <Wordmark />
        <Text style={styles.title}>{t('board.joinTitle')}</Text>
        <Text style={styles.body}>{t('board.joinBody')}</Text>

        <Text style={formStyles.label}>{t('board.inviteLabel')}</Text>
        <Field
          value={link}
          onChangeText={setLink}
          placeholder={t('board.invitePlaceholder')}
          accessibilityLabel={t('board.inviteLabel')}
          autoCapitalize="none"
          autoCorrect={false}
          hasError={error === 'bad-link'}
          testID="join-link"
        />
        <View style={styles.gap} />

        <Text style={formStyles.label}>{t('board.yourName')}</Text>
        <Field
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          autoCapitalize="words"
          returnKeyType="done"
          maxLength={MAX_MEMBER_NAME}
          placeholder={t('board.yourNamePlaceholder')}
          accessibilityLabel={t('board.yourName')}
          testID="join-your-name"
        />

        {error !== undefined && (
          <Text style={[formStyles.error, { marginTop: tokens.space.sm }]} testID="join-error">
            {t(errorKeys[error])}
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [
            formStyles.primary,
            { marginTop: tokens.space.lg },
            pressed && formStyles.primaryPressed,
            link.trim() === '' && formStyles.primaryDisabled,
          ]}
          disabled={isPending || link.trim() === ''}
          aria-disabled={isPending || link.trim() === ''}
          onPress={() => {
            onJoin({ link, displayName })
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
