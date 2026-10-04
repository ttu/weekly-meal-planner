import { Pressable, StyleSheet, Text, View } from 'react-native'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { Avatar } from '@/shared/ui/Avatar'
import { useTranslation } from '@/shared/i18n'

/**
 * The board's chrome, and the one place it is allowed to be loud: a single
 * terracotta button for the Shopping List. Everything else is a quiet grey
 * link, so the action colour keeps meaning one thing.
 */
export type PresentMember = {
  readonly userId: string
  readonly displayName: string
  readonly colour: string
}

type Props = {
  readonly householdName: string
  readonly weekRange: string
  readonly present: readonly PresentMember[]
  readonly shared: boolean
  readonly onShare: () => void
  readonly onOpenShopping?: (() => void) | undefined
  readonly onOpenLibrary?: (() => void) | undefined
  readonly onOpenSettings?: (() => void) | undefined
  readonly onSignOut: () => void
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.space.md,
      backgroundColor: tokens.color.surfaceRaised,
      borderBottomWidth: 1,
      borderBottomColor: tokens.color.cardBorder,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },
    identity: { flexDirection: 'row', alignItems: 'baseline', gap: 14, flexShrink: 1 },
    household: { ...tokens.type.dayHeading, color: tokens.color.textPrimary },
    week: { ...tokens.type.support, color: tokens.color.textSupport },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    link: { ...tokens.type.support, color: tokens.color.textMuted },
    /** Avatars overlap and wear a white ring, so a stack of three reads as three. */
    presence: { flexDirection: 'row' },
    overlap: { marginLeft: -8 },
    shopping: {
      backgroundColor: tokens.color.action,
      borderRadius: 9,
      paddingHorizontal: 15,
      paddingVertical: 8,
    },
    shoppingPressed: { backgroundColor: tokens.color.actionPressed },
    shoppingText: {
      ...tokens.type.support,
      fontWeight: '600',
      color: tokens.color.onAction,
    },
  }),
)

export const BoardHeader = ({
  householdName,
  weekRange,
  present,
  shared,
  onShare,
  onOpenShopping,
  onOpenLibrary,
  onOpenSettings,
  onSignOut,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  const { t } = useTranslation()

  return (
    <View style={styles.bar} testID="board-header">
      <View style={styles.identity}>
        <Text style={styles.household} numberOfLines={1}>
          {householdName}
        </Text>
        <Text style={styles.week}>{weekRange}</Text>
      </View>

      <View style={styles.actions}>
        {present.length > 0 && (
          <View style={styles.presence} testID="presence">
            {present.map((member, index) => (
              <View key={member.userId} style={index > 0 && styles.overlap}>
                <Avatar
                  name={member.displayName}
                  colour={member.colour}
                  ringColour={theme.color.surfaceRaised}
                />
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={onOpenLibrary}
          accessibilityRole="button"
          accessibilityLabel={t('meal.library')}
          testID="open-library"
        >
          <Text style={styles.link}>{t('meal.library')}</Text>
        </Pressable>

        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel={t('board.share')}
          testID="share-board"
        >
          <Text style={styles.link}>{shared ? t('board.shareCopied') : t('board.share')}</Text>
        </Pressable>

        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel={t('nav.settings')}
          testID="open-settings"
        >
          <Text style={styles.link}>{t('nav.settings')}</Text>
        </Pressable>

        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel={t('auth.signOut')}
          testID="sign-out"
        >
          <Text style={styles.link}>{t('auth.signOut')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.shopping, pressed && styles.shoppingPressed]}
          onPress={onOpenShopping}
          accessibilityRole="button"
          accessibilityLabel={t('shopping.listTitle')}
          testID="open-shopping"
        >
          <Text style={styles.shoppingText}>{t('shopping.listTitle')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
