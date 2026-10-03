import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation, type Locale } from '@/shared/i18n'
import { slotName, type SlotKey } from '@/features/household'
import { formatWeekday } from '../domain/format-day'
import { AnimatedCard } from '@/shared/motion/AnimatedCard'
import { LeftoverCard, MealCard } from '@/features/meals'
import type { BoardCard, CookEventId, LeftoverId } from '../domain/types'
import { DraggableCard } from './DraggableCard'
import { DropSlot } from './DropSlot'
import type { DragPayload, DropTarget } from './DragContext'
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
  removeLeftover: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeLeftoverText: { ...tokens.type.meta, color: tokens.color.textGhost },
  action: { ...tokens.type.meta, color: tokens.color.textSupport },
})

type CardProps = {
  readonly card: BoardCard
  readonly onAddLeftover?: ((cookEventId: CookEventId) => void) | undefined
  readonly onUnplan?: ((cookEventId: CookEventId) => void) | undefined
  readonly onRemoveLeftover?: ((leftoverId: LeftoverId) => void) | undefined
  readonly onDropped?: ((payload: DragPayload, target: DropTarget) => void) | undefined
}

const Card = ({
  card,
  onAddLeftover,
  onUnplan,
  onRemoveLeftover,
  onDropped,
}: CardProps): React.JSX.Element => {
  const { t } = useTranslation()

  if (card.kind === 'leftover') {
    const { leftover } = card

    // A Leftover moves like any other card: "we'll finish it on Friday" is the
    // commonest edit there is. The × is a sibling of the draggable, not a child
    // of it — a button inside a button is invalid on web and swallows the tap.
    return (
      <View>
        <DraggableCard
          payload={{ kind: 'leftover', leftover }}
          onDropped={onDropped}
          accessibilityLabel={t('leftover.suffix', { meal: leftover.parentMealName })}
          testID={`leftover-${leftover.id}`}
        >
          <LeftoverCard parentMealName={leftover.parentMealName} />
        </DraggableCard>
        {onRemoveLeftover !== undefined && (
          <Pressable
            style={styles.removeLeftover}
            onPress={() => {
              onRemoveLeftover(leftover.id)
            }}
            accessibilityRole="button"
            accessibilityLabel={t('leftover.remove')}
            testID={`remove-leftover-${leftover.id}`}
          >
            <Text style={styles.removeLeftoverText}>×</Text>
          </Pressable>
        )}
      </View>
    )
  }

  const { cookEvent } = card

  return (
    <DraggableCard
      payload={{ kind: 'cook-event', cookEvent }}
      onDropped={onDropped}
      accessibilityLabel={cookEvent.mealName}
      isTappable={false}
      testID={`planned-${cookEvent.id}`}
    >
      <MealCard
        variant="planned"
        name={cookEvent.mealName}
        servingsCooked={cookEvent.servingsCooked}
        addedBy={cookEvent.addedByName}
        addedByColour={cookEvent.addedByColour}
        onAddLeftover={
          onAddLeftover === undefined
            ? undefined
            : () => {
                onAddLeftover(cookEvent.id)
              }
        }
        onUnplan={
          onUnplan === undefined
            ? undefined
            : () => {
                onUnplan(cookEvent.id)
              }
        }
      />
    </DraggableCard>
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
  readonly onRemoveLeftover?: ((leftoverId: LeftoverId) => void) | undefined
  readonly onDropped?: ((payload: DragPayload, target: DropTarget) => void) | undefined
}

export const DayColumn = ({
  day,
  isToday,
  locale,
  recentlyChanged = false,
  onAddLeftover,
  onUnplan,
  onAddMeal,
  onRemoveLeftover,
  onDropped,
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
          <Text style={styles.slotLabel}>{slotName(slot, t)}</Text>
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
                  <Card
                    card={card}
                    onAddLeftover={onAddLeftover}
                    onUnplan={onUnplan}
                    onRemoveLeftover={onRemoveLeftover}
                    onDropped={onDropped}
                  />
                </AnimatedCard>
              ))
            )}
          </DropSlot>
        </View>
      ))}
    </View>
  )
}
