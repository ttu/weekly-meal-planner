import { Image, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { cardStyles } from './card-styles'
import type { Meal, Servings } from '../domain/types'

/** A Leftover is not a Meal and has its own component — see LeftoverCard. */
export type MealCardVariant = 'library' | 'backlog' | 'planned'

type Props = {
  readonly meal: Meal
  readonly variant: MealCardVariant
  readonly addedBy?: string
  readonly servingsCooked?: Servings
}

const styles = StyleSheet.create({
  library: { borderBottomWidth: 1, borderBottomColor: tokens.color.rule },
  backlog: {
    backgroundColor: tokens.color.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: tokens.color.backlog,
  },
  // boxShadow, not the shadow* props: those are deprecated in React Native 0.86
  // and warn on every render under react-native-web.
  planned: {
    backgroundColor: tokens.color.surfaceRaised,
    boxShadow: '0 2px 6px rgba(36, 33, 28, 0.06)',
  },
})

export const MealCard = ({ meal, variant, addedBy, servingsCooked }: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View style={[cardStyles.base, styles[variant]]} testID={`meal-card-${variant}`}>
      <View style={cardStyles.row}>
        {meal.photoUrl === undefined ? (
          <Text style={cardStyles.initial} testID="meal-card-initial">
            {meal.name.slice(0, 1).toUpperCase()}
          </Text>
        ) : (
          <Image
            source={{ uri: meal.photoUrl }}
            style={cardStyles.chip}
            accessibilityIgnoresInvertColors
          />
        )}
        <Text style={cardStyles.name} numberOfLines={2}>
          {meal.name}
        </Text>
      </View>

      {addedBy !== undefined && <Text style={cardStyles.support}>{addedBy}</Text>}

      {servingsCooked !== undefined && (
        <Text style={cardStyles.support} testID="meal-card-servings-cooked">
          {t('cookEvent.cookingCount', { count: servingsCooked })}
        </Text>
      )}
    </View>
  )
}
