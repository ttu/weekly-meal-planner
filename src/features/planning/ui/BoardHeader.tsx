import { Pressable, StyleSheet, Text, View } from 'react-native'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { Avatar } from '@/shared/ui/Avatar'
import { AppNav, type NavDestination } from '@/shared/ui/AppNav'
import { useTranslation } from '@/shared/i18n'

/**
 * The wide board's top bar: who this board is, the three destinations, who
 * else is here, and the invitation.
 *
 * It used to be a row of five equal links with a terracotta Shopping button on
 * the end. The destinations are now a segmented control — the same three the
 * phone puts under the thumb — and everything rare moved behind the board's
 * name. Nothing here changes between tabs, so the bar stays put as you move.
 */
export type PresentMember = {
  readonly userId: string
  readonly displayName: string
  readonly colour: string
}

type Props = {
  readonly householdName: string
  readonly present: readonly PresentMember[]
  readonly active: NavDestination
  readonly shoppingCount?: number | undefined
  readonly onGo: (destination: NavDestination) => void
  readonly onOpenMenu: () => void
  readonly onShare: () => void
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
      paddingVertical: 10,
    },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 28, flexShrink: 1 },
    nameHit: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, flexShrink: 1 },
    household: { ...tokens.type.dayHeading, color: tokens.color.textPrimary },
    caret: { ...tokens.type.meta, color: tokens.color.textSupport },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    /** Avatars overlap and wear a white ring, so a stack of three reads as three. */
    presence: { flexDirection: 'row' },
    overlap: { marginLeft: -8 },
    /** Outlined, not filled: terracotta stays the colour of the one thing a
     *  week is for, and inviting is not it. */
    invite: {
      borderWidth: 1,
      borderColor: tokens.color.cardBorder,
      borderRadius: 9,
      paddingHorizontal: 14,
      minHeight: 44,
      justifyContent: 'center',
    },
    invitePressed: { backgroundColor: tokens.color.surfaceInset },
    inviteText: { ...tokens.type.support, fontWeight: '600', color: tokens.color.textPrimary },
  }),
)

export const BoardHeader = ({
  householdName,
  present,
  active,
  shoppingCount,
  onGo,
  onOpenMenu,
  onShare,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  const { t } = useTranslation()

  return (
    <View style={styles.bar} testID="board-header">
      <View style={styles.identity}>
        <Pressable
          style={styles.nameHit}
          onPress={onOpenMenu}
          accessibilityRole="button"
          accessibilityLabel={t('nav.boardMenu')}
          testID="open-board-menu"
        >
          <Text style={styles.household} numberOfLines={1}>
            {householdName}
          </Text>
          <Text style={styles.caret}>▾</Text>
        </Pressable>

        <AppNav active={active} onGo={onGo} shoppingCount={shoppingCount} />
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
          style={({ pressed }) => [styles.invite, pressed && styles.invitePressed]}
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel={t('nav.invite')}
          testID="share-board"
        >
          <Text style={styles.inviteText}>{t('nav.invite')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
