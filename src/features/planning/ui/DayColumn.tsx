import { StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { LeftoverCard, MealCard } from '@/features/meals'
import type { BoardCard } from '../domain/types'
import type { BoardDay } from '../domain/board'

const styles = StyleSheet.create({
  day: { paddingVertical: tokens.space.md, gap: tokens.space.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space.sm },
  dayName: { ...tokens.type.display, color: tokens.color.textPrimary },
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
})

const Card = ({ card }: { readonly card: BoardCard }): React.JSX.Element =>
  card.kind === 'cook-event' ? (
    <MealCard
      variant="planned"
      servingsCooked={card.cookEvent.servingsCooked}
      meal={{
        id: card.cookEvent.mealId,
        name: card.cookEvent.mealName,
        servings: card.cookEvent.servingsCooked,
      }}
    />
  ) : (
    <LeftoverCard parentMealName={card.leftover.parentMealName} />
  )

const cardKey = (card: BoardCard): string =>
  card.kind === 'cook-event' ? card.cookEvent.id : card.leftover.id

type Props = { readonly day: BoardDay; readonly isToday: boolean }

export const DayColumn = ({ day, isToday }: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View style={styles.day} testID={`day-${day.date}`}>
      <View style={styles.header}>
        <Text style={styles.dayName}>{day.date}</Text>
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
            slot.cards.map((card) => <Card key={cardKey(card)} card={card} />)
          )}
        </View>
      ))}
    </View>
  )
}
