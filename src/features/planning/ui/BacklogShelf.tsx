import { useEffect, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { MealCard } from '@/features/meals'
import { DraggableCard } from './DraggableCard'
import { isSameTarget, useDrag, type DragPayload, type DropTarget } from './DragContext'
import type { BacklogItem, BacklogItemId } from '../domain/types'

/**
 * Docked, not a tab: the design keeps the Backlog visible at every scroll
 * position so a card is three taps from the board without any dragging.
 *
 * On a wide screen the same component becomes the middle pane — a vertical
 * column between the library and the board, which is the direction the whole
 * layout moves in.
 *
 * It is also a drop target. Dragging a planned Meal back here is how it leaves
 * the week without being forgotten: it returns to the Backlog rather than being
 * deleted, which is what "we're not cooking that on Tuesday after all" means.
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
  pane: { paddingTop: tokens.space.md, gap: 11, minHeight: '100%' },
  hovered: { backgroundColor: 'rgba(192, 90, 56, 0.06)' },
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
  remove: { position: 'absolute', top: 2, right: 4, padding: 6, zIndex: 1 },
  removeText: { ...tokens.type.meta, color: tokens.color.textGhost },
  empty: { paddingHorizontal: tokens.space.md },
  emptyText: { ...tokens.type.body, color: tokens.color.textSupport },
  /** Shown only while a planned card is in the air, so the way back is
   *  visible at the moment it is wanted. */
  dropHere: {
    marginHorizontal: tokens.space.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.color.action,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 13,
  },
  dropHereText: { ...tokens.type.support, fontWeight: '600', color: tokens.color.action },
})

type Props = {
  readonly items: readonly BacklogItem[]
  readonly layout?: BacklogLayout
  readonly onAdd?: () => void
  readonly onPlan?: (id: BacklogItemId) => void
  readonly onRemove?: (id: BacklogItemId) => void
  /** Dragging is the accelerator; tapping always works and does the same thing
   *  through the plan sheet. */
  readonly onDropped?: ((payload: DragPayload, target: DropTarget) => void) | undefined
}

export const BacklogShelf = ({
  items,
  layout = 'shelf',
  onAdd,
  onPlan,
  onRemove,
  onDropped,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const { dragging, hovered, registerTarget } = useDrag()
  const ref = useRef<View>(null)
  const isShelf = layout === 'shelf'
  const isHovered = isSameTarget(hovered, { kind: 'backlog' })
  const canReceive = dragging?.kind === 'cook-event'

  useEffect(() => {
    const target = { kind: 'backlog' } as const

    registerTarget(target, (report) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        report({ x, y, width, height })
      })
    })

    return () => {
      registerTarget(target, undefined)
    }
  }, [registerTarget])

  const cards = items.map((backlogItem) => (
    <View key={backlogItem.id} style={[styles.cardWrap, isShelf && styles.shelfCard]}>
      <Pressable
        style={styles.remove}
        onPress={() => onRemove?.(backlogItem.id)}
        accessibilityRole="button"
        accessibilityLabel={t('unplan.removeBacklog')}
        testID={`backlog-remove-${backlogItem.id}`}
      >
        <Text style={styles.removeText}>×</Text>
      </Pressable>
      <DraggableCard
        payload={{ kind: 'backlog', item: backlogItem }}
        onDropped={onDropped}
        onTap={() => onPlan?.(backlogItem.id)}
        accessibilityLabel={backlogItem.mealName}
        testID={`backlog-item-${backlogItem.id}`}
      >
        <MealCard
          variant="backlog"
          name={backlogItem.mealName}
          addedBy={backlogItem.addedByName}
          addedByColour={backlogItem.addedByColour}
        />
      </DraggableCard>
    </View>
  ))

  return (
    <View
      ref={ref}
      style={[isShelf ? styles.shelf : styles.pane, isHovered && styles.hovered]}
      testID="backlog-shelf"
    >
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

      {canReceive && (
        <View style={styles.dropHere} testID="backlog-drop-hint">
          <Text style={styles.dropHereText}>{t('backlog.dropToRemove')}</Text>
        </View>
      )}

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
