import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation, type Locale } from '@/shared/i18n'
import { formatDayHeading } from '../domain/format-day'
import { AnimatedCard } from '@/shared/motion/AnimatedCard'
import { LeftoverCard, MealCard } from '@/features/meals'
import type { BoardCard, CookEventId } from '../domain/types'
import type { BoardDay } from '../domain/board'

const styles = StyleSheet.create({
  day: {
    paddingVertical: tokens.space.md,
    gap: tokens.space.sm,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    paddingLeft: tokens.space.sm,
  },
  dayChanged: { borderLeftColor: tokens.color.affirm },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space.sm },
  dayName: { ...tokens.type.dayHeading, color: tokens.color.textPrimary },
  today: { ...tokens.type.label, color: tokens.color.affirm, textTransform: 'uppercase' },
  slot: { gap: tokens.space.xs },
  slotLabel: { ...tokens.type.label, color: tokens.color.textMuted, textTransform: 'uppercase' },
  empty: {
    borderTopWidth: 1,
    borderTopColor: tokens.color.rule,
    borderStyle: 'dashed',
    paddingVertical: tokens.space.sm,
  },
  emptyText: { ...tokens.type.body, color: tokens.color.textMuted },
  actions: {
    flexDirection: 'row',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.md,
    paddingBottom: tokens.space.sm,
  },
  action: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
})

type CardProps = {
  readonly card: BoardCard
  // Explicitly `| undefined`: exactOptionalPropertyTypes distinguishes an
  // absent prop from one passed as undefined, and DayColumn forwards both.
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
}

export const DayColumn = ({
  day,
  isToday,
  locale,
  recentlyChanged = false,
  onAddLeftover,
  onUnplan,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View style={[styles.day, recentlyChanged && styles.dayChanged]} testID={`day-${day.date}`}>
      <View style={styles.header}>
        <Text style={styles.dayName}>{formatDayHeading(day.date, locale)}</Text>
        {isToday && (
          <Text style={styles.today} testID="day-today-marker">
            {t('board.today')}
          </Text>
        )}
      </View>

      {day.slots.map((slot) => (
        <View key={slot.slotKey} style={styles.slot} testID={`slot-${slot.slotKey}`}>
          <Text style={styles.slotLabel}>{t(slot.labelKey)}</Text>

          {/* An empty Slot is one dashed add-line, never a blank gap. */}
          {slot.cards.length === 0 ? (
            <View style={styles.empty} testID="slot-empty">
              <Text style={styles.emptyText}>{t('board.addMeal')}</Text>
            </View>
          ) : (
            slot.cards.map((card) => (
              <AnimatedCard key={cardKey(card)}>
                <Card card={card} onAddLeftover={onAddLeftover} onUnplan={onUnplan} />
              </AnimatedCard>
            ))
          )}
        </View>
      ))}
    </View>
  )
}
