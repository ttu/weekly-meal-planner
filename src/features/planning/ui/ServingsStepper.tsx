import { Pressable, StyleSheet, Text, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'
import { MAX_SERVINGS } from '@/features/meals'

const sheets = themed((tokens) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    button: {
      width: 48,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tokens.color.cardBorder,
      backgroundColor: tokens.color.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sign: {
      fontFamily: tokens.type.body.fontFamily,
      fontSize: tokens.type.dayHeading.fontSize,
      color: tokens.color.textPrimary,
    },
    value: {
      fontFamily: tokens.type.mealName.fontFamily,
      fontSize: tokens.type.wordmark.fontSize,
      fontWeight: '600',
      color: tokens.color.textPrimary,
      minWidth: 28,
      textAlign: 'center',
    },
  }),
)

/** Servings Cooked, one tap one serving, between one and MAX_SERVINGS: a
 *  stepper rather than a keyboard, because this is the one number planning a
 *  week needs. Planning and changing a planned Meal share it. */
export const ServingsStepper = ({
  servings,
  onChange,
  testID,
}: {
  readonly servings: number
  readonly onChange: (next: (current: number) => number) => void
  /** The count's id; the buttons are `<testID>-down` and `<testID>-up`. */
  readonly testID: string
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.button}
        onPress={() => {
          onChange((n) => Math.max(1, n - 1))
        }}
        accessibilityRole="button"
        accessibilityLabel={t('meal.servingsFewer')}
        testID={`${testID}-down`}
      >
        <Text style={styles.sign}>−</Text>
      </Pressable>
      <Text style={styles.value} testID={testID}>
        {String(servings)}
      </Text>
      <Pressable
        style={styles.button}
        onPress={() => {
          onChange((n) => Math.min(MAX_SERVINGS, n + 1))
        }}
        accessibilityRole="button"
        accessibilityLabel={t('meal.servingsMore')}
        testID={`${testID}-up`}
      >
        <Text style={styles.sign}>+</Text>
      </Pressable>
    </View>
  )
}
