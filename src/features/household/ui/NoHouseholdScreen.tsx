import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaPadding } from '@/shared/theme/safe-area-padding'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'
import { signOut } from '../application/sign-in'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

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
    signOut: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
  }),
)

/**
 * A signed-in Member whose Household cannot be loaded — a stale session after a
 * database reset, or an account nobody has invited yet. Without this they get a
 * silent, empty board and no way to understand why.
 */
export const NoHouseholdScreen = ({
  client,
}: {
  readonly client: AppSupabaseClient
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const screenPadding = useSafeAreaPadding({ top: tokens.space.xl })

  return (
    <View style={[styles.screen, screenPadding]} testID="no-household-screen">
      <Text style={styles.title}>{t('noHousehold.title')}</Text>
      <Text style={styles.body}>{t('noHousehold.body')}</Text>
      <Pressable
        onPress={() => {
          void signOut(client)
        }}
        accessibilityRole="button"
        accessibilityLabel={t('auth.signOut')}
        testID="no-household-sign-out"
      >
        <Text style={styles.signOut}>{t('auth.signOut')}</Text>
      </Pressable>
    </View>
  )
}
