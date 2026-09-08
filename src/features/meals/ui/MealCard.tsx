import { Image, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import type { Meal, Servings } from '../domain/types'

export type MealCardVariant = 'library' | 'backlog' | 'planned' | 'leftover'

type Props = {
  readonly meal: Meal
  readonly variant: MealCardVariant
  readonly addedBy?: string
  readonly servingsCooked?: Servings
  readonly parentMealName?: string
}

const styles = StyleSheet.create({
  base: { borderRadius: 10, padding: tokens.space.md, gap: tokens.space.xs },
  library: { borderBottomWidth: 1, borderBottomColor: tokens.color.rule },
  backlog: {
    backgroundColor: tokens.color.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: tokens.color.backlog,
  },
  planned: {
    backgroundColor: tokens.color.surfaceRaised,
    shadowColor: tokens.color.textPrimary,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  leftover: {
    backgroundColor: tokens.color.surfaceInset,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.color.rule,
  },
  row: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'center' },
  name: { ...tokens.type.mealName, color: tokens.color.textPrimary, flexShrink: 1 },
  support: { ...tokens.type.body, color: tokens.color.textMuted },
  initial: { ...tokens.type.display, fontSize: 20, color: tokens.color.textMuted, width: 46 },
  chip: { width: 46, height: 46, borderRadius: 6 },
})

export const MealCard = ({
  meal,
  variant,
  addedBy,
  servingsCooked,
  parentMealName,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()

  const title =
    variant === 'leftover' && parentMealName !== undefined
      ? t('leftover.suffix', { meal: parentMealName })
      : meal.name

  // A Leftover borrows its servings from its Cook Event and must never read as
  // a Meal in its own right, so it never shows a servings line.
  const showServings = variant !== 'leftover' && servingsCooked !== undefined

  return (
    <View style={[styles.base, styles[variant]]} testID={`meal-card-${variant}`}>
      <View style={styles.row}>
        {meal.photoUrl === undefined ? (
          <Text style={styles.initial} testID="meal-card-initial">
            {meal.name.slice(0, 1).toUpperCase()}
          </Text>
        ) : (
          <Image
            source={{ uri: meal.photoUrl }}
            style={styles.chip}
            accessibilityIgnoresInvertColors
          />
        )}
        <Text style={styles.name} numberOfLines={2}>
          {title}
        </Text>
      </View>

      {addedBy !== undefined && <Text style={styles.support}>{addedBy}</Text>}

      {showServings && (
        <Text style={styles.support} testID="meal-card-servings-cooked">
          {t('cookEvent.cookingCount', { count: servingsCooked })}
        </Text>
      )}
    </View>
  )
}
