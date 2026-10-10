import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { Avatar } from '@/shared/ui/Avatar'
import { useTranslation } from '@/shared/i18n'
import {
  BoardMenu,
  ShareSheet,
  boardUrl,
  signOut,
  usePresence,
  useSession,
  type PresentMember,
  type SlotKey,
} from '@/features/household'
import { MealLibraryScreen, MealPicker, useHouseholdMeals } from '@/features/meals'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useWideScreen } from '@/shared/layout/useWideScreen'
import { BacklogShelf } from './BacklogShelf'
import { DayOne } from './DayOne'
import { BoardHeader } from './BoardHeader'
import { DayColumn } from './DayColumn'
import { WeekStrip } from './WeekStrip'
import { WideDayColumn } from './WideDayColumn'
import { formatWeekRange } from '../domain/format-day'
import { resolveDrop } from '../domain/drop'
import { breaksLeftoverOrder } from '../domain/leftover-order'
import { useWeekBoard } from './useWeekBoard'
import { useSelectedWeek } from './SelectedWeek'
import { useAddToBacklog } from './useAddToBacklog'
import { usePlanMeal } from './usePlanMeal'
import { usePlanningActions } from './usePlanningActions'
import { useWeekRealtime } from './useWeekRealtime'
import { useRecentlyChangedDays } from './useRecentlyChangedDays'
import { WideBoardLayout } from './WideBoardLayout'
import { DragProvider, type DragPayload, type DropTarget } from './DragContext'
import type { DropAction } from '../domain/drop'
import { DragLayer } from './DragLayer'
import { DraggableCard } from './DraggableCard'
import { useEdgeAutoScroll } from './useEdgeAutoScroll'
import { PlanSheet } from './PlanSheet'
import { ServingsSheet } from './ServingsSheet'
import { AppNav } from '@/shared/ui/AppNav'
import { ConfirmSheet } from '@/shared/ui/ConfirmSheet'
import { Notice } from '@/shared/ui/Notice'
import type { BacklogItem, CookEvent, CookEventId, LeftoverId } from '../domain/types'

const sheets = themed((tokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: tokens.color.surface },
    dragHint: { ...tokens.type.meta, color: tokens.color.textSupport },
    /**
     * Padding out to 44 and then pulled back in by the same amount, so the
     * target is a thumb's worth while the row keeps the height it was drawn
     * at. `hitSlop` would say this more plainly but react-native-web ignores
     * it, and the web build is the one in front of people today.
     */
    navHit: {
      paddingVertical: 13,
      marginVertical: -13,
      paddingHorizontal: 6,
      marginHorizontal: -6,
    },
    boardNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.space.sm,
    },
    boardNameHit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      flexShrink: 1,
    },
    boardName: { ...tokens.type.support, fontWeight: '600', color: tokens.color.textMuted },
    boardNameCaret: { ...tokens.type.meta, color: tokens.color.textSupport },
    titleBlock: { flexShrink: 1 },
    /** The week, over the seven columns it names. */
    wideWeekHeading: {
      paddingHorizontal: tokens.space.md,
      paddingTop: tokens.space.md,
      paddingBottom: tokens.space.sm,
    },
    /** A dashed seat at the end of the row of faces: the empty chair is the
     *  invitation. */
    invitePlus: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tokens.color.textGhost,
      backgroundColor: tokens.color.surfaceInset,
      alignItems: 'center',
      justifyContent: 'center',
    },
    invitePlusGlyph: { ...tokens.type.support, color: tokens.color.textMuted },
    weekNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    weekArrow: { ...tokens.type.dayHeading, color: tokens.color.action, lineHeight: 30 },
    weekArrowHit: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tokens.color.cardBorder,
      backgroundColor: tokens.color.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekBackHit: { paddingVertical: 11, marginVertical: -11, alignSelf: 'flex-start' },
    weekBack: { ...tokens.type.meta, color: tokens.color.action },
    scroll: { flex: 1 },
    /** Capped like every other column of text: between the phone and the 1024px
     *  breakpoint sits the whole tablet range, and a stretched phone layout is
     *  what a tablet got. */
    content: {
      paddingHorizontal: 20,
      paddingBottom: tokens.space.xl,
      gap: 18,
      width: '100%',
      maxWidth: tokens.layout.readable,
      alignSelf: 'center',
    },
    /** The phone's own chrome: quiet links, then the title block the canvas
     *  leads with. The one loud thing stays the Shopping List. */
    links: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md, flexWrap: 'wrap' },
    link: { ...tokens.type.meta, color: tokens.color.textSupport },
    /** Wraps rather than overflows: the week arrows, the faces and the
     *  Shopping button together are wider than a 390px phone. */
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: tokens.space.sm,
    },
    title: { ...tokens.type.display, color: tokens.color.textPrimary },
    week: { ...tokens.type.support, color: tokens.color.textSupport },
    presence: { flexDirection: 'row' },
    overlap: { marginLeft: -9 },
    shopping: {
      backgroundColor: tokens.color.action,
      borderRadius: 9,
      paddingHorizontal: 14,
      minHeight: 44,
      justifyContent: 'center',
    },
    shoppingText: { ...tokens.type.support, fontWeight: '600', color: tokens.color.onAction },
    days: { gap: 18 },
  }),
)

