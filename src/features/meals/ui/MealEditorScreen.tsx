import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brand } from '@/shared/types/brand'
import { tokens } from '@/shared/theme/tokens'
import { formStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import { isOk } from '@/shared/types/result'
import { parseQuantity } from '@/shared/units'
import { ConfirmSheet } from '@/shared/ui/ConfirmSheet'
import { IngredientPicker } from './IngredientPicker'
import { IngredientRow } from './IngredientRow'
import type { Ingredient, IngredientId } from '../domain/types'
import type { MealDraft } from '../domain/meal-draft'
import type { SaveMealError } from '../application/save-meal'

const styles = StyleSheet.create({
  cancel: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    marginBottom: tokens.space.lg,
  },
  stepper: {
    borderWidth: 1,
    borderColor: tokens.color.rule,
    backgroundColor: tokens.color.surfaceRaised,
    borderRadius: 8,
    minHeight: 54,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { ...tokens.type.body, color: tokens.color.textPrimary },
  stepperValue: {
    ...tokens.type.display,
    color: tokens.color.textPrimary,
    minWidth: 48,
    textAlign: 'center',
  },
  save: {
    backgroundColor: tokens.color.action,
    borderRadius: 8,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.lg,
  },
  saveText: { ...tokens.type.mealName, color: tokens.color.surfaceRaised },
  noIngredients: { paddingVertical: tokens.space.sm },
  addIngredient: { minHeight: 54, justifyContent: 'center', marginBottom: tokens.space.lg },
  delete: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.lg,
  },
})

const errorKey = (error: SaveMealError): string =>
  error === 'name-required' ? 'meal.nameRequired' : 'meal.saveFailed'

/** The editor keeps quantities as text while typing: "0," is a legitimate
 *  intermediate state on a Finnish keyboard, and reformatting mid-keystroke is
 *  what makes a form feel hostile. */
type IngredientEntry = {
  readonly ingredientId: IngredientId
  readonly quantityText: string
  readonly unit: string
}

type Props = {
  readonly initial?: MealDraft | undefined
  readonly ingredients: readonly Ingredient[]
  /** A Catalogue Meal is read-only through the client; the editor offers to
   *  copy it instead (ADR 0005). */
  readonly isReadOnly?: boolean | undefined
  readonly plannedCount?: number | undefined
  readonly onCopy?: (() => void) | undefined
  readonly onDelete?: (() => void) | undefined
  readonly isPending: boolean
  readonly error?: SaveMealError | undefined
  readonly onSave: (draft: MealDraft) => void
  readonly onCancel: () => void
}

