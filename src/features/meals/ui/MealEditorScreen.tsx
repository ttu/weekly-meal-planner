import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaPadding } from '@/shared/theme/safe-area-padding'
import { brand } from '@/shared/types/brand'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import { isOk } from '@/shared/types/result'
import { defaultAmountFor, parseQuantity } from '@/shared/units'
import { ConfirmSheet } from '@/shared/ui/ConfirmSheet'
import { IngredientPicker } from './IngredientPicker'
import { IngredientRow } from './IngredientRow'
import { pickPhotoFromLibrary, type PickPhoto } from '../infrastructure/photo-picker'
import type { Ingredient, IngredientId, Servings } from '../domain/types'
import type { MealDraft } from '../domain/meal-draft'
import type { PhotoChange } from '../application/save-meal-photo'
import type { EditorError } from './useSaveMeal'

const sheets = themed((tokens) =>
  StyleSheet.create({
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
    saveText: { ...tokens.type.mealName, color: tokens.color.onAction },
    photoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.space.md,
      marginBottom: tokens.space.lg,
    },
    /** Bigger than the 46px chip on a card, because this is where you judge
     *  whether the picture is the right one. */
    photo: { width: 72, height: 72, borderRadius: tokens.radius.md },
    photoEmpty: {
      backgroundColor: tokens.color.surfaceInset,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoInitial: { ...tokens.type.display, color: tokens.color.textGhost },
    photoActions: { flexDirection: 'row', gap: tokens.space.lg, flex: 1 },
    photoAction: { minHeight: 54, justifyContent: 'center' },
    noIngredients: { paddingVertical: tokens.space.sm },
    addIngredient: { minHeight: 54, justifyContent: 'center', marginBottom: tokens.space.lg },
    delete: {
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: tokens.space.lg,
    },
  }),
)

const errorKey = (error: EditorError): string => {
  if (error === 'name-required') return 'meal.nameRequired'
  if (error === 'photo-failed') return 'meal.photoFailed'
  return 'meal.saveFailed'
}

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
  /** What a Meal starts at when `initial` has no servings of its own: the
   *  Household's size for a new one. Required, so no caller falls back to a
   *  number the editor invented. */
  readonly defaultServings: Servings
  readonly ingredients: readonly Ingredient[]
  /** A Catalogue Meal is read-only through the client; the editor offers to
   *  copy it instead (ADR 0005). */
  readonly isReadOnly?: boolean | undefined
  readonly plannedCount?: number | undefined
  readonly onCopy?: (() => void) | undefined
  readonly onDelete?: (() => void) | undefined
  readonly isPending: boolean
  readonly error?: EditorError | undefined
  /** What the Meal already has — a signed URL, not a path. */
  readonly photoUrl?: string | undefined
  /** The device dialog, injected so a test can answer without one. */
  readonly pickPhoto?: PickPhoto
  readonly onSave: (draft: MealDraft, photo: PhotoChange) => void
  readonly onCancel: () => void
}

/** What the editor shows: the picture just picked, nothing if it was cleared,
 *  and otherwise whatever the Meal already had. */
const shownPhotoFor = (photo: PhotoChange, saved: string | undefined): string | undefined => {
  if (photo.kind === 'picked') return photo.uri
  if (photo.kind === 'cleared') return undefined
  return saved
}

export const MealEditorScreen = ({
  initial,
  defaultServings,
  ingredients,
  isPending,
  error,
  photoUrl,
  pickPhoto = pickPhotoFromLibrary,
  isReadOnly = false,
  plannedCount = 0,
  onCopy,
  onDelete,
  onSave,
  onCancel,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const formStyles = useFormStyles()
  const { t } = useTranslation()
  const contentPadding = useSafeAreaPadding({ top: tokens.space.md })
  const [name, setName] = useState(initial?.name ?? '')
  const [servings, setServings] = useState<number>(initial?.servings ?? defaultServings)
  const [entries, setEntries] = useState<readonly IngredientEntry[]>(
    initial?.ingredients.map((i) => ({
      ingredientId: i.ingredientId,
      quantityText: String(i.quantity),
      unit: i.unit,
    })) ?? [],
  )
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'unchanged' })
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  const shownPhoto = shownPhotoFor(photo, photoUrl)

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
      contentContainerStyle={[formStyles.content, contentPadding]}
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

      <Text style={formStyles.label}>{t('meal.photo')}</Text>
      <View style={styles.photoRow}>
        {shownPhoto === undefined ? (
          <View style={[styles.photo, styles.photoEmpty]} testID="editor-photo-empty">
            <Text style={styles.photoInitial}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
          </View>
        ) : (
          <Image
            style={styles.photo}
            source={{ uri: shownPhoto }}
            accessibilityLabel={t('meal.photo')}
            testID="editor-photo"
          />
        )}

        {!isReadOnly && (
          <View style={styles.photoActions}>
            <Pressable
              style={styles.photoAction}
              disabled={isPending}
              onPress={() => {
                void pickPhoto().then((picked) => {
                  if (picked === undefined) return
                  setPhoto({ kind: 'picked', uri: picked.uri, contentType: picked.contentType })
                })
              }}
              accessibilityRole="button"
              accessibilityLabel={
                shownPhoto === undefined ? t('meal.addPhoto') : t('meal.replacePhoto')
              }
              testID="editor-pick-photo"
            >
              <Text style={formStyles.quietAction}>
                {shownPhoto === undefined ? t('meal.addPhoto') : t('meal.replacePhoto')}
              </Text>
            </Pressable>

            {shownPhoto !== undefined && (
              <Pressable
                style={styles.photoAction}
                disabled={isPending}
                onPress={() => {
                  setPhoto({ kind: 'cleared' })
                }}
                accessibilityRole="button"
                accessibilityLabel={t('meal.removePhoto')}
                testID="editor-remove-photo"
              >
                <Text style={formStyles.quietAction}>{t('meal.removePhoto')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

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
          const amount = defaultAmountFor(ingredient?.dimension ?? 'count')
          setEntries((current) => [
            ...current,
            { ingredientId, quantityText: String(amount.quantity), unit: amount.unit },
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
            onSave(
              {
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
              },
              photo,
            )
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
