import { StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'

/**
 * A Leftover borrows its Meal and its Servings from its Cook Event (ADR 0004),
 * so it takes only the parent's name — never a Meal. Inset, tinted, dashed and
 * tied to its parent by a visible stub: it can never be mistaken for a Meal of
 * its own.
 */
type Props = {
  readonly parentMealName: string
  /** In a wide column the stub is dropped: 150px cannot spare 24 of them to an
   *  elbow, and the Leftover is directly under its parent anyway. */
  readonly compact?: boolean | undefined
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', paddingLeft: 22 },
  wrapCompact: { paddingLeft: 0 },
  /** The stub: an elbow drawn from the parent card down into the Leftover. */
  stub: {
    width: 14,
    height: 20,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: tokens.color.dashed,
    borderBottomLeftRadius: tokens.radius.sm,
  },
  card: {
    flex: 1,
    marginLeft: 10,
    alignSelf: 'flex-end',
    backgroundColor: tokens.color.surfaceInset,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.color.dashedInset,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  cardCompact: { marginLeft: 0, paddingVertical: tokens.space.sm, paddingHorizontal: 10 },
  text: { ...tokens.type.body, color: tokens.color.textMuted },
  textCompact: { ...tokens.type.meta, color: tokens.color.textMuted },
  /** "leftovers" in italic serif — the word itself is the label. */
  word: { fontFamily: tokens.type.dayHeading.fontFamily, fontSize: 17, fontStyle: 'italic' },
  wordCompact: { fontFamily: tokens.type.dayHeading.fontFamily, fontSize: 15, fontStyle: 'italic' },
})

export const LeftoverCard = ({ parentMealName, compact = false }: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      testID="meal-card-leftover"
      accessibilityLabel={t('leftover.suffix', { meal: parentMealName })}
    >
      {!compact && <View style={styles.stub} />}
      <View style={[styles.card, compact && styles.cardCompact]}>
        <Text style={compact ? styles.textCompact : styles.text} numberOfLines={2}>
          {t('leftover.parentPrefix', { meal: parentMealName })}
          <Text style={compact ? styles.wordCompact : styles.word}>{t('leftover.word')}</Text>
        </Text>
      </View>
    </View>
  )
}
