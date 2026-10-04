import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'
import { partitionMeals } from '../domain/partition'
import type { Meal, MealId } from '../domain/types'
import { MealCard } from './MealCard'

const sheets = themed((tokens) =>
  StyleSheet.create({
    sheet: { flex: 1, backgroundColor: tokens.color.surface, paddingHorizontal: tokens.space.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.space.md,
    },
    title: { ...tokens.type.display, color: tokens.color.textPrimary },
    cancel: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
    search: {
      ...tokens.type.body,
      color: tokens.color.textPrimary,
      backgroundColor: tokens.color.surfaceRaised,
      borderWidth: 1,
      borderColor: tokens.color.rule,
      borderRadius: 8,
      paddingHorizontal: tokens.space.md,
      minHeight: 54,
      marginBottom: tokens.space.md,
      /** The browser's own focus ring is blue, the one colour this palette
       *  does not contain; see src/types/react-native-web.d.ts. */
      outlineStyle: 'none',
    },
    section: {
      ...tokens.type.label,
      color: tokens.color.textMuted,
      textTransform: 'uppercase',
      marginTop: tokens.space.md,
      marginBottom: tokens.space.xs,
    },
    hint: {
      ...tokens.type.body,
      color: tokens.color.textMuted,
      paddingHorizontal: tokens.space.md,
      paddingBottom: tokens.space.sm,
    },
    empty: { ...tokens.type.body, color: tokens.color.textMuted, paddingVertical: tokens.space.lg },
  }),
)

type Props = {
  readonly visible: boolean
  readonly meals: readonly Meal[]
  readonly onSelect: (mealId: MealId) => void
  readonly onDismiss: () => void
}

export const MealPicker = ({ visible, meals, onSelect, onDismiss }: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')

  // Own Meals first: a family reaches for what they already cook far more often
  // than for the Catalogue.
  const { ours, catalogue } = useMemo(() => partitionMeals(meals, query), [meals, query])

  const nothingMatches = ours.length === 0 && catalogue.length === 0

  // Catalogue rows carry the copy-on-add hint rather than a badge repeating the
  // section heading above them (ADR 0005).
  const renderMeal = (meal: Meal, fromCatalogue: boolean): React.JSX.Element => {
    return (
      <Pressable
        key={meal.id}
        onPress={() => {
          onSelect(meal.id)
        }}
        accessibilityRole="button"
        accessibilityLabel={meal.name}
        testID={`picker-meal-${meal.id}`}
      >
        <MealCard name={meal.name} photoUrl={meal.photoUrl} variant="library" />
        {fromCatalogue && <Text style={styles.hint}>{t('picker.catalogueHint')}</Text>}
      </Pressable>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View
        style={[styles.sheet, { paddingTop: insets.top + tokens.space.md }]}
        testID="meal-picker"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('picker.title')}</Text>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('picker.cancel')}
            testID="picker-cancel"
          >
            <Text style={styles.cancel}>{t('picker.cancel')}</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t('picker.search')}
          placeholderTextColor={theme.color.textMuted}
          autoCapitalize="none"
          accessibilityLabel={t('picker.search')}
          testID="picker-search"
        />

        <ScrollView>
          {nothingMatches ? (
            <Text style={styles.empty} testID="picker-no-results">
              {t('picker.noResults')}
            </Text>
          ) : (
            <>
              {ours.length > 0 && (
                <>
                  <Text style={styles.section}>{t('picker.ours')}</Text>
                  {ours.map((meal) => renderMeal(meal, false))}
                </>
              )}
              {catalogue.length > 0 && (
                <>
                  <Text style={styles.section}>{t('picker.catalogue')}</Text>
                  {catalogue.map((meal) => renderMeal(meal, true))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}
