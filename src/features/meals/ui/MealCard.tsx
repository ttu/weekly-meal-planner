import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { Avatar } from '@/shared/ui/Avatar'
import { useTranslation } from '@/shared/i18n'
import { cardStyles } from './card-styles'
import type { Servings } from '../domain/types'

/** A Leftover is not a Meal and has its own component — see LeftoverCard. */
export type MealCardVariant = 'library' | 'backlog' | 'planned'

/**
 * Takes what it renders, not a Meal. A planned card and a Backlog card are built
 * from a Cook Event and a Backlog Item, neither of which is a Meal — demanding
 * one forced those call sites to fabricate the missing fields.
 */
type Props = {
  readonly name: string
  readonly variant: MealCardVariant
  readonly photoUrl?: string | undefined
  readonly addedBy?: string | undefined
  readonly addedByColour?: string | undefined
  readonly servingsCooked?: Servings | undefined
  readonly detail?: string | undefined
  /** A catalogue row is marked as one, and says it must be copied to be edited. */
  readonly isCatalogue?: boolean | undefined
  /** The wide board's library pane is 284px wide and needs the tighter row. */
  readonly compact?: boolean | undefined
  /** Planned cards carry their two actions as icon buttons on the card itself.
   *  Omitted, the card is a plain card — which is what the drag layer wants. */
  readonly onAddLeftover?: (() => void) | undefined
  readonly onUnplan?: (() => void) | undefined
}

const styles = StyleSheet.create({
  library: { backgroundColor: tokens.color.surface },
  /** In the pane a Household Meal sits on white and a Catalogue Meal on paper,
   *  so "ours" and "borrowed" are separable before the badge is read. */
  libraryCompact: { backgroundColor: tokens.color.surfaceRaised },
  libraryCompactCatalogue: { backgroundColor: tokens.color.surface },
  /** Amber means wanted-but-unplanned, and is recognisable across the room. */
  backlog: {
    backgroundColor: tokens.color.surfaceRaised,
    borderLeftWidth: 4,
    borderLeftColor: tokens.color.backlog,
    boxShadow: '0 1px 2px rgba(36, 33, 28, 0.05)',
  },
  planned: {
    backgroundColor: tokens.color.surfaceRaised,
    paddingVertical: 15,
    boxShadow: tokens.shadow.card,
  },
  /** The planned card reads name-then-servings on the left, then its actions,
   *  then the face of whoever put it there at the outside edge. */
  plannedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', gap: 6 },
  /**
   * Glyph buttons rather than an icon font. The app already speaks in glyphs —
   * × to remove, ✓ to tick, ⌄ to expand — and a whole icon package for two
   * marks would be the largest dependency here by some margin. Each carries a
   * real label for anyone listening rather than looking.
   */
  action: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: tokens.color.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: { backgroundColor: tokens.color.surfaceInset },
  actionGlyph: {
    fontFamily: tokens.type.body.fontFamily,
    fontSize: 15,
    lineHeight: 18,
    color: tokens.color.textSupport,
  },
  badge: {
    ...tokens.type.labelTiny,
    color: tokens.color.textMuted,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: tokens.color.dashed,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  addedBy: { flexDirection: 'row', alignItems: 'center', gap: 7 },
})

type ChipProps = { name: string; photoUrl?: string | undefined; compact: boolean }

const Chip = ({ name, photoUrl, compact }: ChipProps) =>
  photoUrl === undefined ? (
    <View style={[cardStyles.chip, compact && cardStyles.chipSmall]}>
      <Text
        style={[cardStyles.initial, compact && cardStyles.initialSmall]}
        testID="meal-card-initial"
      >
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  ) : (
    <Image
      source={{ uri: photoUrl }}
      style={[cardStyles.chipImage, compact && cardStyles.chipSmall]}
      accessibilityIgnoresInvertColors
    />
  )

export const MealCard = ({
  name,
  variant,
  photoUrl,
  addedBy,
  addedByColour,
  servingsCooked,
  detail,
  isCatalogue = false,
  compact = false,
  onAddLeftover,
  onUnplan,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()

  if (variant === 'planned') {
    return (
      <View style={[cardStyles.base, styles.planned]} testID="meal-card-planned">
        <View style={styles.plannedRow}>
          <View style={cardStyles.text}>
            <Text style={cardStyles.nameLarge}>{name}</Text>
            {servingsCooked !== undefined && (
              <Text style={cardStyles.support} testID="meal-card-servings-cooked">
                {t('cookEvent.cookingCount', { count: servingsCooked })}
              </Text>
            )}
          </View>
          <View style={styles.actions}>
            {onAddLeftover !== undefined && (
              <Pressable
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                onPress={onAddLeftover}
                accessibilityRole="button"
                accessibilityLabel={t('leftover.add')}
                testID="card-add-leftover"
              >
                {/* Another sitting of the same pot — the glossary's own word
                    for a Leftover is "repeat". */}
                <Text style={styles.actionGlyph}>↻</Text>
              </Pressable>
            )}
            {onUnplan !== undefined && (
              <Pressable
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                onPress={onUnplan}
                accessibilityRole="button"
                accessibilityLabel={t('unplan.action')}
                testID="card-unplan"
              >
                <Text style={styles.actionGlyph}>×</Text>
              </Pressable>
            )}
          </View>

          {addedBy !== undefined && addedBy !== '' && (
            <Avatar name={addedBy} colour={addedByColour ?? ''} />
          )}
        </View>
      </View>
    )
  }

  if (variant === 'backlog') {
    return (
      <View style={[cardStyles.base, styles.backlog]} testID="meal-card-backlog">
        <Text style={cardStyles.name}>{name}</Text>
        {addedBy !== undefined && addedBy !== '' && (
          <View style={styles.addedBy}>
            <Avatar name={addedBy} colour={addedByColour ?? ''} size="small" />
            <Text style={cardStyles.meta}>{addedBy}</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <View
      style={[
        cardStyles.base,
        styles.library,
        compact && cardStyles.baseCompact,
        compact && (isCatalogue ? styles.libraryCompactCatalogue : styles.libraryCompact),
      ]}
      testID="meal-card-library"
    >
      <View style={[cardStyles.row, compact && cardStyles.rowCompact]}>
        <Chip name={name} photoUrl={photoUrl} compact={compact} />
        <View style={cardStyles.text}>
          <View style={styles.nameRow}>
            <Text style={compact ? cardStyles.nameCompact : cardStyles.name}>{name}</Text>
            {isCatalogue && <Text style={styles.badge}>{t('picker.catalogue')}</Text>}
          </View>
          {detail !== undefined && (
            <Text style={compact ? cardStyles.metaCompact : cardStyles.meta}>{detail}</Text>
          )}
        </View>
      </View>
    </View>
  )
}
