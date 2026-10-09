import { Pressable, StyleSheet, Text, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation, type Locale } from '@/shared/i18n'
import { slotName, type SlotKey } from '@/features/household'
import { AnimatedCard } from '@/shared/motion/AnimatedCard'
import { formatColumnHeading } from '../domain/format-day'
import { LeftoverCard } from '@/features/meals'
import type { BoardCard, CookEvent, CookEventId, Leftover, LeftoverId } from '../domain/types'
import type { BoardDay } from '../domain/board'
import { DraggableCard } from './DraggableCard'
import { DropSlot } from './DropSlot'
import type { DragPayload, DropTarget } from './DragContext'

/**
 * One day of the wide board: a narrow column where seven must fit across, so
 * the card shrinks to its name and a servings count and the Slot becomes a
 * horizontal band shared with the six columns beside it.
 */
const sheets = themed((tokens) =>
  StyleSheet.create({
    column: {
      flex: 1,
      borderRightWidth: 1,
      borderRightColor: tokens.color.cardBorder,
    },
    columnToday: { backgroundColor: tokens.color.todayTint },
    columnChanged: { boxShadow: `inset 0 0 0 2px ${tokens.color.todayEdge}` },
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
    slot: { flex: 1, paddingVertical: 9, paddingHorizontal: 6, gap: 6 },
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
    empty: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tokens.color.dashed,
      borderRadius: tokens.radius.md,
      paddingVertical: tokens.space.sm,
      paddingHorizontal: tokens.space.sm,
    },
    emptyText: { ...tokens.type.mealNameTight, fontWeight: '400', color: tokens.color.textGhost },
    card: {
      backgroundColor: tokens.color.surfaceRaised,
      borderWidth: 1,
      borderColor: tokens.color.cardBorder,
      borderRadius: tokens.radius.md,
      paddingVertical: 9,
      paddingHorizontal: 8,
      boxShadow: tokens.shadow.subtle,
    },
    cardName: { ...tokens.type.mealNameTight, color: tokens.color.textPrimary },
    cardFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 4,
    },
    cardActions: { flexDirection: 'row', gap: 2 },
    cardAction: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardGlyph: {
      fontFamily: tokens.type.body.fontFamily,
      fontSize: 13,
      color: tokens.color.textGhost,
    },
    cardCountLink: { color: tokens.color.action, textDecorationLine: 'underline' },
    countHit: { paddingVertical: 11, marginVertical: -11, paddingRight: 8, marginRight: -8 },
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
  }),
)

const cardKey = (card: BoardCard): string =>
  card.kind === 'cook-event' ? card.cookEvent.id : card.leftover.id

/** A Leftover in a 100px column: the card, and the × that takes it off the
 *  week. Tapping the card itself opens nothing — a Leftover has nothing to
 *  edit (ADR 0004). */
const WideLeftoverCard = ({
  leftover,
  onRemoveLeftover,
  onDropped,
}: {
  readonly leftover: Leftover
  readonly onRemoveLeftover?: ((leftoverId: LeftoverId) => void) | undefined
  readonly onDropped?: ((payload: DragPayload, target: DropTarget) => void) | undefined
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View>
      <DraggableCard
        payload={{ kind: 'leftover', leftover }}
        onDropped={onDropped}
        accessibilityLabel={t('leftover.suffix', { meal: leftover.parentMealName })}
        testID={`leftover-${leftover.id}`}
      >
        <LeftoverCard compact parentMealName={leftover.parentMealName} />
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

/** The same two actions the phone card carries, at the size a 100px column can
 *  hold. Without them a Leftover could not be made above 1024px at all. */
const WideCardActions = ({
  cookEventId,
  onSelect,
  onAddLeftover,
}: {
  readonly cookEventId: CookEventId
  readonly onSelect?: ((cookEventId: CookEventId) => void) | undefined
  readonly onAddLeftover?: ((cookEventId: CookEventId) => void) | undefined
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.cardActions}>
      <Pressable
        style={styles.cardAction}
        onPress={() => onAddLeftover?.(cookEventId)}
        accessibilityRole="button"
        accessibilityLabel={t('leftover.add')}
        testID="card-add-leftover"
      >
        <Text style={styles.cardGlyph}>↻</Text>
      </Pressable>
      <Pressable
        style={styles.cardAction}
        onPress={() => onSelect?.(cookEventId)}
        accessibilityRole="button"
        accessibilityLabel={t('unplan.action')}
        testID="card-unplan"
      >
        <Text style={styles.cardGlyph}>×</Text>
      </Pressable>
    </View>
  )
}

/** What the card says: the Meal's name, and a foot holding the servings count
 *  beside the two actions. */
const WideCardBody = ({
  cookEvent,
  onSelect,
  onAddLeftover,
  onEditServings,
}: {
  readonly cookEvent: CookEvent
  readonly onSelect?: ((cookEventId: CookEventId) => void) | undefined
  readonly onAddLeftover?: ((cookEventId: CookEventId) => void) | undefined
  readonly onEditServings?: ((cookEvent: CookEvent) => void) | undefined
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.card} testID="meal-card-planned">
      {/* Clamped rather than broken: a narrow column splits "perunamuusi" into
          "perunamuu si", and a Finnish compound is exactly the case this
          column will meet. */}
      <Text style={styles.cardName} numberOfLines={3}>
        {cookEvent.mealName}
      </Text>
      <View style={styles.cardFoot}>
        {onEditServings === undefined ? (
          <Text style={styles.cardCount}>{String(cookEvent.servingsCooked)}</Text>
        ) : (
          <Pressable
            onPress={() => {
              onEditServings(cookEvent)
            }}
            style={styles.countHit}
            accessibilityRole="button"
            accessibilityLabel={t('cookEvent.changeServings')}
            testID="card-edit-servings"
          >
            <Text style={[styles.cardCount, styles.cardCountLink]}>
              {String(cookEvent.servingsCooked)}
            </Text>
          </Pressable>
        )}
        <WideCardActions
          cookEventId={cookEvent.id}
          onSelect={onSelect}
          onAddLeftover={onAddLeftover}
        />
      </View>
    </View>
  )
}

