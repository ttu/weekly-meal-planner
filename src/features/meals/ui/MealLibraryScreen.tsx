import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { formStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import { partitionMeals } from '../domain/partition'
import type { Meal, MealId } from '../domain/types'
import { MealCard } from './MealCard'

const styles = StyleSheet.create({
  add: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
})

type Props = {
  readonly meals: readonly Meal[]
  readonly onSelect?: ((id: MealId) => void) | undefined
  readonly onAdd?: (() => void) | undefined
}

export const MealLibraryScreen = ({ meals, onSelect, onAdd }: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')

  const { ours, catalogue } = useMemo(() => partitionMeals(meals, query), [meals, query])

  const detailFor = (meal: Meal): string =>
    meal.ingredientCount === 0
      ? t('meal.noIngredients')
      : t('meal.ingredientCount', { count: meal.ingredientCount })

  const renderMeal = (meal: Meal): React.JSX.Element => (
    <Pressable
      key={meal.id}
      onPress={() => onSelect?.(meal.id)}
      accessibilityRole="button"
      accessibilityLabel={meal.name}
      testID={`library-meal-${meal.id}`}
    >
      <MealCard
        name={meal.name}
        photoUrl={meal.photoUrl}
        variant="library"
        detail={detailFor(meal)}
      />
    </Pressable>
  )

  return (
    <View
      style={[formStyles.screen, { paddingTop: insets.top + tokens.space.md }]}
      testID="meal-library-screen"
    >
      <View style={formStyles.header}>
        <Text style={formStyles.title}>{t('meal.library')}</Text>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('meal.add')}
          testID="library-add"
        >
          <Text style={styles.add}>{t('meal.add')}</Text>
        </Pressable>
      </View>

      <TextInput
        style={formStyles.field}
        value={query}
        onChangeText={setQuery}
        placeholder={t('picker.search')}
        placeholderTextColor={tokens.color.textMuted}
        autoCapitalize="none"
        accessibilityLabel={t('picker.search')}
        testID="library-search"
      />

      <ScrollView>
        {meals.length === 0 ? (
          <Text style={formStyles.muted} testID="library-empty">
            {t('meal.emptyLibrary')}
          </Text>
        ) : (
          <>
            {ours.length > 0 && (
              <>
                <Text style={formStyles.section}>{t('picker.ours')}</Text>
                {ours.map(renderMeal)}
              </>
            )}
            {catalogue.length > 0 && (
              <>
                <Text style={formStyles.section}>{t('picker.catalogue')}</Text>
                {catalogue.map(renderMeal)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}
