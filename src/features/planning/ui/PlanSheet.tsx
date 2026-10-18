import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brand } from '@/shared/types/brand'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation, type Locale } from '@/shared/i18n'
import { slotName, type Slot, type SlotKey } from '@/features/household'
import type { Servings } from '@/features/meals'
import { describePlacement } from '../domain/placement'
import { formatWeekday } from '../domain/format-day'
import type { BoardDay } from '../domain/board'

/**
 * A bottom sheet over the board, not a screen that replaces it: the week you
 * are planning into stays visible behind the choice, which is the whole reason
 * the canvas puts it here rather than on a page of its own.
 */
const sheets = themed((tokens) =>
  StyleSheet.create({
    /** The part of the backdrop above the sheet: pressing it closes. */
    dismiss: { flex: 1 },
    sheetScroll: { flexGrow: 0 },
    headerText: { flexShrink: 1, gap: tokens.space.xs },
    backdrop: { flex: 1, backgroundColor: tokens.color.scrim, justifyContent: 'flex-end' },
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
    chipTextSelected: { color: tokens.color.onAction },
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
      fontSize: tokens.type.dayHeading.fontSize,
      color: tokens.color.textPrimary,
    },
    stepperValue: {
      fontFamily: tokens.type.mealName.fontFamily,
      fontSize: tokens.type.wordmark.fontSize,
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
    submitText: { ...tokens.type.mealNameLarge, color: tokens.color.onAction },
  }),
)

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

/** Which Meal is being planned, who wanted it, and the way out. */
const PlanHeader = ({
  mealName,
  addedByName,
  defaultServings,
  onDismiss,
}: {
  readonly mealName: string
  readonly addedByName?: string | undefined
  readonly defaultServings: number
  readonly onDismiss: () => void
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerText}>
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
  )
}

/** The seven days of the week being planned, today marked. */
const DayChips = ({
  board,
  date,
  today,
  onPick,
}: {
  readonly board: readonly BoardDay[]
  readonly date: string
  readonly today: string
  readonly onPick: (date: string) => void
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
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
            onPick(day.date)
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
  )
}

/** The household's own Slots, in the order they eat them. */
const SlotChips = ({
  slots,
  slotKey,
  onPick,
}: {
  readonly slots: readonly Slot[]
  readonly slotKey: SlotKey | undefined
  readonly onPick: (key: SlotKey) => void
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.slotRow}>
      {slots.map((slot) => (
        <Pressable
          key={slot.key}
          style={[styles.chip, styles.slotChip, slot.key === slotKey && styles.chipSelected]}
          onPress={() => {
            onPick(slot.key)
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: slot.key === slotKey }}
          accessibilityLabel={slotName(slot, t)}
          testID={`plan-slot-${slot.key}`}
        >
          <Text style={[styles.slotChipText, slot.key === slotKey && styles.chipTextSelected]}>
            {slotName(slot, t)}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

/** Servings Cooked, between one and fifty: a stepper rather than a keyboard,
 *  because this is the one number planning a week needs. */
const ServingsStepper = ({
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
          onChange((n) => Math.min(50, n + 1))
        }}
        accessibilityRole="button"
        accessibilityLabel={t('plan.cookingFor')}
        testID="plan-servings-up"
      >
        <Text style={styles.stepperSign}>+</Text>
      </Pressable>
    </View>
  )
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
  const styles = useThemed(sheets)
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

  const chosen = slots.find((s) => s.key === slotKey)
  const slotLabel = chosen === undefined ? '' : slotName(chosen, t)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dismiss}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('plan.cancel')}
        />
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheet, { paddingBottom: insets.bottom + tokens.space.lg }]}
          testID="plan-sheet"
        >
          <View style={styles.grip} />

          <PlanHeader
            mealName={mealName}
            addedByName={addedByName}
            defaultServings={defaultServings}
            onDismiss={onDismiss}
          />

          <View style={styles.group}>
            <Text style={styles.label}>{t('plan.day')}</Text>
            <DayChips board={board} date={date} today={today} onPick={setDate} />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t('plan.slot')}</Text>
            <SlotChips slots={slots} slotKey={slotKey} onPick={setSlotKey} />

            {/* The app never refuses an edit; it says what will happen instead. */}
            {placement.willJoinExisting && (
              <Text style={styles.note} testID="plan-will-join">
                {t('plan.willJoin', { slot: slotLabel, count: placement.existingCount })}
              </Text>
            )}
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t('plan.cookingFor')}</Text>
            <ServingsStepper servings={servings} onChange={setServings} />
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
