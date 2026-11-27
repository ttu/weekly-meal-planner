import { Pressable, StyleSheet, Text, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'
import { LeftoverCard } from '@/features/meals'
import type { Leftover, LeftoverId } from '../domain/types'
import { DraggableCard } from './DraggableCard'
import type { DragPayload, DropTarget } from './DragContext'

const sheets = themed((tokens) =>
  StyleSheet.create({
    remove: {
      position: 'absolute',
      top: 0,
      right: 0,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    removeCompact: { paddingHorizontal: 8, paddingVertical: 4 },
    removeText: { ...tokens.type.meta, color: tokens.color.textGhost },
    removeTextCompact: {
      ...tokens.type.labelTiny,
      fontSize: tokens.type.label.fontSize,
      color: tokens.color.textGhost,
    },
  }),
)

/**
 * A Leftover on the board: the card, and the × that takes it off the week.
 *
 * It moves like any other card: "we'll finish it on Friday" is the commonest
 * edit there is. Tapping it opens nothing — a Leftover has nothing to edit
 * (ADR 0004). The × is a sibling of the draggable, not a child of it: a button
 * inside a button is invalid on web and swallows the tap. `compact` is the
 * wide board's 100px column.
 */
export const PlacedLeftover = ({
  leftover,
  compact = false,
  onRemoveLeftover,
  onDropped,
}: {
  readonly leftover: Leftover
  readonly compact?: boolean
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
        <LeftoverCard compact={compact} parentMealName={leftover.parentMealName} />
      </DraggableCard>
      {onRemoveLeftover !== undefined && (
        <Pressable
          style={[styles.remove, compact && styles.removeCompact]}
          onPress={() => {
            onRemoveLeftover(leftover.id)
          }}
          accessibilityRole="button"
          accessibilityLabel={t('leftover.remove')}
          testID={`remove-leftover-${leftover.id}`}
        >
          <Text style={compact ? styles.removeTextCompact : styles.removeText}>×</Text>
        </Pressable>
      )}
    </View>
  )
}
