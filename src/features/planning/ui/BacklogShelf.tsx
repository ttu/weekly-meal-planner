import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { DraggableBacklogCard } from './DraggableBacklogCard'
import type { DropTarget } from './DragContext'
import type { BacklogItem, BacklogItemId } from '../domain/types'

/**
 * Docked, not a tab: the design keeps the Backlog visible at every scroll
 * position so a card is three taps from the board without any dragging.
 *
 * On a wide screen the same component becomes the middle pane — a vertical
 * column between the library and the board, which is the direction the whole
 * layout moves in.
 */
export type BacklogLayout = 'shelf' | 'pane'

const styles = StyleSheet.create({
  shelf: {
    backgroundColor: tokens.color.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: tokens.color.cardBorder,
    paddingTop: 12,
    paddingBottom: 26,
    gap: 11,
    boxShadow: tokens.shadow.shelf,
  },
  pane: { paddingTop: tokens.space.md, gap: 11 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.md,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  /** The grab handle: the shelf is a surface that can be pulled up. */
  grip: { width: 28, height: 4, borderRadius: 2, backgroundColor: tokens.color.cardBorder },
  heading: { ...tokens.type.label, color: tokens.color.textPrimary, textTransform: 'uppercase' },
  headingPane: { color: tokens.color.textSupport },
  count: {
    fontFamily: tokens.type.label.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: tokens.color.textPrimary,
    backgroundColor: tokens.color.backlog,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  add: { ...tokens.type.body, fontWeight: '600', color: tokens.color.action },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: tokens.space.md },
  column: { paddingHorizontal: 14, gap: 9 },
  shelfCard: { width: 168 },
  cardWrap: { position: 'relative' },
  /** Removal sits on the card as a corner affordance rather than a row of its
   *  own: a shelf card is 168px wide and cannot spare a line. */
  remove: { position: 'absolute', top: 2, right: 4, padding: 6 },
  removeText: { ...tokens.type.meta, color: tokens.color.textGhost },
  empty: { paddingHorizontal: tokens.space.md },
  emptyText: { ...tokens.type.body, color: tokens.color.textSupport },
})

type Props = {
  readonly items: readonly BacklogItem[]
  readonly layout?: BacklogLayout
  readonly onAdd?: () => void
  readonly onPlan?: (id: BacklogItemId) => void
  readonly onRemove?: (id: BacklogItemId) => void
  /** Dragging is the accelerator; tapping always works and does the same thing
   *  through the plan sheet. */
  readonly onDropOnBoard?: ((item: BacklogItem, target: DropTarget) => void) | undefined
}

export const BacklogShelf = ({
  items,
  layout = 'shelf',
  onAdd,
  onPlan,
  onRemove,
  onDropOnBoard,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const isShelf = layout === 'shelf'

  const cards = items.map((backlogItem) => (
    <View key={backlogItem.id} style={[styles.cardWrap, isShelf && styles.shelfCard]}>
      <DraggableBacklogCard
        item={backlogItem}
        onDropped={onDropOnBoard}
        onTap={(dragged) => onPlan?.(dragged.id)}
      />
      <Pressable
        style={styles.remove}
        onPress={() => onRemove?.(backlogItem.id)}
        accessibilityRole="button"
        accessibilityLabel={t('unplan.removeBacklog')}
        testID={`backlog-remove-${backlogItem.id}`}
      >
        <Text style={styles.removeText}>×</Text>
      </Pressable>
    </View>
  ))

  return (
    <View style={isShelf ? styles.shelf : styles.pane} testID="backlog-shelf">
      <View style={styles.header}>
        <View style={styles.headingRow}>
          {isShelf && <View style={styles.grip} />}
          <Text style={[styles.heading, !isShelf && styles.headingPane]}>
            {isShelf ? t('backlog.count') : t('board.backlogHeading')}
          </Text>
          {items.length > 0 && (
            <Text style={styles.count} testID="backlog-count">
              {String(items.length)}
            </Text>
          )}
        </View>
        {isShelf && (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={t('backlog.add')}
            testID="backlog-add"
          >
            <Text style={styles.add}>{t('backlog.addShort')}</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.empty} testID="backlog-empty">
          <Text style={styles.emptyText}>{t('backlog.empty')}</Text>
        </View>
      ) : isShelf ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>{cards}</View>
        </ScrollView>
      ) : (
        <View style={styles.column}>{cards}</View>
      )}
    </View>
  )
}
