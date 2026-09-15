import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation, type Locale } from '@/shared/i18n'
import type { SlotKey } from '@/features/household'
import { AnimatedCard } from '@/shared/motion/AnimatedCard'
import { formatColumnHeading } from '../domain/format-day'
import { LeftoverCard } from '@/features/meals'
import type { BoardCard, CookEventId, LeftoverId } from '../domain/types'
import type { BoardDay } from '../domain/board'
import { DraggableCard } from './DraggableCard'
import { DropSlot } from './DropSlot'
import type { DragPayload, DropTarget } from './DragContext'

/**
 * One day of the wide board: a narrow column where seven must fit across, so
 * the card shrinks to its name and a servings count and the Slot becomes a
 * horizontal band shared with the six columns beside it.
 */
const styles = StyleSheet.create({
  column: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: tokens.color.cardBorder,
  },
  columnToday: { backgroundColor: 'rgba(95, 115, 85, 0.05)' },
  columnChanged: { boxShadow: 'inset 0 0 0 2px rgba(95, 115, 85, 0.35)' },
  head: {
    paddingTop: 11,
    paddingBottom: tokens.space.sm,
    paddingHorizontal: 12,
    gap: 1,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.cardBorder,
  },
  heading: {
    ...tokens.type.labelSmall,
    color: tokens.color.textSupport,
    textTransform: 'uppercase',
  },
  headingToday: { color: tokens.color.affirm },
  today: { ...tokens.type.labelSmall, fontWeight: '400', color: tokens.color.affirm },
  body: { flex: 1 },
  slot: { flex: 1, padding: 9, gap: 6 },
  slotDivided: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: tokens.color.cardBorder,
  },
  slotLabel: {
    ...tokens.type.labelTiny,
    color: tokens.color.textGhost,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: tokens.color.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.color.cardBorder,
    borderRadius: tokens.radius.md,
    paddingVertical: 9,
    paddingHorizontal: 10,
    boxShadow: tokens.shadow.subtle,
  },
  cardName: { ...tokens.type.mealNameTight, color: tokens.color.textPrimary },
  cardCount: {
    ...tokens.type.labelTiny,
    fontWeight: '400',
    fontSize: 12,
    color: tokens.color.textSupport,
    paddingTop: 2,
  },
  leftover: {
    backgroundColor: tokens.color.surfaceInset,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.color.dashedInset,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: 10,
  },
  leftoverText: { ...tokens.type.meta, color: tokens.color.textMuted },
  removeLeftover: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeLeftoverText: { ...tokens.type.labelTiny, fontSize: 12, color: tokens.color.textGhost },
  leftoverWord: {
    fontFamily: tokens.type.dayHeading.fontFamily,
    fontStyle: 'italic',
    fontSize: 15,
  },
})

const cardKey = (card: BoardCard): string =>
  card.kind === 'cook-event' ? card.cookEvent.id : card.leftover.id

type Props = {
  readonly day: BoardDay
  readonly isToday: boolean
  readonly isLast: boolean
  readonly locale: Locale
  readonly recentlyChanged?: boolean | undefined
  readonly onSelect?: ((cookEventId: CookEventId) => void) | undefined
  readonly onAddMeal?: ((date: string, slotKey: SlotKey) => void) | undefined
  readonly onRemoveLeftover?: ((leftoverId: LeftoverId) => void) | undefined
  readonly onDropped?: ((payload: DragPayload, target: DropTarget) => void) | undefined
}

export const WideDayColumn = ({
  day,
  isToday,
  isLast,
  locale,
  recentlyChanged = false,
  onSelect,
  onAddMeal,
  onRemoveLeftover,
  onDropped,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View
      style={[
        styles.column,
        isLast && { borderRightWidth: 0 },
        isToday && styles.columnToday,
        recentlyChanged && styles.columnChanged,
      ]}
      testID={`day-${day.date}`}
    >
      <View style={styles.head}>
        <Text style={[styles.heading, isToday && styles.headingToday]}>
          {formatColumnHeading(day.date, locale)}
        </Text>
        {isToday && (
          <Text style={styles.today} testID="day-today-marker">
            {t('board.today')}
          </Text>
        )}
      </View>

      <View style={styles.body}>
        {day.slots.map((slot, index) => (
          <DropSlot
            key={slot.slotKey}
            date={day.date}
            slotKey={slot.slotKey}
            style={[styles.slot, index < day.slots.length - 1 && styles.slotDivided]}
          >
            <Pressable
              onPress={() => onAddMeal?.(day.date, slot.slotKey)}
              accessibilityRole="button"
              accessibilityLabel={t('board.addMeal')}
            >
              <Text style={styles.slotLabel}>{t(slot.labelKey)}</Text>
            </Pressable>

            {slot.cards.map((card) =>
              card.kind === 'leftover' ? (
                <View key={cardKey(card)}>
                  <DraggableCard
                    payload={{ kind: 'leftover', leftover: card.leftover }}
                    onDropped={onDropped}
                    accessibilityLabel={t('leftover.suffix', {
                      meal: card.leftover.parentMealName,
                    })}
                    testID={`leftover-${card.leftover.id}`}
                  >
                    <LeftoverCard compact parentMealName={card.leftover.parentMealName} />
                  </DraggableCard>
                  {onRemoveLeftover !== undefined && (
                    <Pressable
                      style={styles.removeLeftover}
                      onPress={() => {
                        onRemoveLeftover(card.leftover.id)
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('leftover.remove')}
                      testID={`remove-leftover-${card.leftover.id}`}
                    >
                      <Text style={styles.removeLeftoverText}>×</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <AnimatedCard key={cardKey(card)}>
                  {/* Carry it to another day or Slot, or back onto the Backlog
                      to take it off the week. Tapping still opens unplan. */}
                  <DraggableCard
                    payload={{ kind: 'cook-event', cookEvent: card.cookEvent }}
                    onDropped={onDropped}
                    onTap={() => onSelect?.(card.cookEvent.id)}
                    accessibilityLabel={card.cookEvent.mealName}
                    testID={`planned-${card.cookEvent.id}`}
                  >
                    <View style={styles.card} testID="meal-card-planned">
                      <Text style={styles.cardName}>{card.cookEvent.mealName}</Text>
                      <Text style={styles.cardCount}>{String(card.cookEvent.servingsCooked)}</Text>
                    </View>
                  </DraggableCard>
                </AnimatedCard>
              ),
            )}
          </DropSlot>
        ))}
      </View>
    </View>
  )
}
