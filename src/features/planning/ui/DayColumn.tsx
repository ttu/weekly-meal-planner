import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation, type Locale } from '@/shared/i18n'
import type { SlotKey } from '@/features/household'
import { formatWeekday } from '../domain/format-day'
import { AnimatedCard } from '@/shared/motion/AnimatedCard'
import { LeftoverCard, MealCard } from '@/features/meals'
import type { BoardCard, CookEventId } from '../domain/types'
import { DropSlot } from './DropSlot'
import type { BoardDay } from '../domain/board'

const styles = StyleSheet.create({
  day: {
    gap: tokens.space.sm,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    paddingLeft: tokens.space.sm,
    marginLeft: -tokens.space.sm,
  },
  dayChanged: { borderLeftColor: tokens.color.affirm },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space.sm },
  dayName: { ...tokens.type.dayHeading, color: tokens.color.textPrimary },
  today: {
    ...tokens.type.label,
    color: tokens.color.affirm,
    textTransform: 'uppercase',
  },
  /** The Slot is a labelled gutter beside the cards, not a heading above them:
   *  a Household with five Slots just grows the column. */
  slotRow: { flexDirection: 'row', gap: 12 },
  slotLabel: {
    ...tokens.type.label,
    letterSpacing: 1,
    width: 56,
    paddingTop: 14,
    color: tokens.color.textSupport,
    textTransform: 'uppercase',
  },
  slotBody: { flex: 1, gap: 6 },
  /** An empty Slot is a single dashed line, not a hole. */
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.color.dashed,
    borderRadius: tokens.radius.card,
    paddingVertical: 13,
    paddingHorizontal: tokens.space.md,
  },
  emptyText: { ...tokens.type.mealNameSmall, fontWeight: '400', color: tokens.color.textGhost },
  actions: { flexDirection: 'row', gap: tokens.space.md, paddingLeft: 2 },
  action: { ...tokens.type.meta, color: tokens.color.textSupport },
})

type CardProps = {
  readonly card: BoardCard
  readonly onAddLeftover?: ((cookEventId: CookEventId) => void) | undefined
  readonly onUnplan?: ((cookEventId: CookEventId) => void) | undefined
}

const Card = ({ card, onAddLeftover, onUnplan }: CardProps): React.JSX.Element => {
  const { t } = useTranslation()

  if (card.kind === 'leftover') {
    return <LeftoverCard parentMealName={card.leftover.parentMealName} />
  }

  const { cookEvent } = card

  return (
    <View>
      <MealCard
        variant="planned"
        name={cookEvent.mealName}
        servingsCooked={cookEvent.servingsCooked}
        addedBy={cookEvent.addedByName}
        addedByColour={cookEvent.addedByColour}
      />
      <View style={styles.actions}>
        <Pressable
          onPress={() => onAddLeftover?.(cookEvent.id)}
          accessibilityRole="button"
          accessibilityLabel={t('leftover.add')}
          testID={`add-leftover-${cookEvent.id}`}
        >
          <Text style={styles.action}>{t('leftover.add')}</Text>
        </Pressable>
        <Pressable
          onPress={() => onUnplan?.(cookEvent.id)}
          accessibilityRole="button"
          accessibilityLabel={t('unplan.action')}
          testID={`unplan-${cookEvent.id}`}
        >
          <Text style={styles.action}>{t('unplan.action')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const cardKey = (card: BoardCard): string =>
  card.kind === 'cook-event' ? card.cookEvent.id : card.leftover.id

type Props = {
  readonly day: BoardDay
  readonly isToday: boolean
  readonly locale: Locale
  /** Another Member just changed this day. Shown as a sage edge for two
   *  seconds — presence, not a notification. */
  readonly recentlyChanged?: boolean | undefined
  readonly onAddLeftover?: ((cookEventId: CookEventId) => void) | undefined
  readonly onUnplan?: ((cookEventId: CookEventId) => void) | undefined
  readonly onAddMeal?: ((date: string, slotKey: SlotKey) => void) | undefined
}

export const DayColumn = ({
  day,
  isToday,
  locale,
  recentlyChanged = false,
  onAddLeftover,
  onUnplan,
  onAddMeal,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View style={[styles.day, recentlyChanged && styles.dayChanged]} testID={`day-${day.date}`}>
      <View style={styles.header}>
        <Text style={styles.dayName}>{formatWeekday(day.date, locale)}</Text>
        {isToday && (
          <Text style={styles.today} testID="day-today-marker">
            {t('board.today')}
          </Text>
        )}
      </View>

      {day.slots.map((slot) => (
        <View key={slot.slotKey} style={styles.slotRow}>
          <Text style={styles.slotLabel}>{t(slot.labelKey)}</Text>
          <DropSlot date={day.date} slotKey={slot.slotKey} style={styles.slotBody}>
            {slot.cards.length === 0 ? (
              <Pressable
                style={styles.empty}
                onPress={() => onAddMeal?.(day.date, slot.slotKey)}
                accessibilityRole="button"
                accessibilityLabel={t('board.addMeal')}
                testID="slot-empty"
              >
                <Text style={styles.emptyText}>{t('board.addMeal')}</Text>
              </Pressable>
            ) : (
              slot.cards.map((card) => (
                <AnimatedCard key={cardKey(card)}>
                  <Card card={card} onAddLeftover={onAddLeftover} onUnplan={onUnplan} />
                </AnimatedCard>
              ))
            )}
          </DropSlot>
        </View>
      ))}
    </View>
  )
}
