import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import type { IngredientId } from '@/shared/types/ids'
import { countMealsBehind, groupBuyLines } from '../domain/group'
import type { BuyLine, ExtraId, ShoppingList } from '../domain/types'

/**
 * Row ergonomics are requirements, not styling: 19px text, 28px checkbox, 54px
 * minimum height, and the whole row is the target. This list is read one-handed
 * in a shop, sometimes with gloves on.
 *
 * Ticked items grey and strike but stay in place, so the list never reflows
 * under a moving thumb.
 */
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.color.surface },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: tokens.space.lg, gap: 20 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: tokens.space.sm,
  },
  title: { ...tokens.type.display, color: tokens.color.textPrimary },
  summary: { ...tokens.type.support, color: tokens.color.textSupport },
  share: { ...tokens.type.body, fontWeight: '600', color: tokens.color.action },
  section: { gap: 9 },
  /** A section head is a label, a hairline, and — for Buy — the category the
   *  card below belongs to, right-aligned where the eye leaves the row. */
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionLabel: {
    ...tokens.type.label,
    fontWeight: '700',
    color: tokens.color.textPrimary,
    textTransform: 'uppercase',
  },
  hairline: { flex: 1, height: 1, backgroundColor: tokens.color.cardBorder },
  category: { ...tokens.type.meta, color: tokens.color.textSupport },
  card: {
    backgroundColor: tokens.color.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.color.cardBorder,
    borderRadius: tokens.radius.card,
    overflow: 'hidden',
  },
  cupboardCard: {
    backgroundColor: tokens.color.surfaceInset,
    borderRadius: tokens.radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 54,
    paddingVertical: 15,
    paddingHorizontal: tokens.space.md,
  },
  divided: { borderBottomWidth: 1, borderBottomColor: tokens.color.cardDivider },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.sm,
    borderWidth: 2,
    borderColor: tokens.color.dashed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: tokens.color.affirm, borderColor: tokens.color.affirm },
  tick: { ...tokens.type.mealNameSmall, color: tokens.color.surfaceRaised },
  labelBlock: { flex: 1, gap: 2 },
  label: { ...tokens.type.shoppingRow, color: tokens.color.textPrimary },
  labelChecked: { color: tokens.color.textGhost, textDecorationLine: 'line-through' },
  amount: { ...tokens.type.shoppingRow, color: tokens.color.textMuted },
  amountChecked: { color: '#C0B7A4' },
  /** A hand-set amount keeps a terracotta underline and a one-line reason, so
   *  nobody wonders why the maths looks wrong. */
  amountOverridden: {
    color: tokens.color.textPrimary,
    fontWeight: '600',
    borderBottomWidth: 2,
    borderBottomColor: tokens.color.action,
  },
  noteAction: { ...tokens.type.meta, color: tokens.color.action },
  noteAffirm: { ...tokens.type.meta, color: tokens.color.affirm },
  chevron: { ...tokens.type.mealName, fontWeight: '400', color: tokens.color.textGhost },
  /** "Why four onions?" expands in place, on a tinted ground inside the card. */
  provenance: {
    backgroundColor: tokens.color.surfacePane,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.cardDivider,
    paddingTop: 12,
    paddingRight: tokens.space.md,
    paddingBottom: 14,
    paddingLeft: 58,
    gap: 6,
  },
  provenanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  provenanceText: { ...tokens.type.body, color: tokens.color.textMuted },
  cupboardLabel: { ...tokens.type.mealNameLarge, fontWeight: '400', color: '#5F584C', flex: 1 },
  outOf: {
    borderWidth: 1,
    borderColor: tokens.color.action,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: tokens.space.sm,
  },
  outOfText: { ...tokens.type.body, fontWeight: '600', color: tokens.color.action },
  incomplete: { ...tokens.type.body, color: tokens.color.action },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: tokens.space.md,
  },
  addBox: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.color.dashed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSign: { ...tokens.type.meta, color: tokens.color.textGhost },
  addInput: {
    ...tokens.type.mealNameLarge,
    fontWeight: '400',
    color: tokens.color.textPrimary,
    flex: 1,
  },
  /** The action bar is pinned: the prompt is copied at the door of the shop,
   *  not after scrolling back up past forty rows. */
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.color.cardBorder,
    backgroundColor: tokens.color.surfaceRaised,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  copy: {
    flex: 1,
    backgroundColor: tokens.color.action,
    borderRadius: tokens.radius.card,
    paddingVertical: 17,
    alignItems: 'center',
  },
  copyPressed: { backgroundColor: tokens.color.actionPressed },
  copyText: { ...tokens.type.mealName, color: tokens.color.surfaceRaised },
  empty: { ...tokens.type.body, color: tokens.color.textSupport },
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

  const unitLabel = (unit: string): string => t(`unit.${unit}`)
  const groups = useMemo(() => groupBuyLines(list.buy), [list.buy])
  const mealCount = useMemo(() => countMealsBehind(list.buy), [list.buy])

  const isEmpty =
    list.buy.length === 0 && list.cupboard.length === 0 && list.incomplete.length === 0

  const buyRow = (line: BuyLine, isLast: boolean): React.JSX.Element => (
    <View key={line.ingredientId}>
      <Pressable
        style={[styles.row, !isLast && styles.divided]}
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

        <View style={styles.labelBlock}>
          <Text style={[styles.label, line.checked && styles.labelChecked]}>{line.name}</Text>
          {line.promotedFromCupboard && (
            <Text style={styles.noteAffirm} testID={`promoted-${line.ingredientId}`}>
              {t('shopping.promoted')}
            </Text>
          )}
          {line.isOverridden && (
            <Text style={styles.noteAction}>{line.overrideReason ?? t('shopping.overridden')}</Text>
          )}
        </View>

        <Text
          style={[
            styles.amount,
            line.checked && styles.amountChecked,
            line.isOverridden && styles.amountOverridden,
          ]}
        >
          {formatAmounts(line, unitLabel)}
        </Text>

        {line.contributions.length > 0 && (
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
            <Text style={styles.chevron}>{expanded === line.ingredientId ? '⌃' : '⌄'}</Text>
          </Pressable>
        )}
      </Pressable>

      {expanded === line.ingredientId && (
        <View style={styles.provenance} testID={`provenance-${line.ingredientId}`}>
          {line.contributions.map((c, index) => (
            <View key={`${c.mealName}-${String(index)}`} style={styles.provenanceRow}>
              <Text style={styles.provenanceText}>{c.mealName}</Text>
              <Text style={styles.provenanceText}>
                {String(c.quantity)} {unitLabel(c.unit)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )

  return (
    <View style={styles.page} testID="shopping-screen">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + tokens.space.md }]}
      >
        <View style={styles.head}>
          <View>
            <Text style={styles.title}>{t('shopping.title')}</Text>
            <Text style={styles.summary} testID="shopping-summary">
              {t('shopping.summaryMeals', { count: list.buy.length, meals: mealCount })}
            </Text>
          </View>
        </View>

        {isEmpty && (
          <Text style={styles.empty} testID="shopping-empty">
            {t('shopping.empty')}
          </Text>
        )}

        {groups.length > 0 && (
          <View style={styles.section}>
            {groups.map((group, groupIndex) => (
              <View key={group.category} style={styles.section}>
                <View style={styles.sectionHead}>
                  {groupIndex === 0 && <Text style={styles.sectionLabel}>{t('shopping.buy')}</Text>}
                  <View style={styles.hairline} />
                  <Text style={styles.category}>{t(`category.${group.category}`)}</Text>
                </View>
                <View style={styles.card}>
                  {group.lines.map((line, index) => buyRow(line, index === group.lines.length - 1))}
                </View>
              </View>
            ))}
          </View>
        )}

        {list.incomplete.length > 0 && (
          <View style={styles.section}>
            {list.incomplete.map((meal) => (
              <Text
                key={meal.mealId}
                style={styles.incomplete}
                testID={`incomplete-${meal.mealId}`}
              >
                {t('shopping.incomplete', { meal: meal.mealName })}
              </Text>
            ))}
          </View>
        )}

        {list.cupboard.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>{t('shopping.cupboard')}</Text>
              <View style={styles.hairline} />
            </View>
            <View style={styles.cupboardCard}>
              {list.cupboard.map((line, index) => (
                <View
                  key={line.ingredientId}
                  style={[styles.row, index < list.cupboard.length - 1 && styles.divided]}
                >
                  <Text style={styles.cupboardLabel}>{line.name}</Text>
                  <Pressable
                    style={styles.outOf}
                    onPress={() => {
                      onOutOf(line.ingredientId)
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('shopping.outOf')} ${line.name}`}
                    testID={`out-of-${line.ingredientId}`}
                  >
                    <Text style={styles.outOfText}>{t('shopping.outOf')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>{t('shopping.extras')}</Text>
            <View style={styles.hairline} />
          </View>
          <View style={styles.card}>
            {list.extras.map((extra) => (
              <Pressable
                key={extra.id}
                style={[styles.row, styles.divided]}
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
                <Text style={[styles.label, extra.checked && styles.labelChecked]}>
                  {extra.label}
                </Text>
              </Pressable>
            ))}

            <View style={styles.addRow}>
              <View style={styles.addBox}>
                <Text style={styles.addSign}>+</Text>
              </View>
              <TextInput
                style={styles.addInput}
                value={extraLabel}
                onChangeText={setExtraLabel}
                onSubmitEditing={() => {
                  onAddExtra(extraLabel)
                  setExtraLabel('')
                }}
                placeholder={t('shopping.addExtra')}
                placeholderTextColor={tokens.color.textGhost}
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
                <Text style={styles.noteAction}>{t('shopping.addExtra')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + tokens.space.lg }]}>
        <Pressable
          style={({ pressed }) => [styles.copy, pressed && styles.copyPressed]}
          onPress={onCopyPrompt}
          accessibilityRole="button"
          accessibilityLabel={t('shopping.copyPrompt')}
          testID="copy-prompt"
        >
          <Text style={styles.copyText}>
            {justCopied ? t('shopping.copied') : t('shopping.copyPrompt')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