/**
 * A Cook Event in a 100px column: the Meal's name, how many are being cooked,
 * and the two actions. Carry it to another day or Slot, or back onto the
 * Backlog to take it off the week; tapping still opens unplan.
 */
const WidePlannedCard = ({
  cookEvent,
  onSelect,
  onAddLeftover,
  onEditServings,
  onDropped,
}: {
  readonly cookEvent: CookEvent
  readonly onSelect?: ((cookEventId: CookEventId) => void) | undefined
  readonly onAddLeftover?: ((cookEventId: CookEventId) => void) | undefined
  readonly onEditServings?: ((cookEvent: CookEvent) => void) | undefined
  readonly onDropped?: ((payload: DragPayload, target: DropTarget) => void) | undefined
}): React.JSX.Element => (
  <AnimatedCard>
    <View>
      <DraggableCard
        payload={{ kind: 'cook-event', cookEvent }}
        onDropped={onDropped}
        accessibilityLabel={cookEvent.mealName}
        isTappable={false}
        testID={`planned-${cookEvent.id}`}
      >
        <WideCardBody
          cookEvent={cookEvent}
          onSelect={onSelect}
          onAddLeftover={onAddLeftover}
          onEditServings={onEditServings}
        />
      </DraggableCard>
    </View>
  </AnimatedCard>
)

type Props = {
  readonly day: BoardDay
  readonly isToday: boolean
  readonly isLast: boolean
  readonly locale: Locale
  readonly recentlyChanged?: boolean | undefined
  readonly onSelect?: ((cookEventId: CookEventId) => void) | undefined
  readonly onAddLeftover?: ((cookEventId: CookEventId) => void) | undefined
  readonly onEditServings?: ((cookEvent: CookEvent) => void) | undefined
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
  onAddLeftover,
  onEditServings,
  onAddMeal,
  onRemoveLeftover,
  onDropped,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
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
            <Text style={styles.slotLabel}>{slotName(slot, t)}</Text>

            {/* A brand-new board is seven blank columns. Without this the only
                way in is to know the Slot label is tappable, which nobody
                does. It is the same dashed invitation the phone Slot has. */}
            {slot.cards.length === 0 && (
              <Pressable
                style={styles.empty}
                onPress={() => onAddMeal?.(day.date, slot.slotKey)}
                accessibilityRole="button"
                accessibilityLabel={t('board.addMeal')}
                testID="slot-empty"
              >
                <Text style={styles.emptyText} numberOfLines={1}>
                  {t('board.addMeal')}
                </Text>
              </Pressable>
            )}

            {slot.cards.map((card) =>
              card.kind === 'leftover' ? (
                <WideLeftoverCard
                  key={cardKey(card)}
                  leftover={card.leftover}
                  onRemoveLeftover={onRemoveLeftover}
                  onDropped={onDropped}
                />
              ) : (
                <WidePlannedCard
                  key={cardKey(card)}
                  cookEvent={card.cookEvent}
                  onSelect={onSelect}
                  onAddLeftover={onAddLeftover}
                  onEditServings={onEditServings}
                  onDropped={onDropped}
                />
              ),
            )}
          </DropSlot>
        ))}
      </View>
    </View>
  )
}
