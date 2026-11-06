import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import { unitsFor } from '@/shared/units'
import type { Ingredient } from '../domain/types'

const sheets = themed((tokens) =>
  StyleSheet.create({
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
    quantity: { width: 110, marginBottom: 0 },
    quantityInvalid: { borderColor: tokens.color.action },
    error: { ...tokens.type.body, color: tokens.color.action },
  }),
)

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
  const styles = useThemed(sheets)
  const formStyles = useFormStyles()
  const { t } = useTranslation()
  const unitName = (option: string): string => t(`unit.${option}`)

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
          style={[formStyles.field, styles.quantity, !isQuantityValid && styles.quantityInvalid]}
          value={quantityText}
          onChangeText={onQuantityChange}
          keyboardType="decimal-pad"
          returnKeyType="done"
          accessibilityLabel={`${t('ingredient.quantity')} ${ingredient.name}`}
          testID={`ingredient-quantity-${ingredient.slug}`}
        />
        {unitsFor(ingredient.dimension).map((option) => (
          <Pressable
            key={option}
            style={[formStyles.chip, option === unit && formStyles.chipSelected]}
            onPress={() => {
              onUnitChange(option)
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: option === unit }}
            accessibilityLabel={`${t('ingredient.unit')} ${unitName(option)}`}
            testID={`ingredient-unit-${ingredient.slug}-${option}`}
          >
            <Text style={formStyles.chipText}>{unitName(option)}</Text>
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
