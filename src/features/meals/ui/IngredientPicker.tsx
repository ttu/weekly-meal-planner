import { useMemo, useState } from 'react'
import { Modal, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import { matchesSearch } from '../domain/search'
import type { Ingredient, IngredientId } from '../domain/types'

const sheets = themed((tokens) =>
  StyleSheet.create({
    row: {
      borderBottomWidth: 1,
      borderBottomColor: tokens.color.rule,
      paddingVertical: tokens.space.md,
      minHeight: 54,
      justifyContent: 'center',
    },
    name: { ...tokens.type.body, color: tokens.color.textPrimary },
  }),
)

type Props = {
  readonly visible: boolean
  readonly ingredients: readonly Ingredient[]
  readonly onSelect: (id: IngredientId) => void
  readonly onDismiss: () => void
}

/**
 * Selects an existing Ingredient by id. It deliberately cannot create one from
 * typed text: that is how `sipuli` and `onion` become two Ingredients and the
 * Shopping List splits into two wrong Buy Lines (ADR 0009). Creating a new
 * Household Ingredient is a separate, deliberate action with its own slug.
 */
export const IngredientPicker = ({
  visible,
  ingredients,
  onSelect,
  onDismiss,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  const formStyles = useFormStyles()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')

  const grouped = useMemo(() => {
    const matching = ingredients.filter((i) => matchesSearch(i.name, query))
    const byCategory = new Map<string, Ingredient[]>()
    for (const ingredient of matching) {
      const bucket = byCategory.get(ingredient.category) ?? []
      bucket.push(ingredient)
      byCategory.set(ingredient.category, bucket)
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, data]) => ({ category, data }))
  }, [ingredients, query])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View
        style={[formStyles.screen, { paddingTop: insets.top + tokens.space.md }]}
        testID="ingredient-picker"
      >
        <View style={formStyles.header}>
          <Text style={formStyles.title}>{t('ingredient.pick')}</Text>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('picker.cancel')}
            testID="ingredient-picker-cancel"
          >
            <Text style={formStyles.quietAction}>{t('picker.cancel')}</Text>
          </Pressable>
        </View>

        <TextInput
          style={formStyles.field}
          value={query}
          onChangeText={setQuery}
          placeholder={t('ingredient.search')}
          placeholderTextColor={theme.color.textMuted}
          autoCapitalize="none"
          accessibilityLabel={t('ingredient.search')}
          testID="ingredient-search"
        />

        <SectionList
          sections={grouped}
          keyExtractor={(ingredient) => ingredient.id}
          renderSectionHeader={({ section }) => (
            <Text style={formStyles.section}>{t(`category.${section.category}`)}</Text>
          )}
          renderItem={({ item: ingredient }) => (
            <Pressable
              style={styles.row}
              onPress={() => {
                onSelect(ingredient.id)
              }}
              accessibilityRole="button"
              accessibilityLabel={ingredient.name}
              testID={`ingredient-option-${ingredient.slug}`}
            >
              <Text style={styles.name}>{ingredient.name}</Text>
            </Pressable>
          )}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <Text style={formStyles.muted} testID="ingredient-no-results">
              {t('ingredient.noResults')}
            </Text>
          }
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          windowSize={7}
        />
      </View>
    </Modal>
  )
}