type Props = {
  readonly clock?: Clock
  readonly origin?: string
  readonly onOpenLibrary?: (() => void) | undefined
  readonly onOpenShopping?: (() => void) | undefined
  readonly onOpenSettings?: (() => void) | undefined
  /** Opens the Meal editor. Given a name when it comes from a search that
   *  found nothing, so the Meal starts with the words already typed. */
  readonly onWriteOwnMeal?: ((name?: string) => void) | undefined
  /** Buy Lines still unticked, for the badge on the Shopping destination. */
  readonly shoppingCount?: number | undefined
  readonly onShare?: ((url: string) => void) | undefined
  readonly shared?: boolean | undefined
}

const Board = ({
  clock = systemClock,
  origin = '',
  onOpenLibrary,
  onOpenShopping,
  onOpenSettings,
  onWriteOwnMeal,
  shoppingCount,
  onShare: onShareUrl,
  shared = false,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const session = useSession()
  const household = session.household
  const me = session.member
  const locale = household?.locale ?? 'fi'
  const { board, backlog, weekPlanId, householdName, weekStart } = useWeekBoard(clock)
  const { changedDays, markChanged } = useRecentlyChangedDays()
  useWeekRealtime(weekStart, markChanged)
  const present = usePresence(weekStart, me)
  const { meals } = useHouseholdMeals()
  const { add, hasFailed } = useAddToBacklog(clock)
  const { plan, isPending: planPending, hasFailed: planFailed } = usePlanMeal(clock)
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<DropTarget | undefined>(undefined)
  const [planning, setPlanning] = useState<BacklogItem | undefined>(undefined)
  const {
    addLeftoverFor,
    move,
    moveLeftoverTo,
    removeLeftoverCard,
    unplan,
    setServings,
    removeFromBacklog,
    leftoverFailed,
    moveFailed,
    unplanFailed,
  } = usePlanningActions(clock)
  const [unplanning, setUnplanning] = useState<CookEvent | undefined>(undefined)
  /**
   * The two × buttons that used to delete on the first tap. Both sit a few
   * pixels from something else worth pressing, and neither can be undone —
   * so both now ask, the same way unplanning does.
   */
  const [removingBacklog, setRemovingBacklog] = useState<BacklogItem | undefined>(undefined)
  const [removingLeftover, setRemovingLeftover] = useState<LeftoverId | undefined>(undefined)
  const [editingServings, setEditingServings] = useState<CookEvent | undefined>(undefined)
  const { offset, goToWeek } = useSelectedWeek(clock)
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [orderRefused, setOrderRefused] = useState(false)
  const [isSharing, setSharing] = useState(false)
  const isWide = useWideScreen()
  const scroll = useRef<ScrollView>(null)
  const autoScroll = useEdgeAutoScroll(scroll)
  const dayOffsets = useRef(new Map<string, number>())

  const shareUrl = household === undefined ? '' : boardUrl(origin, household.shareToken)

  /** Opens the panel rather than copying silently: the link alone is half of
   *  what a recipient needs, and nothing used to say so. */
  const onShare = (): void => {
    if (household === undefined) return
    setSharing(true)
  }

  const allCards = board.flatMap((day) => day.slots).flatMap((slot) => slot.cards)
  /** The Household's own order of Slots, which is what "before" means within
   *  a day: lunch precedes dinner because they put it there. */
  const slotOrder = (board[0]?.slots ?? []).map((slot) => slot.slotKey)

  const leftoverCountFor = (id: CookEventId): number =>
    allCards.filter((card) => card.kind === 'leftover' && card.leftover.cookEventId === id).length

  const cookEventById = (id: CookEventId): CookEvent | undefined =>
    allCards
      .flatMap((card) => (card.kind === 'cook-event' ? [card.cookEvent] : []))
      .find((cookEvent) => cookEvent.id === id)

  const today = clock.now().toISOString().slice(0, 10)

  /**
   * A second sitting lands on the same day and Slot as the Meal it came from,
   * directly beneath it, and is dragged wherever it belongs from there.
   *
   * It used to ask which day and Slot first. That put a sheet between "we'll
   * have this again" and seeing it on the board, and the answer was almost
   * always "somewhere I can point at", which is what dragging is for.
   */
  const addSecondSitting = (cookEventId: CookEventId): void => {
    const cookEvent = cookEventById(cookEventId)
    if (cookEvent === undefined) return
    addLeftoverFor({ cookEventId, date: cookEvent.date, slotKey: cookEvent.slotKey })
  }
  const weekRange = formatWeekRange(
    board.map((day) => day.date),
    locale,
  )
  const plannedDates = new Set(
    board.filter((day) => day.slots.some((slot) => slot.cards.length > 0)).map((day) => day.date),
  )

  /** Tapping an empty Slot opens the picker already aimed at that Slot, so the
   *  Meal is planned in one step rather than parked in the Backlog first. */
  const openPickerFor = (date: string, slotKey: SlotKey): void => {
    setPickerTarget({ kind: 'slot', date, slotKey })
    setPickerOpen(true)
  }

  /** What a drop means is decided in the domain; this only carries it out,
   *  through the same mutations the tap path uses. */
  const onDropped = (payload: DragPayload, target: DropTarget): void => {
    const action = resolveDrop(payload, target)

    // A Leftover is a second sitting of a pot already cooked, so it cannot be
    // carried back past its Meal — nor the Meal forward past it. The card goes
    // home and the board says why, rather than leaving Wednesday eating the
    // leftovers of Friday's dinner.
    const order = orderedMove(action, payload)
    if (order !== undefined && breaksLeftoverOrder(order, allCards, slotOrder)) {
      setOrderRefused(true)
      setTimeout(() => {
        setOrderRefused(false)
      }, 4000)
      return
    }

    switch (action.kind) {
      case 'want':
        add(action.mealId)
        return
      case 'plan':
        // weekPlanId may be undefined on a week nobody has planned into yet;
        // the mutation makes the Week Plan when it is.
        plan({ weekPlanId, ...action })
        return
      case 'move':
        move(action)
        return
      case 'move-leftover':
        moveLeftoverTo(action)
        return
      case 'unplan':
        unplan(action.cookEventId)
        return
      case 'none':
        return
    }
  }

  const header = (
    <BoardHeader
      householdName={householdName}
      present={present}
      active="week"
      shoppingCount={shoppingCount}
      onGo={(destination) => {
        if (destination === 'meals') onOpenLibrary?.()
        if (destination === 'shopping') onOpenShopping?.()
      }}
      onOpenMenu={() => {
        setMenuOpen(true)
      }}
      onShare={onShare}
    />
  )

  /** Day one: nothing wanted, nothing planned. Not the same as an empty
   *  Backlog, which is the ordinary state of a week that is already planned. */
  const isDayOne =
    backlog.length === 0 && board.every((day) => day.slots.every((slot) => slot.cards.length === 0))

  const dayOne = (
    <DayOne
      onBrowse={() => {
        setPickerTarget(undefined)
        setPickerOpen(true)
      }}
      onWriteOwn={() => {
        onWriteOwnMeal?.()
      }}
      onInvite={onShare}
    />
  )

  const shelf = (layout: 'shelf' | 'pane'): React.JSX.Element => {
    return (
      <BacklogShelf
        layout={layout}
        onDropped={onDropped}
        items={backlog}
        {...(isDayOne ? { empty: dayOne } : {})}
        onAdd={() => {
          setPickerTarget(undefined)
          setPickerOpen(true)
        }}
        onPlan={(id) => {
          setPlanning(backlog.find((item) => item.id === id))
        }}
        onRemove={(id) => {
          setRemovingBacklog(backlog.find((item) => item.id === id))
        }}
      />
    )
  }

  const overlays = (
    <>
      {planning !== undefined && weekPlanId !== undefined && (
        <PlanSheet
          visible
          mealName={planning.mealName}
          addedByName={planning.addedByName}
          defaultServings={planning.servings}
          board={board}
          slots={household?.slots ?? []}
          today={today}
          locale={locale}
          isPending={planPending}
          onSubmit={(choice) => {
            plan({
              weekPlanId,
              mealId: planning.mealId,
              backlogItemId: planning.id,
              ...choice,
            })
            setPlanning(undefined)
          }}
          onDismiss={() => {
            setPlanning(undefined)
          }}
        />
      )}

      {isMenuOpen && (
        <BoardMenu
          boardName={session.household?.name ?? ''}
          otherMembers={present.map((member) => member.displayName)}
          onInvite={() => {
            setMenuOpen(false)
            onShare()
          }}
          onMealTimes={() => {
            setMenuOpen(false)
            onOpenSettings?.()
          }}
          onSettings={() => {
            setMenuOpen(false)
            onOpenSettings?.()
          }}
          onLeave={() => {
            setMenuOpen(false)
            void signOut(session.client)
          }}
          onDismiss={() => {
            setMenuOpen(false)
          }}
        />
      )}

      {editingServings !== undefined && (
        <ServingsSheet
          mealName={editingServings.mealName}
          servingsCooked={editingServings.servingsCooked}
          onSave={(servings) => {
            setServings(editingServings.id, servings)
            setEditingServings(undefined)
          }}
          onDismiss={() => {
            setEditingServings(undefined)
          }}
        />
      )}

      {removingBacklog !== undefined && (
        <ConfirmSheet
          visible
          message={t('backlog.removeConfirm', { meal: removingBacklog.mealName })}
          confirmLabel={t('backlog.removeConfirmYes')}
          cancelLabel={t('backlog.removeConfirmNo')}
          onConfirm={() => {
            removeFromBacklog(removingBacklog.id)
            setRemovingBacklog(undefined)
          }}
          onCancel={() => {
            setRemovingBacklog(undefined)
          }}
        />
      )}

      {removingLeftover !== undefined && (
        <ConfirmSheet
          visible
          message={t('leftover.removeConfirm')}
          confirmLabel={t('leftover.removeConfirmYes')}
          cancelLabel={t('leftover.removeConfirmNo')}
          onConfirm={() => {
            removeLeftoverCard(removingLeftover)
            setRemovingLeftover(undefined)
          }}
          onCancel={() => {
            setRemovingLeftover(undefined)
          }}
        />
      )}

      {unplanning !== undefined && (
        <ConfirmSheet
          visible
          message={t('unplan.confirm')}
          detail={
            leftoverCountFor(unplanning.id) > 0
              ? t('unplan.confirmWithLeftovers', { count: leftoverCountFor(unplanning.id) })
              : undefined
          }
          confirmLabel={t('unplan.confirmYes')}
          cancelLabel={t('unplan.confirmNo')}
          onConfirm={() => {
            unplan(unplanning.id)
            setUnplanning(undefined)
          }}
          onCancel={() => {
            setUnplanning(undefined)
          }}
        />
      )}

      <ShareSheet
        visible={isSharing}
        url={shareUrl}
        justCopied={shared}
        onCopy={() => {
          onShareUrl?.(shareUrl)
        }}
        onClose={() => {
          setSharing(false)
        }}
      />

      <MealPicker
        visible={isPickerOpen}
        meals={meals}
        {...(onWriteOwnMeal === undefined
          ? {}
          : {
              onWriteItDown: (name: string) => {
                setPickerOpen(false)
                onWriteOwnMeal(name)
              },
            })}
        onSelect={(mealId) => {
          const target = pickerTarget
          const servings = meals.find((meal) => meal.id === mealId)?.servings
          if (target === undefined || target.kind !== 'slot' || servings === undefined) {
            add(mealId)
          } else {
            plan({
              weekPlanId,
              mealId,
              date: target.date,
              slotKey: target.slotKey,
              servingsCooked: servings,
            })
          }
          setPickerOpen(false)
          setPickerTarget(undefined)
        }}
        onDismiss={() => {
          setPickerOpen(false)
          setPickerTarget(undefined)
        }}
      />
    </>
  )

  const errors = (
    <>
      {hasFailed && <Notice message={t('picker.addFailed')} testID="backlog-add-error" />}
      {planFailed && <Notice message={t('plan.failed')} testID="plan-error" />}
      {leftoverFailed && <Notice message={t('leftover.failed')} testID="leftover-error" />}
      {moveFailed && <Notice message={t('plan.moveFailed')} testID="move-error" />}
      {unplanFailed && <Notice message={t('unplan.failed')} testID="unplan-error" />}
      {orderRefused && <Notice message={t('board.leftoverOrder')} testID="leftover-order-error" />}
    </>
  )

  if (isWide) {
    return (
      <WideBoardLayout
        style={{ paddingTop: insets.top }}
        header={header}
        weekHeading={
          <View style={styles.wideWeekHeading}>
            <BoardTitleRow weekRange={weekRange} offset={offset} onGoToWeek={goToWeek} />
          </View>
        }
        library={
          <MealLibraryScreen
            layout="pane"
            meals={meals}
            onSelect={(mealId) => {
              add(mealId)
            }}
            onAdd={onOpenLibrary}
            wrapRow={(meal, row) => (
              <DraggableCard
                payload={{
                  kind: 'library',
                  meal: { id: meal.id, name: meal.name, servings: meal.servings },
                }}
                onDropped={onDropped}
                onTap={() => {
                  add(meal.id)
                }}
                accessibilityLabel={meal.name}
              >
                {row}
              </DraggableCard>
            )}
          />
        }
        backlog={shelf('pane')}
        board={
          <View style={{ flex: 1, flexDirection: 'row' }} testID="board">
            {board.map((day, index) => (
              <WideDayColumn
                key={day.date}
                day={day}
                isToday={day.date === today}
                isLast={index === board.length - 1}
                locale={locale}
                recentlyChanged={changedDays.has(day.date)}
                onSelect={(id) => {
                  setUnplanning(cookEventById(id))
                }}
                onAddLeftover={addSecondSitting}
                onAddMeal={openPickerFor}
                onEditServings={setEditingServings}
                onRemoveLeftover={setRemovingLeftover}
                onDropped={onDropped}
              />
            ))}
          </View>
        }
        overlays={
          <>
            {errors}
            {overlays}
            <DragLayer />
          </>
        }
      />
    )
  }

  return (
    <View style={styles.screen} testID="board-screen">
      {/* The wrapper is what the auto-scroll measures: it needs the viewport's
          position on screen to know when the card is near an edge. */}
      <View ref={autoScroll.viewportRef} style={styles.scroll} collapsable={false}>
        <ScrollView
          ref={scroll}
          style={styles.scroll}
          scrollEventThrottle={16}
          onScroll={autoScroll.onScroll}
          onContentSizeChange={autoScroll.onContentSizeChange}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + tokens.space.md }]}
        >
          <View style={styles.boardNameRow}>
            <BoardNameButton
              boardName={session.household?.name ?? ''}
              onPress={() => {
                setMenuOpen(true)
              }}
            />
            <PresenceRow present={present} onInvite={onShare} />
          </View>

          <BoardTitleRow weekRange={weekRange} offset={offset} onGoToWeek={goToWeek} />

          <WeekStrip
            dates={board.map((day) => day.date)}
            today={today}
            locale={locale}
            plannedDates={plannedDates}
            onSelect={(date) => {
              scroll.current?.scrollTo({ y: dayOffsets.current.get(date) ?? 0, animated: true })
            }}
          />

          {/* The phone is where carrying a card is least obvious — it needs a
              deliberate hold, and nothing on screen says so. Shown only once
              there is something to carry; an empty board has DayOne for
              guidance and no room to spare. */}
          {(backlog.length > 0 || plannedDates.size > 0) && (
            <Text style={styles.dragHint} testID="drag-hint">
              {t('board.dropHintTouch')}
            </Text>
          )}

          <View style={styles.days} testID="board">
            {board.map((day) => (
              <View
                key={day.date}
                onLayout={(event) => {
                  dayOffsets.current.set(day.date, event.nativeEvent.layout.y)
                }}
              >
                <DayColumn
                  day={day}
                  isToday={day.date === today}
                  locale={locale}
                  recentlyChanged={changedDays.has(day.date)}
                  onAddLeftover={addSecondSitting}
                  onUnplan={(id) => {
                    setUnplanning(cookEventById(id))
                  }}
                  onAddMeal={openPickerFor}
                  onEditServings={setEditingServings}
                  onRemoveLeftover={setRemovingLeftover}
                  onDropped={onDropped}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {errors}

      {shelf('shelf')}

      {/* Under the thumb, below the shelf: the three places a Member goes. */}
      <AppNav
        active="week"
        shoppingCount={shoppingCount}
        onGo={(destination) => {
          if (destination === 'meals') onOpenLibrary?.()
          if (destination === 'shopping') onOpenShopping?.()
        }}
      />

      {overlays}

      <DragLayer />
    </View>
  )
}

/**
 * Drag state wraps the whole board: the Backlog cards that start a drag and the
 * Slots that receive it are in different subtrees.
 */
/**
 * The board's name, and the way into everything that is not a destination.
 * Four equal-weight text links used to sit here, one of which signed you out.
 */
const BoardNameButton = ({
  boardName,
  onPress,
}: {
  readonly boardName: string
  readonly onPress: () => void
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <Pressable
      style={styles.boardNameHit}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('nav.boardMenu')}
      testID="open-board-menu"
    >
      <Text style={styles.boardName}>{boardName}</Text>
      <Text style={styles.boardNameCaret}>▾</Text>
    </Pressable>
  )
}

