import { useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { brand } from '@/shared/types/brand'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import type { Servings } from '@/features/meals'
import { ServingsStepper } from './ServingsStepper'

const sheets = themed((tokens) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: tokens.space.lg,
      paddingBottom: tokens.space.lg,
      gap: tokens.space.lg,
    },
    title: { ...tokens.type.mealName, color: tokens.color.textPrimary },
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
    <Sheet
      visible
      onDismiss={onDismiss}
      dismissLabel={t('plan.cancel')}
      contentStyle={styles.content}
      testID="servings-sheet"
    >
      <Text style={styles.title}>{t('cookEvent.servingsTitle', { meal: mealName })}</Text>
      <ServingsStepper servings={servings} onChange={setServings} testID="servings" />
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
    </Sheet>
  )
}
