import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { formStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import type { IngredientId } from '@/shared/types/ids'
import type { BuyLine, ExtraId, ShoppingList } from '../domain/types'

/**
 * Row ergonomics are requirements, not styling: 19px text, 28px checkbox, 54px
 * minimum height, and the whole row is the target. This list is read one-handed
 * in a shop, sometimes with gloves on.
 */
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    minHeight: 54,
    paddingVertical: tokens.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.rule,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tokens.color.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: tokens.color.affirm, borderColor: tokens.color.affirm },
  tick: { ...tokens.type.body, color: tokens.color.surfaceRaised },
  label: { ...tokens.type.shoppingRow, color: tokens.color.textPrimary, flex: 1 },
  labelChecked: { color: tokens.color.textMuted, textDecorationLine: 'line-through' },
  amount: { ...tokens.type.shoppingRow, color: tokens.color.textPrimary },
  note: { ...tokens.type.body, color: tokens.color.textMuted },
  overridden: { textDecorationLine: 'underline', textDecorationColor: tokens.color.action },
  cupboardRow: { backgroundColor: tokens.color.surfaceInset, paddingHorizontal: tokens.space.sm },
  why: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
  provenance: {
    backgroundColor: tokens.color.surfaceInset,
    padding: tokens.space.md,
    borderRadius: 8,
    gap: tokens.space.xs,
  },
  incomplete: { ...tokens.type.body, color: tokens.color.action, paddingVertical: tokens.space.sm },
  addRow: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'center' },
  footer: { gap: tokens.space.sm, paddingVertical: tokens.space.lg },
})

const formatAmounts = (line: BuyLine, unitLabel: (unit: string) => string): string =>
  line.amounts.map((a) => `${String(a.quantity)} ${unitLabel(a.unit)}`).join(' + ')

type Props = {
  readonly list: ShoppingList
  readonly onToggle: (id: IngredientId, checked: boolean) => void
  readonly onOutOf: (id: IngredientId) => void
  readonly onAddExtra: (label: string) => void
  readonly onToggleExtra: (id: ExtraId, checked: boolean) => void
  readonly onCopyPrompt: () => void
  readonly justCopied: boolean
}

export const ShoppingListScreen = ({
  list,
  onToggle,
  onOutOf,
  onAddExtra,
  onToggleExtra,
  onCopyPrompt,
  justCopied,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [expanded, setExpanded] = useState<IngredientId | undefined>(undefined)
  const [extraLabel, setExtraLabel] = useState('')

  // Units are stable keys in the database, translated only where they are read.
  const unitLabel = (unit: string): string => t(`unit.${unit}`)

  const isEmpty =
    list.buy.length === 0 && list.cupboard.length === 0 && list.incomplete.length === 0

  return (
    <ScrollView
      style={formStyles.screen}
      contentContainerStyle={{ paddingTop: insets.top + tokens.space.md }}
      testID="shopping-screen"
    >
      <Text style={formStyles.title}>{t('shopping.title')}</Text>
      <Text style={formStyles.muted} testID="shopping-summary">
        {t('shopping.summary', { count: list.buy.length })}
      </Text>

      {isEmpty && (
        <Text style={formStyles.muted} testID="shopping-empty">
          {t('shopping.empty')}
        </Text>
      )}

      {list.buy.length > 0 && <Text style={formStyles.section}>{t('shopping.buy')}</Text>}
      {list.buy.map((line) => (
        <View key={line.ingredientId}>
          <Pressable
            style={styles.row}
            onPress={() => {
              onToggle(line.ingredientId, !line.checked)
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: line.checked }}
            accessibilityLabel={`${line.name} ${formatAmounts(line, unitLabel)}`}
            testID={`buy-${line.ingredientId}`}
          >
            <View style={[styles.checkbox, line.checked && styles.checkboxOn]}>
              {line.checked && <Text style={styles.tick}>✓</Text>}
            </View>
            <Text style={[styles.label, line.checked && styles.labelChecked]}>{line.name}</Text>
            <Text style={[styles.amount, line.isOverridden && styles.overridden]}>
              {formatAmounts(line, unitLabel)}
            </Text>
          </Pressable>

          {line.promotedFromCupboard && (
            <Text style={styles.note} testID={`promoted-${line.ingredientId}`}>
              {t('shopping.promoted')}
            </Text>
          )}
          {line.isOverridden && (
            <Text style={styles.note}>{line.overrideReason ?? t('shopping.overridden')}</Text>
          )}

          <Pressable
            onPress={() => {
              setExpanded((current) =>
                current === line.ingredientId ? undefined : line.ingredientId,
              )
            }}
            accessibilityRole="button"
            accessibilityLabel={t('shopping.why')}
            testID={`why-${line.ingredientId}`}
          >
            <Text style={styles.why}>{t('shopping.why')}</Text>
          </Pressable>

          {expanded === line.ingredientId && (
            <View style={styles.provenance} testID={`provenance-${line.ingredientId}`}>
              {line.contributions.map((c, index) => (
                <Text key={`${c.mealName}-${String(index)}`} style={styles.note}>
                  {c.mealName} · {String(c.quantity)} {unitLabel(c.unit)}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}

      {list.incomplete.map((meal) => (
        <Text key={meal.mealId} style={styles.incomplete} testID={`incomplete-${meal.mealId}`}>
          {t('shopping.incomplete', { meal: meal.mealName })}
        </Text>
      ))}

      {list.cupboard.length > 0 && <Text style={formStyles.section}>{t('shopping.cupboard')}</Text>}
      {list.cupboard.map((line) => (
        <View key={line.ingredientId} style={[styles.row, styles.cupboardRow]}>
          <Text style={styles.label}>{line.name}</Text>
          <Pressable
            onPress={() => {
              onOutOf(line.ingredientId)
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('shopping.outOf')} ${line.name}`}
            testID={`out-of-${line.ingredientId}`}
          >
            <Text style={styles.why}>{t('shopping.outOf')}</Text>
          </Pressable>
        </View>
      ))}

      <Text style={formStyles.section}>{t('shopping.extras')}</Text>
      {list.extras.map((extra) => (
        <Pressable
          key={extra.id}
          style={styles.row}
          onPress={() => {
            onToggleExtra(extra.id, !extra.checked)
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: extra.checked }}
          accessibilityLabel={extra.label}
          testID={`extra-${extra.id}`}
        >
          <View style={[styles.checkbox, extra.checked && styles.checkboxOn]}>
            {extra.checked && <Text style={styles.tick}>✓</Text>}
          </View>
          <Text style={[styles.label, extra.checked && styles.labelChecked]}>{extra.label}</Text>
        </Pressable>
      ))}

      <View style={styles.addRow}>
        <TextInput
          style={[formStyles.field, { flex: 1 }]}
          value={extraLabel}
          onChangeText={setExtraLabel}
          placeholder={t('shopping.extraPlaceholder')}
          placeholderTextColor={tokens.color.textMuted}
          accessibilityLabel={t('shopping.addExtra')}
          testID="extra-input"
        />
        <Pressable
          onPress={() => {
            onAddExtra(extraLabel)
            setExtraLabel('')
          }}
          accessibilityRole="button"
          accessibilityLabel={t('shopping.addExtra')}
          testID="extra-add"
        >
          <Text style={styles.why}>{t('shopping.addExtra')}</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={formStyles.primary}
          onPress={onCopyPrompt}
          accessibilityRole="button"
          accessibilityLabel={t('shopping.copyPrompt')}
          testID="copy-prompt"
        >
          <Text style={formStyles.primaryText}>
            {justCopied ? t('shopping.copied') : t('shopping.copyPrompt')}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