/** Who else is looking at this week, overlapped like a stack of faces. */
const PresenceRow = ({
  present,
  onInvite,
}: {
  readonly present: readonly PresentMember[]
  /** The dashed "+" at the end of the faces. Sharing belongs where you see
   *  who is already here. */
  readonly onInvite?: (() => void) | undefined
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  const { t } = useTranslation()

  return (
    <View style={styles.presence} testID="presence">
      {present.map((member, index) => (
        <View key={member.userId} style={index > 0 && styles.overlap}>
          <Avatar
            name={member.displayName}
            colour={member.colour}
            size="large"
            ringColour={theme.color.surface}
          />
        </View>
      ))}
      {onInvite !== undefined && (
        <Pressable
          style={[styles.invitePlus, present.length > 0 && styles.overlap]}
          onPress={onInvite}
          accessibilityRole="button"
          accessibilityLabel={t('nav.invite')}
          testID="invite-plus"
        >
          <Text style={styles.invitePlusGlyph}>+</Text>
        </Pressable>
      )}
    </View>
  )
}

/** The week being planned, who else is in it, and the way to the Shopping
 *  List - the one thing the week is for. */
/** "This week", "Next week", "In 3 weeks" — the heading says which week is on
 *  screen, because after one tap of an arrow it is no longer obvious. */
/** The two drops that can break the order, as the rule wants them. */
const orderedMove = (
  action: DropAction,
  payload: DragPayload,
): Parameters<typeof breaksLeftoverOrder>[0] | undefined => {
  if (action.kind === 'move-leftover' && payload.kind === 'leftover') {
    return { kind: 'leftover', cookEventId: payload.leftover.cookEventId, to: action }
  }
  if (action.kind === 'move') {
    return { kind: 'cook-event', cookEventId: action.cookEventId, to: action }
  }
  return undefined
}

const weekHeadingKey = (offset: number): { key: string; count: number } => {
  if (offset === 0) return { key: 'board.thisWeek', count: 0 }
  if (offset === 1) return { key: 'board.weekAhead', count: 1 }
  if (offset === -1) return { key: 'board.weekPast', count: 1 }
  return offset > 0
    ? { key: 'board.weeksAhead', count: offset }
    : { key: 'board.weeksPast', count: Math.abs(offset) }
}

const BoardTitleRow = ({
  weekRange,
  offset,
  onGoToWeek,
}: {
  readonly weekRange: string
  readonly offset: number
  readonly onGoToWeek: (offset: number) => void
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.titleRow}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>
          {t(weekHeadingKey(offset).key, { count: weekHeadingKey(offset).count })}
        </Text>
        <Text style={styles.week}>{weekRange}</Text>
        {offset !== 0 && (
          <Pressable
            style={styles.weekBackHit}
            onPress={() => {
              onGoToWeek(0)
            }}
            accessibilityRole="button"
            accessibilityLabel={t('board.backToThisWeek')}
            testID="week-back-to-now"
          >
            <Text style={styles.weekBack}>{t('board.backToThisWeek')}</Text>
          </Pressable>
        )}
      </View>

      {/* Side by side on the right, as 44px buttons. Either side of the title
          they moved the title whenever the week's words changed length, and
          they were hard to hit. */}
      <View style={styles.weekNav}>
        <Pressable
          style={styles.weekArrowHit}
          onPress={() => {
            onGoToWeek(offset - 1)
          }}
          accessibilityRole="button"
          accessibilityLabel={t('board.previousWeek')}
          testID="week-previous"
        >
          <Text style={styles.weekArrow}>‹</Text>
        </Pressable>
        <Pressable
          style={styles.weekArrowHit}
          onPress={() => {
            onGoToWeek(offset + 1)
          }}
          accessibilityRole="button"
          accessibilityLabel={t('board.nextWeek')}
          testID="week-next"
        >
          <Text style={styles.weekArrow}>›</Text>
        </Pressable>
      </View>
    </View>
  )
}

export const BoardScreen = (props: Props): React.JSX.Element => {
  return (
    <DragProvider>
      <Board {...props} />
    </DragProvider>
  )
}
