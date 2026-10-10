import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'
import { useWideScreen } from '@/shared/layout/useWideScreen'

const sheets = themed((tokens) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: tokens.color.scrim },
    sheet: {
      backgroundColor: tokens.color.surface,
      borderTopLeftRadius: tokens.radius.sheet,
      borderTopRightRadius: tokens.radius.sheet,
      padding: tokens.space.lg,
      gap: tokens.space.md,
    },
    grip: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: tokens.color.dashed,
      alignSelf: 'center',
    },
    /** Wide: the same sheet, anchored under the board name as a dropdown. */
    dropdownBackdrop: { flex: 1 },
    dropdown: {
      position: 'absolute',
      top: 64,
      left: 20,
      width: 300,
      backgroundColor: tokens.color.surfaceRaised,
      borderWidth: 1,
      borderColor: tokens.color.rule,
      borderRadius: tokens.radius.card,
      boxShadow: tokens.shadow.lifted,
      padding: tokens.space.sm,
    },
    heading: { gap: 3, paddingHorizontal: 4 },
    boardName: { ...tokens.type.dayHeading, color: tokens.color.textPrimary },
    members: { ...tokens.type.support, color: tokens.color.textMuted },
    /** The one thing a half-empty board needs, so it is the one filled row. */
    invite: {
      backgroundColor: tokens.color.action,
      borderRadius: tokens.radius.card,
      padding: tokens.space.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 54,
    },
    inviteText: { gap: 2, flexShrink: 1 },
    inviteTitle: { ...tokens.type.mealName, color: tokens.color.onAction },
    inviteHint: { ...tokens.type.support, color: tokens.color.onActionMuted },
    inviteArrow: { ...tokens.type.mealNameLarge, color: tokens.color.onAction },
    group: {
      backgroundColor: tokens.color.surfaceRaised,
      borderWidth: 1,
      borderColor: tokens.color.cardBorder,
      borderRadius: tokens.radius.card,
      overflow: 'hidden',
    },
    row: {
      paddingHorizontal: tokens.space.md,
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.space.sm,
    },
    rowDivided: { borderBottomWidth: 1, borderBottomColor: tokens.color.cardDivider },
    rowLabel: { ...tokens.type.mealName, color: tokens.color.textPrimary },
    rowValue: { ...tokens.type.support, color: tokens.color.textMuted, flexShrink: 1 },
    chevron: { ...tokens.type.mealName, color: tokens.color.textGhost },
    /** Leaving is last, set apart, and written as text rather than a button:
     *  on an anonymous board it is the one action that can lose the board. */
    leave: { gap: 6, paddingHorizontal: 4, paddingTop: 4 },
    leaveLabel: { ...tokens.type.support, fontWeight: '600', color: tokens.color.actionPressed },
    leaveHit: { minHeight: 44, justifyContent: 'center' },
    leaveHint: { ...tokens.type.meta, color: tokens.color.textMuted },
  }),
)

type Props = {
  readonly boardName: string
  /** Everyone else on the board, by display name. */
  readonly otherMembers: readonly string[]
  /** What the Slots are called, shown beside the row that edits them. */
  readonly slotSummary?: string | undefined
  readonly onInvite: () => void
  readonly onMealTimes: () => void
  readonly onSettings: () => void
  readonly onLeave: () => void
  readonly onDismiss: () => void
}

const MenuBody = ({
  boardName,
  otherMembers,
  slotSummary,
  onInvite,
  onMealTimes,
  onSettings,
  onLeave,
}: Omit<Props, 'onDismiss'>): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <>
      <View style={styles.heading}>
        <Text style={styles.boardName}>{boardName}</Text>
        {otherMembers.length > 0 && (
          <Text style={styles.members}>{t('nav.members', { names: otherMembers.join(', ') })}</Text>
        )}
      </View>

      <Pressable
        style={styles.invite}
        onPress={onInvite}
        accessibilityRole="button"
        accessibilityLabel={t('nav.invite')}
        testID="menu-invite"
      >
        <View style={styles.inviteText}>
          <Text style={styles.inviteTitle}>{t('nav.invite')}</Text>
          <Text style={styles.inviteHint}>{t('nav.inviteHint')}</Text>
        </View>
        <Text style={styles.inviteArrow}>→</Text>
      </Pressable>

      <View style={styles.group}>
        <Pressable
          style={[styles.row, styles.rowDivided]}
          onPress={onMealTimes}
          accessibilityRole="button"
          accessibilityLabel={t('nav.mealTimes')}
          testID="menu-meal-times"
        >
          <Text style={styles.rowLabel}>{t('nav.mealTimes')}</Text>
          <Text style={styles.rowValue} numberOfLines={1}>
            {slotSummary ?? '›'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={onSettings}
          accessibilityRole="button"
          accessibilityLabel={t('nav.settings')}
          testID="menu-settings"
        >
          <Text style={styles.rowLabel}>{t('nav.settings')}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.leave}>
        <Pressable
          style={styles.leaveHit}
          onPress={onLeave}
          accessibilityRole="button"
          accessibilityLabel={t('nav.leave')}
          testID="menu-leave"
        >
          <Text style={styles.leaveLabel}>{t('nav.leave')}</Text>
        </Pressable>
        <Text style={styles.leaveHint}>{t('nav.leaveHint')}</Text>
      </View>
    </>
  )
}

/**
 * Everything that is not a destination: who is on the board, inviting them,
 * the Slots, Settings, and leaving.
 *
 * A bottom sheet on a phone and a dropdown under the board name on a wide
 * screen — the same items in the same order, so the two layouts teach each
 * other. Leaving sits last and apart because on an anonymous board it can
 * lose the board, and it used to sit next to "Meals".
 */
export const BoardMenu = ({ onDismiss, ...body }: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isWide = useWideScreen()

  if (isWide) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('plan.cancel')}
        />
        <View style={styles.dropdown} testID="board-menu">
          <MenuBody {...body} />
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('plan.cancel')}
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + tokens.space.lg }]}
          testID="board-menu"
        >
          <View style={styles.grip} />
          <MenuBody {...body} />
        </View>
      </View>
    </Modal>
  )
}
