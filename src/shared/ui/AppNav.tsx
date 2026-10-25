import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaPadding } from '@/shared/theme/safe-area-padding'
import { themed, useThemed } from '@/shared/theme/theme'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { useWideScreen } from '@/shared/layout/useWideScreen'

export type NavDestination = 'week' | 'meals' | 'shopping'

const sheets = themed((tokens) =>
  StyleSheet.create({
    /** Phone: a bar under the thumb, white against the paper so it reads as
     *  chrome rather than as part of the week. */
    bar: {
      backgroundColor: tokens.color.surfaceRaised,
      borderTopWidth: 1,
      borderTopColor: tokens.color.cardDivider,
      flexDirection: 'row',
      paddingHorizontal: tokens.space.gutter,
      paddingTop: 6,
    },
    tab: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 8, minHeight: 48 },
    /** The mark above the label, not a filled pill: the bar should not compete
     *  with the board for attention. */
    indicator: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
    indicatorOn: { backgroundColor: tokens.color.action },
    tabLabel: { ...tokens.type.support, fontWeight: '600', color: tokens.color.textMuted },
    tabLabelOn: { fontWeight: '700', color: tokens.color.textPrimary },
    tabRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

    /** Wide: the same three destinations as a segmented control. */
    segmented: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: tokens.color.surface,
      borderRadius: 11,
      padding: 4,
    },
    segment: {
      borderRadius: 8,
      paddingHorizontal: 16,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    segmentOn: { backgroundColor: tokens.color.surfaceRaised, boxShadow: tokens.shadow.subtle },
    segmentLabel: { ...tokens.type.support, fontWeight: '600', color: tokens.color.textMuted },
    segmentLabelOn: { fontWeight: '700', color: tokens.color.textPrimary },

    /** How much is still to buy, on the destination that answers it. */
    badge: {
      backgroundColor: tokens.color.action,
      borderRadius: 9,
      paddingHorizontal: 7,
      paddingVertical: 1,
    },
    badgeText: { ...tokens.type.labelTiny, fontWeight: '700', color: tokens.color.onAction },
  }),
)

type Props = {
  readonly active: NavDestination
  readonly onGo: (destination: NavDestination) => void
  /** Buy Lines still unticked. Omitted or zero shows no badge. */
  readonly shoppingCount?: number | undefined
}

const Badge = ({ count }: { readonly count: number }): React.JSX.Element => {
  const styles = useThemed(sheets)

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{String(count)}</Text>
    </View>
  )
}

/**
 * The three places a Member actually goes: the week, the Meals, the Shopping
 * List. A bottom bar on a phone and a segmented control on a wide screen —
 * the same destinations, placed where the hand is.
 *
 * What it replaced was a row of four equal-weight text links in which
 * "Sign out" sat beside "Meals", and a Shopping button wide enough to be
 * clipped off the edge of a 390px phone.
 */
export const AppNav = ({ active, onGo, shoppingCount }: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const barPadding = useSafeAreaPadding({ bottom: tokens.space.gutter })
  const isWide = useWideScreen()

  const destinations: readonly { id: NavDestination; label: string }[] = [
    { id: 'week', label: t('nav.week') },
    { id: 'meals', label: t('nav.meals') },
    { id: 'shopping', label: t('nav.shopping') },
  ]

  const badgeFor = (id: NavDestination): React.JSX.Element | undefined =>
    id === 'shopping' && shoppingCount !== undefined && shoppingCount > 0 ? (
      <Badge count={shoppingCount} />
    ) : undefined

  if (isWide) {
    return (
      <View style={styles.segmented} testID="app-nav">
        {destinations.map((destination) => (
          <Pressable
            key={destination.id}
            style={[styles.segment, destination.id === active && styles.segmentOn]}
            onPress={() => {
              onGo(destination.id)
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: destination.id === active }}
            accessibilityLabel={destination.label}
            testID={`nav-${destination.id}`}
          >
            <Text style={[styles.segmentLabel, destination.id === active && styles.segmentLabelOn]}>
              {destination.label}
            </Text>
            {badgeFor(destination.id)}
          </Pressable>
        ))}
      </View>
    )
  }

  return (
    <View style={[styles.bar, barPadding]} testID="app-nav">
      {destinations.map((destination) => (
        <Pressable
          key={destination.id}
          style={styles.tab}
          onPress={() => {
            onGo(destination.id)
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: destination.id === active }}
          accessibilityLabel={destination.label}
          testID={`nav-${destination.id}`}
        >
          <View style={[styles.indicator, destination.id === active && styles.indicatorOn]} />
          <View style={styles.tabRow}>
            <Text style={[styles.tabLabel, destination.id === active && styles.tabLabelOn]}>
              {destination.label}
            </Text>
            {badgeFor(destination.id)}
          </View>
        </Pressable>
      ))}
    </View>
  )
}