export const MealEditorScreen = ({
  initial,
  ingredients,
  isPending,
  error,
  isReadOnly = false,
  plannedCount = 0,
  onCopy,
  onDelete,
  onSave,
  onCancel,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [name, setName] = useState(initial?.name ?? '')
  const [servings, setServings] = useState<number>(initial?.servings ?? 4)
  const [entries, setEntries] = useState<readonly IngredientEntry[]>(
    initial?.ingredients.map((i) => ({
      ingredientId: i.ingredientId,
      quantityText: String(i.quantity),
      unit: i.unit,
    })) ?? [],
  )
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  const byId = new Map(ingredients.map((i) => [i.id, i]))
  const unpicked = ingredients.filter((i) => !entries.some((e) => e.ingredientId === i.id))

  const updateEntry = (id: IngredientId, patch: Partial<IngredientEntry>): void => {
    setEntries((current) =>
      current.map((entry) => (entry.ingredientId === id ? { ...entry, ...patch } : entry)),
    )
  }

  return (
    <ScrollView
      style={formStyles.screen}
      contentContainerStyle={[formStyles.content, { paddingTop: insets.top + tokens.space.md }]}
      testID="meal-editor-screen"
    >
      <View style={formStyles.header}>
        <Text style={formStyles.title}>
          {initial === undefined ? t('meal.new') : t('meal.edit')}
        </Text>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('picker.cancel')}
          testID="editor-cancel"
        >
          <Text style={styles.cancel}>{t('picker.cancel')}</Text>
        </Pressable>
      </View>

      <Text style={formStyles.label}>{t('meal.name')}</Text>
      <TextInput
        style={formStyles.field}
        value={name}
        onChangeText={setName}
        accessibilityLabel={t('meal.name')}
        testID="editor-name"
      />

      <Text style={formStyles.label}>{t('meal.servings')}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          style={styles.stepper}
          onPress={() => {
            setServings((n) => Math.max(1, n - 1))
          }}
          accessibilityRole="button"
          accessibilityLabel={t('meal.servings')}
          testID="editor-servings-down"
        >
          <Text style={styles.stepperText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue} testID="editor-servings">
          {String(servings)}
        </Text>
        <Pressable
          style={styles.stepper}
          onPress={() => {
            setServings((n) => Math.min(50, n + 1))
          }}
          accessibilityRole="button"
          accessibilityLabel={t('meal.servings')}
          testID="editor-servings-up"
        >
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
      </View>

      <Text style={formStyles.label}>{t('ingredient.heading')}</Text>

      {entries.length === 0 ? (
        <Text style={[formStyles.muted, styles.noIngredients]} testID="editor-no-ingredients">
          {t('ingredient.none')}
        </Text>
      ) : (
        entries.map((entry) => {
          const ingredient = byId.get(entry.ingredientId)
          if (ingredient === undefined) return null
          return (
            <IngredientRow
              key={entry.ingredientId}
              ingredient={ingredient}
              quantityText={entry.quantityText}
              unit={entry.unit}
              isQuantityValid={isOk(parseQuantity(entry.quantityText))}
              onQuantityChange={(quantityText) => {
                updateEntry(entry.ingredientId, { quantityText })
              }}
              onUnitChange={(unit) => {
                updateEntry(entry.ingredientId, { unit })
              }}
              onRemove={() => {
                setEntries((current) =>
                  current.filter((e) => e.ingredientId !== entry.ingredientId),
                )
              }}
            />
          )
        })
      )}

      <Pressable
        style={styles.addIngredient}
        onPress={() => {
          setPickerOpen(true)
        }}
        accessibilityRole="button"
        accessibilityLabel={t('ingredient.add')}
        testID="editor-add-ingredient"
      >
        <Text style={formStyles.quietAction}>{t('ingredient.add')}</Text>
      </Pressable>

      <IngredientPicker
        visible={isPickerOpen}
        ingredients={unpicked}
        onSelect={(ingredientId) => {
          const ingredient = byId.get(ingredientId)
          setEntries((current) => [
            ...current,
            { ingredientId, quantityText: '1', unit: ingredient?.baseUnit ?? 'g' },
          ])
          setPickerOpen(false)
        }}
        onDismiss={() => {
          setPickerOpen(false)
        }}
      />

      {error !== undefined && (
        <Text style={formStyles.error} testID="editor-error">
          {t(errorKey(error))}
        </Text>
      )}

      {isReadOnly && (
        <>
          <Text style={formStyles.muted} testID="editor-read-only">
            {t('meal.catalogueReadOnly')}
          </Text>
          <Pressable
            style={styles.save}
            onPress={onCopy}
            accessibilityRole="button"
            accessibilityLabel={t('meal.copy')}
            testID="editor-copy"
          >
            <Text style={styles.saveText}>{t('meal.copy')}</Text>
          </Pressable>
        </>
      )}

      {!isReadOnly && onDelete !== undefined && (
        <Pressable
          style={styles.delete}
          onPress={() => {
            setConfirmingDelete(true)
          }}
          accessibilityRole="button"
          accessibilityLabel={t('meal.delete')}
          testID="editor-delete"
        >
          <Text style={formStyles.quietAction}>{t('meal.delete')}</Text>
        </Pressable>
      )}

      <ConfirmSheet
        visible={isConfirmingDelete}
        message={t('meal.deleteConfirm', { meal: name })}
        detail={plannedCount > 0 ? t('meal.deletePlanned', { count: plannedCount }) : undefined}
        confirmLabel={t('meal.delete')}
        cancelLabel={t('unplan.confirmNo')}
        onConfirm={() => {
          setConfirmingDelete(false)
          onDelete?.()
        }}
        onCancel={() => {
          setConfirmingDelete(false)
        }}
      />

      {!isReadOnly && (
        <Pressable
          style={styles.save}
          disabled={isPending}
          onPress={() => {
            onSave({
              name,
              servings: brand<number, 'Servings'>(servings),
              // Rows with an unusable amount are dropped rather than blocking the
              // save; the row already shows why, and losing a whole edit to one
              // stray keystroke is worse.
              ingredients: entries.flatMap((entry) => {
                const quantity = parseQuantity(entry.quantityText)
                return isOk(quantity)
                  ? [
                      {
                        ingredientId: entry.ingredientId,
                        quantity: quantity.value,
                        unit: entry.unit,
                        optional: false,
                      },
                    ]
                  : []
              }),
            })
          }}
          accessibilityRole="button"
          accessibilityLabel={t('meal.save')}
          testID="editor-save"
        >
          <Text style={styles.saveText}>{t('meal.save')}</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}
