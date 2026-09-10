import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { unitsFor } from '@/shared/units'
import type { Ingredient } from '../domain/types'

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.rule,
    paddingVertical: tokens.space.sm,
    gap: tokens.space.xs,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...tokens.type.body, color: tokens.color.textPrimary, flexShrink: 1 },
  remove: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  quantity: {
    ...tokens.type.body,
    color: tokens.color.textPrimary,
    backgroundColor: tokens.color.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.color.rule,
    borderRadius: 8,
    paddingHorizontal: tokens.space.md,
    minHeight: 54,
    width: 110,
  },
  quantityInvalid: { borderColor: tokens.color.action },
  unit: {
    borderWidth: 1,
    borderColor: tokens.color.rule,
    backgroundColor: tokens.color.surfaceRaised,
    borderRadius: 8,
    minHeight: 54,
    paddingHorizontal: tokens.space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitSelected: { borderColor: tokens.color.action, borderWidth: 2 },
  unitText: { ...tokens.type.body, color: tokens.color.textPrimary },
  error: { ...tokens.type.body, color: tokens.color.action },
})

type Props = {
  readonly ingredient: Ingredient
  readonly quantityText: string
  readonly unit: string
  readonly isQuantityValid: boolean
  readonly onQuantityChange: (value: string) => void
  readonly onUnitChange: (unit: string) => void
  readonly onRemove: () => void
}

/**
 * The unit choices are limited to the Ingredient's own dimension: offering
 * "litres of minced beef" would let a Member create a Meal the Shopping List
 * cannot aggregate.
 */
export const IngredientRow = ({
  ingredient,
  quantityText,
  unit,
  isQuantityValid,
  onQuantityChange,
  onUnitChange,
  onRemove,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View style={styles.row} testID={`ingredient-row-${ingredient.slug}`}>
      <View style={styles.topRow}>
        <Text style={styles.name}>{ingredient.name}</Text>
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`${t('ingredient.remove')} ${ingredient.name}`}
          testID={`ingredient-remove-${ingredient.slug}`}
        >
          <Text style={styles.remove}>{t('ingredient.remove')}</Text>
        </Pressable>
      </View>

      <View style={styles.controls}>
        <TextInput
          style={[styles.quantity, !isQuantityValid && styles.quantityInvalid]}
          value={quantityText}
          onChangeText={onQuantityChange}
          keyboardType="decimal-pad"
          accessibilityLabel={`${t('ingredient.quantity')} ${ingredient.name}`}
          testID={`ingredient-quantity-${ingredient.slug}`}
        />
        {unitsFor(ingredient.dimension).map((option) => (
          <Pressable
            key={option}
            style={[styles.unit, option === unit && styles.unitSelected]}
            onPress={() => {
              onUnitChange(option)
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: option === unit }}
            accessibilityLabel={`${t('ingredient.unit')} ${option}`}
            testID={`ingredient-unit-${ingredient.slug}-${option}`}
          >
            <Text style={styles.unitText}>{option}</Text>
          </Pressable>
        ))}
      </View>

      {!isQuantityValid && (
        <Text style={styles.error} testID={`ingredient-error-${ingredient.slug}`}>
          {t('ingredient.badQuantity')}
        </Text>
      )}
    </View>
  )
}
