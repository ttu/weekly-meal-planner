import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { Avatar } from '@/shared/ui/Avatar'
import { useTranslation } from '@/shared/i18n'
import { boardUrl, signOut, usePresence, useSession, type SlotKey } from '@/features/household'
import { MealLibraryScreen, MealPicker, useHouseholdMeals } from '@/features/meals'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useWideScreen } from '@/shared/layout/useWideScreen'
import { BacklogShelf } from './BacklogShelf'
import { BoardHeader } from './BoardHeader'
import { DayColumn } from './DayColumn'
import { WeekStrip } from './WeekStrip'
import { WideDayColumn } from './WideDayColumn'
import { formatWeekRange } from '../domain/format-day'
import { resolveDrop } from '../domain/drop'
import { useWeekBoard } from './useWeekBoard'
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
import { ConfirmSheet } from '@/shared/ui/ConfirmSheet'
import { Notice } from '@/shared/ui/Notice'
import type { BacklogItem, CookEvent, CookEventId } from '../domain/types'

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.surface },
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
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  title: { ...tokens.type.display, color: tokens.color.textPrimary },
  week: { ...tokens.type.support, color: tokens.color.textSupport },
  presence: { flexDirection: 'row' },
  overlap: { marginLeft: -9 },
  shopping: {
    backgroundColor: tokens.color.action,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shoppingText: { ...tokens.type.support, fontWeight: '600', color: tokens.color.surfaceRaised },
  days: { gap: 18 },
})

type Props = {
  readonly clock?: Clock
  readonly origin?: string
  readonly onOpenLibrary?: (() => void) | undefined
  readonly onOpenShopping?: (() => void) | undefined
  readonly onShare?: ((url: string) => void) | undefined
  readonly shared?: boolean | undefined
}

const Board = ({
  clock = systemClock,
  origin = '',
  onOpenLibrary,
  onOpenShopping,
  onShare: onShareUrl,
  shared = false,
}: Props): React.JSX.Element => {
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
  const { plan, hasFailed: planFailed } = usePlanMeal(clock)
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<DropTarget | undefined>(undefined)
  const [planning, setPlanning] = useState<BacklogItem | undefined>(undefined)
  const {
    addLeftoverFor,
    move,
    moveLeftoverTo,
    removeLeftoverCard,
    unplan,
    removeFromBacklog,
    leftoverFailed,
    moveFailed,
    unplanFailed,
  } = usePlanningActions(clock)
  const [unplanning, setUnplanning] = useState<CookEvent | undefined>(undefined)
  const isWide = useWideScreen()
  const scroll = useRef<ScrollView>(null)
  const autoScroll = useEdgeAutoScroll(scroll)
  const dayOffsets = useRef(new Map<string, number>())

  const onShare = (): void => {
    if (household === undefined) return
    onShareUrl?.(boardUrl(origin, household.shareToken))
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
        if (weekPlanId === undefined) return
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
      onSignOut={() => {
        void signOut(session.client)
      }}
    />
  )

  const shelf = (layout: 'shelf' | 'pane'): React.JSX.Element => (
    <BacklogShelf
      layout={layout}
      onDropped={onDropped}
      items={backlog}
      onAdd={() => {
        setPickerTarget(undefined)
        setPickerOpen(true)
      }}
      onPlan={(id) => {
        setPlanning(backlog.find((item) => item.id === id))
      }}
      onRemove={removeFromBacklog}
    />
  )

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

      <MealPicker
        visible={isPickerOpen}
        meals={meals}
        onSelect={(mealId) => {
          const target = pickerTarget
          const servings = meals.find((meal) => meal.id === mealId)?.servings
          if (
            target === undefined ||
            target.kind !== 'slot' ||
            weekPlanId === undefined ||
            servings === undefined
          ) {
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
                onRemoveLeftover={removeLeftoverCard}
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
          <View style={styles.links}>
            <Pressable
              onPress={onOpenLibrary}
              accessibilityRole="button"
              accessibilityLabel={t('meal.library')}
              testID="open-library"
            >
              <Text style={styles.link}>{t('meal.library')}</Text>
            </Pressable>
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel={t('board.share')}
              testID="share-board"
            >
              <Text style={styles.link}>{shared ? t('board.shareCopied') : t('board.share')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void signOut(session.client)
              }}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signOut')}
              testID="sign-out"
            >
              <Text style={styles.link}>{t('auth.signOut')}</Text>
            </Pressable>
          </View>

          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>{t('board.thisWeek')}</Text>
              <Text style={styles.week}>{weekRange}</Text>
            </View>
            <View style={styles.links}>
              {present.length > 0 && (
                <View style={styles.presence} testID="presence">
                  {present.map((member, index) => (
                    <View key={member.userId} style={index > 0 && styles.overlap}>
                      <Avatar
                        name={member.displayName}
                        colour={member.colour}
                        size="large"
                        ringColour={tokens.color.surface}
                      />
                    </View>
                  ))}
                </View>
              )}
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

          <WeekStrip
            dates={board.map((day) => day.date)}
            today={today}
            locale={locale}
            plannedDates={plannedDates}
            onSelect={(date) => {
              scroll.current?.scrollTo({ y: dayOffsets.current.get(date) ?? 0, animated: true })
            }}
          />

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
                  onRemoveLeftover={removeLeftoverCard}
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
export const BoardScreen = (props: Props): React.JSX.Element => (
  <DragProvider>
    <Board {...props} />
  </DragProvider>
)
