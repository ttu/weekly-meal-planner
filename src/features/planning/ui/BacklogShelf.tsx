import { useEffect, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
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

const sheets = themed((tokens) =>
  StyleSheet.create({
    shelf: {
      backgroundColor: tokens.color.surfaceRaised,
      borderTopWidth: 1,
      borderTopColor: tokens.color.cardBorder,
      paddingTop: 12,
      paddingBottom: 26,
      gap: 11,
      boxShadow: tokens.shadow.shelf,
    },
    paneFill: { flex: 1, minHeight: 0 },
    paneScroll: { flex: 1 },
    pane: { paddingTop: tokens.space.md, gap: 11, flexGrow: 1 },
    hovered: { backgroundColor: tokens.color.dropTint },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: tokens.space.md,
    },
    /** The shelf's paper spans the window; its contents line up with the board
     *  column above them. */
    measure: { width: '100%', maxWidth: tokens.layout.readable, alignSelf: 'center' },
    headingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    /** The grab handle: the shelf is a surface that can be pulled up. */
    grip: { width: 28, height: 4, borderRadius: 2, backgroundColor: tokens.color.cardBorder },
    heading: { ...tokens.type.label, color: tokens.color.textPrimary, textTransform: 'uppercase' },
    headingPane: { color: tokens.color.textSupport },
    count: {
      fontFamily: tokens.type.label.fontFamily,
      fontSize: tokens.type.label.fontSize,
      fontWeight: '700',
      color: tokens.color.textPrimary,
      backgroundColor: tokens.color.backlog,
      borderRadius: 9,
      paddingHorizontal: 8,
      paddingVertical: 1,
      overflow: 'hidden',
    },
    add: { ...tokens.type.body, fontWeight: '600', color: tokens.color.action },
    addHit: {
      paddingVertical: 12,
      marginVertical: -12,
      paddingHorizontal: 8,
      marginHorizontal: -8,
    },
    row: { flexDirection: 'row', gap: 10, paddingHorizontal: tokens.space.md },
    column: { paddingHorizontal: 14, gap: 9 },
    shelfCard: { width: 168 },
    cardWrap: { position: 'relative' },
    /** Removal sits on the card as a corner affordance rather than a row of its
     *  own: a shelf card is 168px wide and cannot spare a line. */
    /** Padded out to a thumb and positioned back so the glyph sits where it
     *  always did. react-native-web ignores hitSlop, so the target has to be
     *  real padding. */
    remove: { position: 'absolute', top: -6, right: -4, padding: 14, zIndex: 1 },
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
  }),
)

type Props = {
  readonly items: readonly BacklogItem[]
  readonly layout?: BacklogLayout
  readonly onAdd?: () => void
  readonly onPlan?: (id: BacklogItemId) => void
  readonly onRemove?: (id: BacklogItemId) => void
  /** Replaces "Nobody has added anything yet." on a board where nothing has
   *  happened at all — see DayOne. */
  readonly empty?: React.JSX.Element | undefined
  /** Dragging is the accelerator; tapping always works and does the same thing
   *  through the plan sheet. */
  readonly onDropped?: ((payload: DragPayload, target: DropTarget) => void) | undefined
}

/** The shelf's own heading row: a grab handle on a phone, the count once
 *  anything is wanted, and the add button the shelf layout carries. */
const BacklogHeader = ({
  isShelf,
  count,
  onAdd,
}: {
  readonly isShelf: boolean
  readonly count: number
  readonly onAdd?: (() => void) | undefined
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={[styles.header, isShelf && styles.measure]}>
      <View style={styles.headingRow}>
        {isShelf && <View style={styles.grip} />}
        <Text style={[styles.heading, !isShelf && styles.headingPane]}>
          {isShelf ? t('backlog.count') : t('board.backlogHeading')}
        </Text>
        {count > 0 && (
          <Text style={styles.count} testID="backlog-count">
            {String(count)}
          </Text>
        )}
      </View>
      {isShelf && <AddButton onAdd={onAdd} />}
    </View>
  )
}

const AddButton = ({ onAdd }: { readonly onAdd?: (() => void) | undefined }): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <Pressable
      style={styles.addHit}
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel={t('backlog.add')}
      testID="backlog-add"
    >
      <Text style={styles.add}>{t('backlog.addShort')}</Text>
    </Pressable>
  )
}

/** What the Backlog will do with the card being carried: take it off the week,
 *  or want it in the first place. */
const DropHint = ({ dragKind }: { readonly dragKind: DragPayload['kind'] }): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.dropHere} testID="backlog-drop-hint">
      <Text style={styles.dropHereText}>
        {dragKind === 'library' ? t('backlog.dropToWant') : t('backlog.dropToRemove')}
      </Text>
    </View>
  )
}

export const BacklogShelf = ({
  items,
  layout = 'shelf',
  onAdd,
  onPlan,
  onRemove,
  empty,
  onDropped,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const { dragging, hovered, registerTarget } = useDrag()
  const ref = useRef<View>(null)
  const isShelf = layout === 'shelf'
  const isHovered = isSameTarget(hovered, { kind: 'backlog' })
  const canReceive = dragging?.kind === 'cook-event' || dragging?.kind === 'library'

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

  // Three shapes, not a chain: nothing wanted yet, a shelf that scrolls
  // sideways under the board, or a column down the side of a wide screen.
  const list = ((): React.JSX.Element => {
    if (items.length === 0) {
      return (
        <View style={[styles.empty, isShelf && styles.measure]} testID="backlog-empty">
          {empty ?? <Text style={styles.emptyText}>{t('backlog.empty')}</Text>}
        </View>
      )
    }
    if (isShelf) {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.row, styles.measure]}>{cards}</View>
        </ScrollView>
      )
    }
    return <View style={styles.column}>{cards}</View>
  })()

  const content = (
    <>
      <BacklogHeader isShelf={isShelf} count={items.length} onAdd={onAdd} />
      {canReceive && <DropHint dragKind={dragging.kind} />}
      {list}
    </>
  )

  if (isShelf) {
    return (
      <View ref={ref} style={[styles.shelf, isHovered && styles.hovered]} testID="backlog-shelf">
        {content}
      </View>
    )
  }

  // The drop target is the pane itself — the whole column — not the cards
  // inside it, which are only as tall as their contents.
  return (
    <View ref={ref} style={[styles.paneFill, isHovered && styles.hovered]} testID="backlog-shelf">
      <ScrollView style={styles.paneScroll} contentContainerStyle={styles.pane}>
        {content}
      </ScrollView>
    </View>
  )
}
