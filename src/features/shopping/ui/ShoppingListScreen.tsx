import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'
import { useIsOnline } from '@/shared/net/useIsOnline'
import { BackLink } from '@/shared/ui/BackLink'
import { LoadError, Loading } from '@/shared/ui/LoadState'
import { Notice } from '@/shared/ui/Notice'
import type { LoadState } from '@/shared/query/load-state'
import type { IngredientId } from '@/shared/types/ids'
import { groupBuyLines } from '../domain/group'
import type { BuyLine, Extra, ExtraId, ShoppingList } from '../domain/types'

/**
 * Row ergonomics are requirements, not styling: 19px text, 28px checkbox, 54px
 * minimum height, and the whole row is the target. This list is read one-handed
 * in a shop, sometimes with gloves on.
 *
 * Ticked items grey and strike but stay in place, so the list never reflows
 * under a moving thumb.
 */
const sheets = themed((tokens) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: tokens.color.surface },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: 20,
      paddingBottom: tokens.space.lg,
      gap: 16,
      width: '100%',
      maxWidth: tokens.layout.readable,
      alignSelf: 'center',
    },
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
    tick: { ...tokens.type.mealNameSmall, color: tokens.color.onAction },
    labelBlock: { flex: 1, gap: 2 },
    label: { ...tokens.type.shoppingRow, color: tokens.color.textPrimary },
    labelChecked: { color: tokens.color.textGhost, textDecorationLine: 'line-through' },
    amount: { ...tokens.type.shoppingRow, color: tokens.color.textMuted },
    amountChecked: { color: tokens.color.textDone },
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
    provenanceAction: { paddingTop: tokens.space.sm },
    provenanceText: { ...tokens.type.body, color: tokens.color.textMuted },
    cupboardLabel: {
      ...tokens.type.mealNameLarge,
      fontWeight: '400',
      color: tokens.color.textMuted,
      flex: 1,
    },
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
      borderTopWidth: 1,
      borderTopColor: tokens.color.cardBorder,
      backgroundColor: tokens.color.surfaceRaised,
      alignItems: 'center',
    },
    barInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      maxWidth: tokens.layout.readable,
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
    /** An empty list has no prompt to hand anyone. */
    copyDisabled: { opacity: 0.4 },
    copyText: { ...tokens.type.mealName, color: tokens.color.onAction },
    empty: { ...tokens.type.body, color: tokens.color.textSupport },
    /** Said once, at the top, and never in place of the list itself: the rows
     *  still work offline because the writes are optimistic. */
    offline: {
      backgroundColor: tokens.color.surfaceInset,
      borderRadius: tokens.radius.md,
      paddingVertical: tokens.space.sm,
      paddingHorizontal: tokens.space.md,
      marginBottom: tokens.space.md,
    },
    offlineText: { ...tokens.type.meta, color: tokens.color.textMuted },
    /** A full-width target: this is pressed with a thumb, in a shop. */
    tickedToggle: {
      minHeight: 44,
      justifyContent: 'center',
      paddingVertical: tokens.space.sm,
      marginTop: tokens.space.sm,
    },
    tickedToggleText: {
      ...tokens.type.label,
      color: tokens.color.action,
      textTransform: 'uppercase',
    },
  }),
)

const formatAmounts = (line: BuyLine, unitLabel: (unit: string) => string): string =>
  line.amounts.map((a) => `${String(a.quantity)} ${unitLabel(a.unit)}`).join(' + ')

type Props = {
  readonly list: ShoppingList
  readonly onToggle: (id: IngredientId, checked: boolean) => void
  readonly onOutOf: (id: IngredientId) => void
  /** "We always have this in": the Ingredient joins the Cupboard Check. */
  readonly onKeepInCupboard?: ((id: IngredientId) => void) | undefined
  readonly onStopKeeping?: ((id: IngredientId) => void) | undefined
  readonly onAddExtra: (label: string) => void
  readonly onToggleExtra: (id: ExtraId, checked: boolean) => void
  readonly onCopyPrompt: () => void
  readonly justCopied: boolean
  readonly onBack?: (() => void) | undefined
  /** Whether the list has arrived. Only a loaded list may say "nothing to
   *  buy"; a failed one must not look like an empty one. */
  readonly loadState?: LoadState | undefined
  readonly onRetry?: (() => void) | undefined
}

/** An Extra is a Buy Line nobody derived: milk, bin bags, the thing someone
 *  shouted from the next room. It ticks off like any other line. */
