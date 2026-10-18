import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { brand } from '@/shared/types/brand'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'
import type { Servings } from '@/features/meals'

const sheets = themed((tokens) =>
  StyleSheet.create({
    /** The part of the backdrop above the sheet: pressing it closes. */
    dismiss: { flex: 1 },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: tokens.color.scrim },
    sheet: {
      backgroundColor: tokens.color.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: tokens.space.lg,
      gap: tokens.space.lg,
    },
    title: { ...tokens.type.mealName, color: tokens.color.textPrimary },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
    stepper: {
      width: 54,
      height: 54,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tokens.color.rule,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.color.surfaceRaised,
    },
    sign: { ...tokens.type.mealNameLarge, color: tokens.color.textPrimary },
    value: {
      ...tokens.type.dayHeading,
      color: tokens.color.textPrimary,
      minWidth: 48,
      textAlign: 'center',
    },
    save: {
      minHeight: 54,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.color.action,
    },
    saveText: { ...tokens.type.mealName, color: tokens.color.onAction },
  }),
)

/** One tap, one serving, between one and fifty. */
const Stepper = ({
  servings,
  onChange,
}: {
  readonly servings: number
  readonly onChange: (next: (current: number) => number) => void
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.stepperRow}>
      <Pressable
        style={styles.stepper}
        onPress={() => {
          onChange((n) => Math.max(1, n - 1))
        }}
        accessibilityRole="button"
        accessibilityLabel={t('plan.cookingFor')}
        testID="servings-down"
      >
        <Text style={styles.sign}>−</Text>
      </Pressable>
      <Text style={styles.value} testID="servings-value">
        {String(servings)}
      </Text>
      <Pressable
        style={styles.stepper}
        onPress={() => {
          onChange((n) => Math.min(50, n + 1))
        }}
        accessibilityRole="button"
        accessibilityLabel={t('plan.cookingFor')}
        testID="servings-up"
      >
        <Text style={styles.sign}>+</Text>
      </Pressable>
    </View>
  )
}

type Props = {
  readonly mealName: string
  readonly servingsCooked: Servings
  readonly onSave: (servingsCooked: Servings) => void
  readonly onDismiss: () => void
}

/**
 * Changing Servings Cooked on a Meal already on the board.
 *
 * The same stepper the plan sheet uses, on its own, because this is the edit a
 * week needs most often and the only route to it used to be unplanning the
 * Meal and planning it again. Servings Cooked scales the Shopping List, so
 * this is the amount bought.
 */
export const ServingsSheet = ({
  mealName,
  servingsCooked,
  onSave,
  onDismiss,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const [servings, setServings] = useState<number>(servingsCooked)

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dismiss}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('plan.cancel')}
        />
        <View style={styles.sheet} testID="servings-sheet">
          <Text style={styles.title}>{t('cookEvent.servingsTitle', { meal: mealName })}</Text>
          <Stepper servings={servings} onChange={setServings} />
          <Pressable
            style={styles.save}
            onPress={() => {
              onSave(brand<number, 'Servings'>(servings))
            }}
            accessibilityRole="button"
            accessibilityLabel={t('cookEvent.servingsSave')}
            testID="servings-save"
          >
            <Text style={styles.saveText}>{t('cookEvent.servingsSave')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
