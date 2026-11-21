import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'

const sheets = themed((tokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: tokens.color.surface,
      paddingHorizontal: tokens.space.lg,
      gap: tokens.space.md,
    },
    title: { ...tokens.type.display, color: tokens.color.textPrimary },
    body: { ...tokens.type.body, color: tokens.color.textMuted },
    link: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
  }),
)

/**
 * A device whose seat on the board is gone: an admin removed this Member. The
 * board is no longer shown, and the way forward is a board of one's own or a
 * new invite.
 */
export const NoHouseholdScreen = ({
  onStart,
  onJoin,
}: {
  readonly onStart: () => void
  readonly onJoin: () => void
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + tokens.space.xl }]}
      testID="no-household-screen"
    >
      <Text style={styles.title}>{t('noHousehold.title')}</Text>
      <Text style={styles.body}>{t('noHousehold.body')}</Text>
      <Pressable
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel={t('board.startYourOwn')}
        testID="no-household-start"
      >
        <Text style={styles.link}>{t('board.startYourOwn')}</Text>
      </Pressable>
      <Pressable
        onPress={onJoin}
        accessibilityRole="button"
        accessibilityLabel={t('board.joinABoard')}
        testID="no-household-join"
      >
        <Text style={styles.link}>{t('board.joinABoard')}</Text>
      </Pressable>
    </View>
  )
}
