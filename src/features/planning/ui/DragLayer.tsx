import { StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { tokens } from '@/shared/theme/tokens'
import { LeftoverCard, MealCard } from '@/features/meals'
import { useDrag } from './DragContext'

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    /** Above every pane, and never in the way of the pointer. */
    zIndex: 1000,
    pointerEvents: 'none',
    boxShadow: tokens.shadow.lifted,
    borderRadius: tokens.radius.card,
  },
})

/**
 * The card in your hand, drawn once at the root of the board.
 *
 * It lives here rather than in the card that started the drag because every
 * container between the two clips: the Backlog shelf scrolls horizontally, a
 * day column scrolls vertically, and a card translated inside either simply
 * disappears at its edge. Drawn at the root, it crosses the whole board.
 */
export const DragLayer = (): React.JSX.Element | null => {
  const { dragging, pointer, grab, cardWidth } = useDrag()

  const style = useAnimatedStyle(() => ({
    width: cardWidth.value,
    transform: [
      { translateX: pointer.x.value - grab.x.value },
      { translateY: pointer.y.value - grab.y.value },
      { rotate: '-1.5deg' },
      { scale: 1.04 },
    ],
  }))

  if (dragging === undefined) return null

  return (
    <Animated.View style={[styles.layer, style]} testID="drag-layer">
      {dragging.kind === 'backlog' && (
        <MealCard
          variant="backlog"
          name={dragging.item.mealName}
          addedBy={dragging.item.addedByName}
          addedByColour={dragging.item.addedByColour}
        />
      )}
      {dragging.kind === 'cook-event' && (
        <MealCard
          variant="planned"
          name={dragging.cookEvent.mealName}
          servingsCooked={dragging.cookEvent.servingsCooked}
          addedBy={dragging.cookEvent.addedByName}
          addedByColour={dragging.cookEvent.addedByColour}
        />
      )}
      {dragging.kind === 'library' && (
        <MealCard compact variant="library" name={dragging.meal.name} />
      )}
      {dragging.kind === 'leftover' && (
        <LeftoverCard compact parentMealName={dragging.leftover.parentMealName} />
      )}
    </Animated.View>
  )
}
