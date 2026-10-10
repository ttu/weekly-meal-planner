import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { Avatar } from '@/shared/ui/Avatar'
import { useTranslation } from '@/shared/i18n'
import {
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
import { useWeekBoard } from './useWeekBoard'
import { useSelectedWeek } from './SelectedWeek'
import { useAddToBacklog } from './useAddToBacklog'
import { usePlanMeal } from './usePlanMeal'
import { usePlanningActions } from './usePlanningActions'
import { useWeekRealtime } from './useWeekRealtime'
import { useRecentlyChangedDays } from './useRecentlyChangedDays'
import { WideBoardLayout } from './WideBoardLayout'
import { DragProvider, type DragPayload, type DropTarget } from './DragContext'
import { DragLayer } from './DragLayer'
import { DraggableCard } from './DraggableCard'
import { useEdgeAutoScroll } from './useEdgeAutoScroll'
import { PlanSheet } from './PlanSheet'
import { ServingsSheet } from './ServingsSheet'
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
    weekNav: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
    weekArrow: { ...tokens.type.dayHeading, color: tokens.color.action, lineHeight: 30 },
    weekArrowHit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
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
      weekRange={weekRange}
      present={present}
      shared={shared}
      onShare={onShare}
      onOpenShopping={onOpenShopping}
      onOpenLibrary={onOpenLibrary}
      onOpenSettings={onOpenSettings}
      onSignOut={() => {
        void signOut(session.client)
      }}
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
    </>
  )

  if (isWide) {
    return (
      <WideBoardLayout
        style={{ paddingTop: insets.top }}
        header={header}
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
          <BoardLinks
            shared={shared}
            onOpenLibrary={onOpenLibrary}
            onShare={onShare}
            onOpenSettings={onOpenSettings}
            onSignOut={() => {
              void signOut(session.client)
            }}
          />

          <BoardTitleRow
            weekRange={weekRange}
            present={present}
            offset={offset}
            onGoToWeek={goToWeek}
            onOpenShopping={onOpenShopping}
          />

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

      {overlays}

      <DragLayer />
    </View>
  )
}

/**
 * Drag state wraps the whole board: the Backlog cards that start a drag and the
 * Slots that receive it are in different subtrees.
 */
/** One of the board's top-row destinations. Four of them, identical but for
 *  their words, so they are one component used four times. */
const NavLink = ({
  label,
  onPress,
  testID,
}: {
  readonly label: string
  readonly onPress?: (() => void) | undefined
  readonly testID: string
}): React.JSX.Element => {
  const styles = useThemed(sheets)

  return (
    <Pressable
      style={styles.navHit}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  )
}

/** Everything the board is not: the library, the share link, settings, and the
 *  way out. */
const BoardLinks = ({
  shared,
  onOpenLibrary,
  onShare,
  onOpenSettings,
  onSignOut,
}: {
  readonly shared: boolean
  readonly onOpenLibrary?: (() => void) | undefined
  readonly onShare?: (() => void) | undefined
  readonly onOpenSettings?: (() => void) | undefined
  readonly onSignOut: () => void
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.links}>
      <NavLink label={t('meal.library')} onPress={onOpenLibrary} testID="open-library" />
      <NavLink
        label={shared ? t('board.shareCopied') : t('board.share')}
        onPress={onShare}
        testID="share-board"
      />
      <NavLink label={t('nav.settings')} onPress={onOpenSettings} testID="open-settings" />
      <NavLink label={t('auth.signOut')} onPress={onSignOut} testID="sign-out" />
    </View>
  )
}

/** Who else is looking at this week, overlapped like a stack of faces. */
const PresenceRow = ({
  present,
}: {
  readonly present: readonly PresentMember[]
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()

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
    </View>
  )
}

/** The week being planned, who else is in it, and the way to the Shopping
 *  List - the one thing the week is for. */
/** "This week", "Next week", "In 3 weeks" — the heading says which week is on
 *  screen, because after one tap of an arrow it is no longer obvious. */
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
  present,
  offset,
  onGoToWeek,
  onOpenShopping,
}: {
  readonly weekRange: string
  readonly present: readonly PresentMember[]
  readonly offset: number
  readonly onGoToWeek: (offset: number) => void
  readonly onOpenShopping?: (() => void) | undefined
}): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.titleRow}>
      <View>
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
          <Text style={styles.title}>
            {t(weekHeadingKey(offset).key, { count: weekHeadingKey(offset).count })}
          </Text>
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
      <View style={styles.links}>
        {present.length > 0 && <PresenceRow present={present} />}
        <Pressable
          style={styles.shopping}
          onPress={onOpenShopping}
          accessibilityRole="button"
          accessibilityLabel={t('shopping.title')}
          testID="open-shopping"
        >
          <Text style={styles.shoppingText}>{t('shopping.title')}</Text>
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
