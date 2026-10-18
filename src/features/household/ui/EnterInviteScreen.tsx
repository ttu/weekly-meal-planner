import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { useSafeAreaPadding } from '@/shared/theme/safe-area-padding'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { Field } from '@/shared/ui/Field'
import { BackLink } from '@/shared/ui/BackLink'
import { Wordmark } from '@/shared/ui/Wordmark'
import { useTranslation } from '@/shared/i18n'
import { inviteToken } from '../domain/invite'

type Props = {
  readonly onOpen: (token: string) => void
  readonly onBack: () => void
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    fieldTight: { marginBottom: tokens.space.xs },
    title: { ...tokens.type.display, color: tokens.color.textPrimary },
    body: { ...tokens.type.body, color: tokens.color.textMuted, marginBottom: tokens.space.lg },
    hint: { ...tokens.type.meta, color: tokens.color.textSupport, marginBottom: tokens.space.md },
  }),
)

/**
 * For the invite that did not arrive as a tappable link — read out over the
 * phone, forwarded as text, or opened on the wrong device. It takes the paste
 * and hands the token to the ordinary join screen, which then names the board
 * and asks for the password. Nothing is checked here beyond "this contains a
 * token": whether it opens anything is the server's answer to give.
 */
export const EnterInviteScreen = ({ onOpen, onBack }: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const formStyles = useFormStyles()
  const { t } = useTranslation()
  const contentPadding = useSafeAreaPadding({ top: tokens.space.md })
  const [pasted, setPasted] = useState('')
  const [unreadable, setUnreadable] = useState(false)

  return (
    <ScrollView
      style={formStyles.screen}
      contentContainerStyle={[formStyles.content, contentPadding]}
      testID="enter-invite-screen"
    >
      <BackLink onPress={onBack} label={t('nav.backPlain')} />
      <Wordmark />
      <Text style={styles.title}>{t('board.inviteTitle')}</Text>
      <Text style={styles.body}>{t('board.inviteBody')}</Text>

      <Text style={formStyles.label}>{t('board.inviteLabel')}</Text>
      <Field
        style={styles.fieldTight}
        value={pasted}
        onChangeText={(next) => {
          setPasted(next)
          setUnreadable(false)
        }}
        placeholder={t('board.invitePlaceholder')}
        accessibilityLabel={t('board.inviteLabel')}
        autoCapitalize="none"
        autoCorrect={false}
        hasError={unreadable}
        testID="invite-link"
      />
      <Text style={styles.hint}>{t('board.inviteHint')}</Text>

      {unreadable && (
        <Text style={formStyles.error} testID="invite-error">
          {t('board.inviteUnreadable')}
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [formStyles.primary, pressed && formStyles.primaryPressed]}
        onPress={() => {
          const token = inviteToken(pasted)
          if (token === undefined) {
            setUnreadable(true)
            return
          }
          onOpen(token)
        }}
        accessibilityRole="button"
        accessibilityLabel={t('board.inviteOpen')}
        testID="invite-open"
      >
        <Text style={formStyles.primaryText}>{t('board.inviteOpen')}</Text>
      </Pressable>
    </ScrollView>
  )
}
