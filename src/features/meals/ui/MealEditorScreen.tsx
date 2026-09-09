import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brand } from '@/shared/types/brand'
import { tokens } from '@/shared/theme/tokens'
import { formStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
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
})

const errorKey = (error: SaveMealError): string =>
  error === 'name-required' ? 'meal.nameRequired' : 'meal.saveFailed'

type Props = {
  readonly initial?: MealDraft | undefined
  readonly isPending: boolean
  readonly error?: SaveMealError | undefined
  readonly onSave: (draft: MealDraft) => void
  readonly onCancel: () => void
}

export const MealEditorScreen = ({
  initial,
  isPending,
  error,
  onSave,
  onCancel,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [name, setName] = useState(initial?.name ?? '')
  const [servings, setServings] = useState<number>(initial?.servings ?? 4)

  return (
    <ScrollView
      style={formStyles.screen}
      contentContainerStyle={{ paddingTop: insets.top + tokens.space.md }}
      testID="meal-editor-screen"
    >
      <View style={formStyles.header}>
        <Text style={formStyles.title}>{t('meal.new')}</Text>
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

      {error !== undefined && (
        <Text style={formStyles.error} testID="editor-error">
          {t(errorKey(error))}
        </Text>
      )}

      <Pressable
        style={styles.save}
        disabled={isPending}
        onPress={() => {
          onSave({
            name,
            servings: brand<number, 'Servings'>(servings),
            ingredients: initial?.ingredients ?? [],
          })
        }}
        accessibilityRole="button"
        accessibilityLabel={t('meal.save')}
        testID="editor-save"
      >
        <Text style={styles.saveText}>{t('meal.save')}</Text>
      </Pressable>
    </ScrollView>
  )
}
