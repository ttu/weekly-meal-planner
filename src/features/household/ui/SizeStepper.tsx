import { Pressable, StyleSheet, Text, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'
import { MAX_SIZE, MIN_SIZE, stepSize } from '../domain/size'
import type { HouseholdSize } from '../domain/types'

type Props = {
  readonly size: HouseholdSize
  readonly disabled: boolean
  readonly onChange: (size: HouseholdSize) => void
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
    button: {
      borderWidth: 1,
      borderColor: tokens.color.rule,
      backgroundColor: tokens.color.surfaceRaised,
      borderRadius: tokens.radius.md,
      minHeight: 54,
      minWidth: 54,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spent: { opacity: 0.25 },
    glyph: { ...tokens.type.body, color: tokens.color.textPrimary },
    value: {
      ...tokens.type.display,
      color: tokens.color.textPrimary,
      minWidth: 48,
      textAlign: 'center',
    },
  }),
)

/** One more or one fewer: a count this small is quicker to tap than to type. */
export const SizeStepper = ({ size, disabled, onChange }: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const styles = useThemed(sheets)
  const atMin = size <= MIN_SIZE
  const atMax = size >= MAX_SIZE

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.button, atMin && styles.spent]}
        disabled={atMin || disabled}
        onPress={() => {
          onChange(stepSize(size, -1))
        }}
        accessibilityRole="button"
        accessibilityLabel={t('settings.sizeFewer')}
        testID="settings-size-less"
      >
        <Text style={styles.glyph}>−</Text>
      </Pressable>
      <Text style={styles.value} testID="settings-size-value">
        {String(size)}
      </Text>
      <Pressable
        style={[styles.button, atMax && styles.spent]}
        disabled={atMax || disabled}
        onPress={() => {
          onChange(stepSize(size, 1))
        }}
        accessibilityRole="button"
        accessibilityLabel={t('settings.sizeMore')}
        testID="settings-size-more"
      >
        <Text style={styles.glyph}>+</Text>
      </Pressable>
    </View>
  )
}