const ExtraRow = ({
  extra,
  onToggle,
}: {
  readonly extra: Extra
  readonly onToggle: (id: ExtraId, checked: boolean) => void
}): React.JSX.Element => {
  const styles = useThemed(sheets)

  return (
    <Pressable
      style={[styles.row, styles.divided]}
      onPress={() => {
        onToggle(extra.id, !extra.checked)
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
  )
}

/** The last row of the list: type a thing, press enter, it is on the list. The
 *  half-typed label is this row's own business and lives here. */
const AddExtraRow = ({ onAdd }: { readonly onAdd: (label: string) => void }): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  const { t } = useTranslation()
  const [label, setLabel] = useState('')

  const add = (): void => {
    onAdd(label)
    setLabel('')
  }

  return (
    <View style={styles.addRow}>
      <View style={styles.addBox}>
        <Text style={styles.addSign}>+</Text>
      </View>
      <TextInput
        style={styles.addInput}
        value={label}
        onChangeText={setLabel}
        onSubmitEditing={add}
        placeholder={t('shopping.addExtra')}
        placeholderTextColor={theme.color.textGhost}
        accessibilityLabel={t('shopping.addExtra')}
        testID="extra-input"
      />
      <Pressable
        onPress={add}
        accessibilityRole="button"
        accessibilityLabel={t('shopping.addExtra')}
        testID="extra-add"
      >
        <Text style={styles.noteAction}>{t('shopping.addExtraAction')}</Text>
      </Pressable>
    </View>
  )
}

export const ShoppingListScreen = ({
  list,
  onToggle,
  onOutOf,
  onKeepInCupboard,
  onStopKeeping,
  onAddExtra,
  onToggleExtra,
  onCopyPrompt,
  justCopied,
  onBack,
  loadState = 'ready',
  onRetry,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [expanded, setExpanded] = useState<IngredientId | undefined>(undefined)
  /**
   * Ticked rows stay where they are by default, because the list must not
   * reflow under a moving thumb. Once a shop is half done, though, scrolling
   * past what is already in the trolley is the whole cost of the screen — so
   * they can be folded away, and the count comes with them.
   */
  const [hideTicked, setHideTicked] = useState(false)
  const isOnline = useIsOnline()

  const unitLabel = (unit: string): string => t(`unit.${unit}`)
  const tickedCount = list.buy.filter((line) => line.checked).length
  const remaining = list.buy.length - tickedCount
  const shown = hideTicked ? list.buy.filter((line) => !line.checked) : list.buy
  const groups = useMemo(() => groupBuyLines(shown), [shown])

  const isEmpty =
    list.buy.length === 0 && list.cupboard.length === 0 && list.incomplete.length === 0

  if (loadState === 'loading' || loadState === 'failed') {
    return (
      <View style={styles.page} testID="shopping-screen">
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + tokens.space.md }]}
        >
          {onBack !== undefined && <BackLink onPress={onBack} />}
          <View style={styles.head}>
            <Text style={styles.title}>{t('shopping.title')}</Text>
          </View>
          {loadState === 'loading' ? (
            <Loading />
          ) : (
            <LoadError onRetry={onRetry ?? (() => undefined)} />
          )}
        </ScrollView>
      </View>
    )
  }

  const buyRow = (line: BuyLine, isLast: boolean): React.JSX.Element => {
    return (
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
              <Text style={styles.noteAction}>
                {line.overrideReason ?? t('shopping.overridden')}
              </Text>
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

            {onKeepInCupboard !== undefined && (
              <Pressable
                style={styles.provenanceAction}
                onPress={() => {
                  // The row is about to leave the Buy list; leaving it marked as
                  // expanded means the next tap on its chevron collapses
                  // something that is no longer open.
                  setExpanded(undefined)
                  onKeepInCupboard(line.ingredientId)
                }}
                accessibilityRole="button"
                accessibilityLabel={t('shopping.keepInCupboard')}
                testID={`keep-${line.ingredientId}`}
              >
                <Text style={styles.noteAction}>{t('shopping.keepInCupboard')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.page} testID="shopping-screen">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + tokens.space.md }]}
      >
        {onBack !== undefined && <BackLink onPress={onBack} />}

        <View style={styles.head}>
          <View>
            <Text style={styles.title}>{t('shopping.title')}</Text>
            <Text style={styles.summary} testID="shopping-summary">
              {/* Two counts, two plurals: i18next pluralises on `count`, so a
                  single string gave "7 to buy · 1 meals". */}
              {/* What is left, not what was derived: in a shop the only
                  number worth having is how much further there is to go. */}
              {`${t('shopping.summary', { count: remaining })} · ${t('shopping.sittings', {
                count: list.sittings,
              })}`}
            </Text>
          </View>
        </View>

        {!isOnline && (
          <View style={styles.offline} testID="offline-notice">
            <Text style={styles.offlineText}>{t('shopping.offline')}</Text>
          </View>
        )}

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

        {tickedCount > 0 && (
          <Pressable
            style={styles.tickedToggle}
            onPress={() => {
              setHideTicked((hidden) => !hidden)
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: !hideTicked }}
            testID="toggle-ticked"
          >
            <Text style={styles.tickedToggleText}>
              {hideTicked
                ? t('shopping.showTicked', { count: tickedCount })
                : t('shopping.hideTicked')}
            </Text>
          </Pressable>
        )}

        {hideTicked && remaining === 0 && list.buy.length > 0 && (
          <Text style={styles.empty} testID="shopping-all-ticked">
            {t('shopping.allTicked')}
          </Text>
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
                  {onStopKeeping !== undefined && (
                    <Pressable
                      onPress={() => {
                        onStopKeeping(line.ingredientId)
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('shopping.stopKeeping')} ${line.name}`}
                      testID={`stop-keeping-${line.ingredientId}`}
                    >
                      <Text style={styles.noteAction}>{t('shopping.stopKeeping')}</Text>
                    </Pressable>
                  )}
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
              <ExtraRow key={extra.id} extra={extra} onToggle={onToggleExtra} />
            ))}

            <AddExtraRow onAdd={onAddExtra} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bar}>
        <View style={[styles.barInner, { paddingBottom: insets.bottom + tokens.space.lg }]}>
          <Pressable
            style={({ pressed }) => [
              styles.copy,
              pressed && styles.copyPressed,
              isEmpty && styles.copyDisabled,
            ]}
            disabled={isEmpty}
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

      {loadState === 'stale' && (
        <Notice
          message={t('load.stale')}
          testID="load-stale"
          action={onRetry === undefined ? undefined : { label: t('load.retry'), onPress: onRetry }}
        />
      )}
    </View>
  )
}
