import { StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { cardStyles } from './card-styles'

/**
 * A Leftover borrows its Meal and its Servings from its Cook Event (ADR 0004),
 * so it takes only the parent's name — never a Meal. Inset, tinted and dashed,
 * so it can never be mistaken for a Meal of its own.
 */
type Props = { readonly parentMealName: string }

const styles = StyleSheet.create({
  leftover: {
    backgroundColor: tokens.color.surfaceInset,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.color.rule,
  },
})

export const LeftoverCard = ({ parentMealName }: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View style={[cardStyles.base, styles.leftover]} testID="meal-card-leftover">
      <View style={cardStyles.row}>
        <Text style={cardStyles.initial} testID="meal-card-initial">
          {parentMealName.slice(0, 1).toUpperCase()}
        </Text>
        <Text style={cardStyles.name} numberOfLines={2}>
          {t('leftover.suffix', { meal: parentMealName })}
        </Text>
      </View>
    </View>
  )
}
