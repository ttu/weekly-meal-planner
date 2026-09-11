import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brand } from '@/shared/types/brand'
import { tokens } from '@/shared/theme/tokens'
import { formStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import type { Slot, SlotKey } from '@/features/household'
import type { Servings } from '@/features/meals'
import { describePlacement } from '../domain/placement'
import type { BoardDay } from '../domain/board'

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: tokens.color.surface, paddingHorizontal: tokens.space.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.space.xs,
  },
  title: { ...tokens.type.display, color: tokens.color.textPrimary, flexShrink: 1 },
  cancel: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
  addedBy: { ...tokens.type.body, color: tokens.color.textMuted, marginBottom: tokens.space.lg },
  label: {
    ...tokens.type.label,
    color: tokens.color.textMuted,
    textTransform: 'uppercase',
    marginBottom: tokens.space.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
    marginBottom: tokens.space.md,
  },
  chipToday: { borderColor: tokens.color.affirm },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    marginBottom: tokens.space.md,
  },
  stepperValue: {
    ...tokens.type.display,
    color: tokens.color.textPrimary,
    minWidth: 48,
    textAlign: 'center',
  },
  notice: {
    ...tokens.type.body,
    color: tokens.color.textMuted,
    backgroundColor: tokens.color.surfaceInset,
    borderRadius: 8,
    padding: tokens.space.md,
    marginBottom: tokens.space.md,
  },
  submit: {
    backgroundColor: tokens.color.action,
    borderRadius: 8,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.lg,
  },
  submitText: { ...tokens.type.mealName, color: tokens.color.surfaceRaised },
})

export type PlanChoice = {
  readonly date: string
  readonly slotKey: SlotKey
  readonly servingsCooked: Servings
}

type Props = {
  readonly visible: boolean
  readonly mealName: string
  readonly addedByName?: string
  readonly defaultServings: Servings
  /**
   * Leftovers reuse the same day and Slot choice, without servings — a Leftover
   * borrows its servings from its Cook Event (ADR 0004). One component rather
   * than two near-identical choosers.
   */
  readonly forLeftover?: boolean
  readonly parentSlotKey?: SlotKey
  readonly parentDate?: string
  readonly board: readonly BoardDay[]
  readonly slots: readonly Slot[]
  readonly today: string
  readonly onSubmit: (choice: PlanChoice) => void
  readonly onDismiss: () => void
}

const weekdayKey = (isoDate: string): string => {
  const day = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay()
  return `weekday.${String(day === 0 ? 7 : day)}`
}

export const PlanSheet = ({
  visible,
  mealName,
  addedByName,
  defaultServings,
  forLeftover = false,
  parentSlotKey,
  parentDate,
  board,
  slots,
  today,
  onSubmit,
  onDismiss,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [date, setDate] = useState(board[0]?.date ?? today)
  const [slotKey, setSlotKey] = useState<SlotKey | undefined>(slots[0]?.key)
  const [servings, setServings] = useState<number>(defaultServings)

  const placement = useMemo(
    () =>
      slotKey === undefined
        ? { existingCount: 0, willJoinExisting: false }
        : describePlacement({ board, date, slotKey }),
    [board, date, slotKey],
  )

  const slotLabel = slots.find((s) => s.key === slotKey)?.labelKey ?? ''

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={{ paddingTop: insets.top + tokens.space.md }}
        testID="plan-sheet"
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {forLeftover
              ? t('leftover.title', { meal: mealName })
              : t('plan.title', { meal: mealName })}
          </Text>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('plan.cancel')}
            testID="plan-cancel"
          >
            <Text style={styles.cancel}>{t('plan.cancel')}</Text>
          </Pressable>
        </View>

        {!forLeftover && addedByName !== undefined && (
          <Text style={styles.addedBy}>
            {t('plan.addedBy', { name: addedByName, servings: defaultServings })}
          </Text>
        )}

        <Text style={styles.label}>{t('plan.day')}</Text>
        <View style={styles.chips}>
          {board.map((day) => (
            <Pressable
              key={day.date}
              style={[
                formStyles.chip,
                day.date === today && styles.chipToday,
                day.date === date && formStyles.chipSelected,
              ]}
              onPress={() => {
                setDate(day.date)
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: day.date === date }}
              accessibilityLabel={day.date}
              testID={`plan-day-${day.date}`}
            >
              <Text style={formStyles.chipText}>{t(weekdayKey(day.date))}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t('plan.slot')}</Text>
        <View style={styles.chips}>
          {slots.map((slot) => (
            <Pressable
              key={slot.key}
              style={[formStyles.chip, slot.key === slotKey && formStyles.chipSelected]}
              onPress={() => {
                setSlotKey(slot.key)
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: slot.key === slotKey }}
              accessibilityLabel={t(slot.labelKey)}
              testID={`plan-slot-${slot.key}`}
            >
              <Text style={formStyles.chipText}>{t(slot.labelKey)}</Text>
            </Pressable>
          ))}
        </View>

        {!forLeftover && <Text style={styles.label}>{t('plan.cookingFor')}</Text>}
        {!forLeftover && (
          <View style={styles.stepperRow}>
            <Pressable
              style={formStyles.chip}
              onPress={() => {
                setServings((n) => Math.max(1, n - 1))
              }}
              accessibilityRole="button"
              accessibilityLabel={t('plan.cookingFor')}
              testID="plan-servings-down"
            >
              <Text style={formStyles.chipText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue} testID="plan-servings">
              {String(servings)}
            </Text>
            <Pressable
              style={formStyles.chip}
              onPress={() => {
                setServings((n) => Math.min(50, n + 1))
              }}
              accessibilityRole="button"
              accessibilityLabel={t('plan.cookingFor')}
              testID="plan-servings-up"
            >
              <Text style={formStyles.chipText}>+</Text>
            </Pressable>
          </View>
        )}

        {/* Placing a Leftover on its parent's own sitting is pointless but not
            forbidden: warn, never refuse. */}
        {forLeftover && date === parentDate && slotKey === parentSlotKey && (
          <Text style={styles.notice} testID="leftover-same-slot">
            {t('leftover.sameSlot')}
          </Text>
        )}

        {/* The app never refuses an edit; it says what will happen instead. */}
        {placement.willJoinExisting && (
          <Text style={styles.notice} testID="plan-will-join">
            {t('plan.willJoin', {
              slot: t(slotLabel),
              count: placement.existingCount,
            })}
          </Text>
        )}

        <Pressable
          style={styles.submit}
          disabled={slotKey === undefined}
          onPress={() => {
            if (slotKey === undefined) return
            onSubmit({ date, slotKey, servingsCooked: brand<number, 'Servings'>(servings) })
          }}
          accessibilityRole="button"
          accessibilityLabel={t('plan.submit', { day: t(weekdayKey(date)) })}
          testID="plan-submit"
        >
          <Text style={styles.submitText}>{t('plan.submit', { day: t(weekdayKey(date)) })}</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  )
}
