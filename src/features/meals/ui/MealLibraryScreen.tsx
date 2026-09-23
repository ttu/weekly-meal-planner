import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { partitionMeals } from '../domain/partition'
import { isCatalogueMeal, type Meal, type MealId } from '../domain/types'
import { MealCard } from './MealCard'

/**
 * The Meal library, as a full screen on a phone and as the leftmost pane on a
 * wide board. One component, because a row that differs between the two is a
 * row that will drift.
 */
export type LibraryLayout = 'screen' | 'pane'

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.surface },
  pane: { flex: 1, backgroundColor: tokens.color.surfacePane },
  head: { paddingHorizontal: tokens.space.md, paddingBottom: 12, gap: 11 },
  headScreen: { width: '100%', maxWidth: tokens.layout.readable, alignSelf: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...tokens.type.display, color: tokens.color.textPrimary, flexShrink: 1 },
  paneTitle: { ...tokens.type.label, color: tokens.color.textSupport, textTransform: 'uppercase' },
  search: {
    ...tokens.type.support,
    color: tokens.color.textPrimary,
    backgroundColor: tokens.color.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.color.cardBorder,
    borderRadius: tokens.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 40,
  },
  searchScreen: { minHeight: 54, paddingHorizontal: tokens.space.md },
  list: { paddingHorizontal: 12, paddingBottom: tokens.space.md, gap: 7 },
  listScreen: {
    paddingHorizontal: tokens.space.md,
    gap: tokens.space.sm,
    width: '100%',
    maxWidth: tokens.layout.readable,
    alignSelf: 'center',
  },
  section: {
    ...tokens.type.labelSmall,
    color: tokens.color.textGhost,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 4,
  },
  empty: {
    ...tokens.type.body,
    color: tokens.color.textSupport,
    paddingHorizontal: tokens.space.md,
  },
  /** A pane keeps "new meal" at the foot, where the eye lands after the list. */
  footer: {
    borderTopWidth: 1,
    borderTopColor: tokens.color.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: tokens.space.md,
  },
  footerText: { ...tokens.type.support, fontWeight: '600', color: tokens.color.action },
})

type Props = {
  readonly meals: readonly Meal[]
  readonly layout?: LibraryLayout
  readonly onSelect?: ((id: MealId) => void) | undefined
  readonly onAdd?: (() => void) | undefined
}

export const MealLibraryScreen = ({
  meals,
  layout = 'screen',
  onSelect,
  onAdd,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const isPane = layout === 'pane'

  const { ours, catalogue } = useMemo(() => partitionMeals(meals, query), [meals, query])

  const detailFor = (meal: Meal): string =>
    isCatalogueMeal(meal) && meal.ingredientCount === 0
      ? t('picker.catalogueHint')
      : t('meal.servesCount', { count: meal.servings })

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
        compact={isPane}
        isCatalogue={isCatalogueMeal(meal)}
        detail={detailFor(meal)}
      />
    </Pressable>
  )

  return (
    <View
      style={[
        isPane ? styles.pane : styles.screen,
        !isPane && { paddingTop: insets.top + tokens.space.md },
      ]}
      testID="meal-library-screen"
    >
      <View style={[styles.head, !isPane && styles.headScreen]}>
        {isPane ? (
          <Text style={styles.paneTitle}>{t('meal.libraryPane')}</Text>
        ) : (
          <View style={styles.headRow}>
            <Text style={styles.title}>{t('meal.library')}</Text>
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={t('meal.add')}
              testID="library-add"
            >
              <Text style={styles.footerText}>{t('board.newMeal')}</Text>
            </Pressable>
          </View>
        )}

        <TextInput
          style={[styles.search, !isPane && styles.searchScreen]}
          value={query}
          onChangeText={setQuery}
          placeholder={t('picker.search')}
          placeholderTextColor={tokens.color.textGhost}
          autoCapitalize="none"
          accessibilityLabel={t('picker.search')}
          testID="library-search"
        />
      </View>

      <ScrollView contentContainerStyle={isPane ? styles.list : styles.listScreen}>
        {meals.length === 0 ? (
          <Text style={styles.empty} testID="library-empty">
            {t('meal.emptyLibrary')}
          </Text>
        ) : (
          <>
            {ours.length > 0 && (
              <>
                <Text style={styles.section}>{t('picker.oursCount', { count: ours.length })}</Text>
                {ours.map(renderMeal)}
              </>
            )}
            {catalogue.length > 0 && (
              <>
                <Text style={styles.section}>{t('picker.catalogue')}</Text>
                {catalogue.map(renderMeal)}
              </>
            )}
          </>
        )}
      </ScrollView>

      {isPane && (
        <Pressable
          style={styles.footer}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('meal.add')}
          testID="library-add"
        >
          <Text style={styles.footerText}>{t('board.newMeal')}</Text>
        </Pressable>
      )}
    </View>
  )
}
