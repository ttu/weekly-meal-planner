import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brand } from '@/shared/types/brand'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation, type Locale } from '@/shared/i18n'
import type { Slot, SlotKey } from '@/features/household'
import type { Servings } from '@/features/meals'
import { describePlacement } from '../domain/placement'
import { formatWeekday } from '../domain/format-day'
import type { BoardDay } from '../domain/board'

/**
 * A bottom sheet over the board, not a screen that replaces it: the week you
 * are planning into stays visible behind the choice, which is the whole reason
 * the canvas puts it here rather than on a page of its own.
 */
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(36, 33, 28, 0.34)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: tokens.radius.sheet,
    borderTopRightRadius: tokens.radius.sheet,
    paddingHorizontal: 22,
    paddingTop: 22,
    gap: 18,
    maxHeight: '90%',
  },
  grip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.color.dashed,
    alignSelf: 'center',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { ...tokens.type.sheetTitle, color: tokens.color.textPrimary, flexShrink: 1 },
  cancel: { ...tokens.type.body, fontWeight: '600', color: tokens.color.action },
  addedBy: { ...tokens.type.body, color: tokens.color.textSupport },
  group: { gap: 9 },
  label: { ...tokens.type.label, color: tokens.color.textSupport, textTransform: 'uppercase' },
  /** Seven day chips in one row, so the week keeps its shape at a glance. */
  dayRow: { flexDirection: 'row', gap: 6 },
  slotRow: { flexDirection: 'row', gap: tokens.space.sm },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.color.cardBorder,
    backgroundColor: tokens.color.surfaceRaised,
    paddingVertical: 12,
  },
  slotChip: { paddingVertical: 14 },
  /** Selection is a terracotta fill, not an outline: on a sheet of chips an
   *  outline reads as "focused", and people tapped straight past it. */
  chipSelected: { backgroundColor: tokens.color.action, borderColor: tokens.color.action },
  chipToday: { borderColor: tokens.color.affirm },
  chipText: { ...tokens.type.body, fontWeight: '600', color: tokens.color.textPrimary },
  slotChipText: { ...tokens.type.mealNameSmall, color: tokens.color.textPrimary },
  chipTextSelected: { color: tokens.color.surfaceRaised },
  note: { ...tokens.type.meta, color: tokens.color.textSupport },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.color.cardBorder,
    backgroundColor: tokens.color.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSign: {
    fontFamily: tokens.type.body.fontFamily,
    fontSize: 22,
    color: tokens.color.textPrimary,
  },
  stepperValue: {
    fontFamily: tokens.type.mealName.fontFamily,
    fontSize: 24,
    fontWeight: '600',
    color: tokens.color.textPrimary,
    minWidth: 28,
    textAlign: 'center',
  },
  submit: {
    backgroundColor: tokens.color.action,
    borderRadius: tokens.radius.card,
    paddingVertical: 17,
    alignItems: 'center',
  },
  submitPressed: { backgroundColor: tokens.color.actionPressed },
  submitBusy: { opacity: 0.6 },
  submitText: { ...tokens.type.mealNameLarge, color: tokens.color.surfaceRaised },
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
  readonly board: readonly BoardDay[]
  readonly slots: readonly Slot[]
  readonly today: string
  readonly locale: Locale
  /** A second submit while the first is in flight is the commonest way to ask
   *  for the same Meal twice. The server refuses it too; this is the half the
   *  person can see. */
  readonly isPending?: boolean | undefined
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
  board,
  slots,
  today,
  locale,
  isPending = false,
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('plan.cancel')}
        />
        <ScrollView
          style={{ flexGrow: 0 }}
          contentContainerStyle={[styles.sheet, { paddingBottom: insets.bottom + tokens.space.lg }]}
          testID="plan-sheet"
        >
          <View style={styles.grip} />

          <View style={styles.headerRow}>
            <View style={{ flexShrink: 1, gap: 4 }}>
              <Text style={styles.title}>{t('plan.title', { meal: mealName })}</Text>
              {addedByName !== undefined && addedByName !== '' && (
                <Text style={styles.addedBy}>
                  {t('plan.addedBy', { name: addedByName, servings: defaultServings })}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={t('plan.cancel')}
              testID="plan-cancel"
            >
              <Text style={styles.cancel}>{t('plan.cancel')}</Text>
            </Pressable>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t('plan.day')}</Text>
            <View style={styles.dayRow}>
              {board.map((day) => (
                <Pressable
                  key={day.date}
                  style={[
                    styles.chip,
                    day.date === today && styles.chipToday,
                    day.date === date && styles.chipSelected,
                  ]}
                  onPress={() => {
                    setDate(day.date)
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: day.date === date }}
                  accessibilityLabel={day.date}
                  testID={`plan-day-${day.date}`}
                >
                  <Text style={[styles.chipText, day.date === date && styles.chipTextSelected]}>
                    {t(weekdayKey(day.date))}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t('plan.slot')}</Text>
            <View style={styles.slotRow}>
              {slots.map((slot) => (
                <Pressable
                  key={slot.key}
                  style={[
                    styles.chip,
                    styles.slotChip,
                    slot.key === slotKey && styles.chipSelected,
                  ]}
                  onPress={() => {
                    setSlotKey(slot.key)
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: slot.key === slotKey }}
                  accessibilityLabel={t(slot.labelKey)}
                  testID={`plan-slot-${slot.key}`}
                >
                  <Text
                    style={[styles.slotChipText, slot.key === slotKey && styles.chipTextSelected]}
                  >
                    {t(slot.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* The app never refuses an edit; it says what will happen instead. */}
            {placement.willJoinExisting && (
              <Text style={styles.note} testID="plan-will-join">
                {t('plan.willJoin', { slot: t(slotLabel), count: placement.existingCount })}
              </Text>
            )}
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t('plan.cookingFor')}</Text>
            <View style={styles.stepperRow}>
              <Pressable
                style={styles.stepper}
                onPress={() => {
                  setServings((n) => Math.max(1, n - 1))
                }}
                accessibilityRole="button"
                accessibilityLabel={t('plan.cookingFor')}
                testID="plan-servings-down"
              >
                <Text style={styles.stepperSign}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue} testID="plan-servings">
                {String(servings)}
              </Text>
              <Pressable
                style={styles.stepper}
                onPress={() => {
                  setServings((n) => Math.min(50, n + 1))
                }}
                accessibilityRole="button"
                accessibilityLabel={t('plan.cookingFor')}
                testID="plan-servings-up"
              >
                <Text style={styles.stepperSign}>+</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.submit,
              pressed && styles.submitPressed,
              isPending && styles.submitBusy,
            ]}
            disabled={slotKey === undefined || isPending}
            onPress={() => {
              if (slotKey === undefined) return
              onSubmit({ date, slotKey, servingsCooked: brand<number, 'Servings'>(servings) })
            }}
            accessibilityRole="button"
            accessibilityLabel={t('plan.submit', { day: formatWeekday(date, locale) })}
            testID="plan-submit"
          >
            <Text style={styles.submitText}>
              {t('plan.submit', { day: formatWeekday(date, locale) })}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  )
}
