import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { useState } from 'react'
import { boardUrl, signOut, usePresence, useSession } from '@/features/household'
import { MealLibraryScreen, MealPicker, useHouseholdMeals } from '@/features/meals'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useWideScreen } from '@/shared/layout/useWideScreen'
import { BacklogShelf } from './BacklogShelf'
import { DayColumn } from './DayColumn'
import { useWeekBoard } from './useWeekBoard'
import { useAddToBacklog } from './useAddToBacklog'
import { usePlanMeal } from './usePlanMeal'
import { usePlanningActions } from './usePlanningActions'
import { useWeekRealtime } from './useWeekRealtime'
import { useRecentlyChangedDays } from './useRecentlyChangedDays'
import { WideBoardLayout } from './WideBoardLayout'
import { DragProvider, type DropTarget } from './DragContext'
import { PlanSheet } from './PlanSheet'
import { ConfirmSheet } from '@/shared/ui/ConfirmSheet'
import type { BacklogItem, CookEvent, CookEventId } from '../domain/types'

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.surface },
  scroll: { flex: 1 },
  error: {
    ...tokens.type.body,
    color: tokens.color.action,
    paddingHorizontal: tokens.space.md,
    paddingBottom: tokens.space.sm,
  },
  content: { paddingHorizontal: tokens.space.md, paddingBottom: tokens.space.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: tokens.space.md },
  presence: { flexDirection: 'row', gap: tokens.space.xs },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...tokens.type.label, color: tokens.color.surfaceRaised },
  household: { ...tokens.type.label, color: tokens.color.textMuted, textTransform: 'uppercase' },
  signOut: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
  title: { ...tokens.type.display, color: tokens.color.textPrimary, marginBottom: tokens.space.md },
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
  const { board, backlog, weekPlanId, householdName, weekStart } = useWeekBoard(clock)
  const { changedDays, markChanged } = useRecentlyChangedDays()
  useWeekRealtime(weekStart, markChanged)
  const present = usePresence(weekStart, me)
  const { meals } = useHouseholdMeals()
  const { add, hasFailed } = useAddToBacklog(clock)
  const { plan, hasFailed: planFailed } = usePlanMeal(clock)
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [planning, setPlanning] = useState<BacklogItem | undefined>(undefined)
  const { addLeftoverFor, unplan, removeFromBacklog, leftoverFailed, unplanFailed } =
    usePlanningActions(clock)
  const [leftoverFor, setLeftoverFor] = useState<CookEvent | undefined>(undefined)
  const [unplanning, setUnplanning] = useState<CookEvent | undefined>(undefined)
  const isWide = useWideScreen()

  // The link carries the token; the password is deliberately not in it, and the
  // copy tells the sharer to send it separately (ADR 0010).
  const onShare = (): void => {
    if (household === undefined) return
    onShareUrl?.(boardUrl(origin, household.shareToken))
  }

  // Unplanning takes Leftovers with it, and they may be days away on the board,
  // so the confirmation says how many.
  const leftoverCountFor = (id: CookEventId): number =>
    board
      .flatMap((day) => day.slots)
      .flatMap((slot) => slot.cards)
      .filter((card) => card.kind === 'leftover' && card.leftover.cookEventId === id).length

  const cookEventById = (id: CookEventId): CookEvent | undefined =>
    board
      .flatMap((day) => day.slots)
      .flatMap((slot) => slot.cards)
      .flatMap((card) => (card.kind === 'cook-event' ? [card.cookEvent] : []))
      .find((cookEvent) => cookEvent.id === id)
  const today = clock.now().toISOString().slice(0, 10)

  const header = (
    <View style={styles.headerRow}>
      <Text style={styles.household}>{householdName}</Text>
      {present.length > 0 && (
        <View style={styles.presence} testID="presence">
          {present.map((member) => (
            <View
              key={member.userId}
              style={[styles.avatar, { backgroundColor: member.colour }]}
              accessibilityLabel={t('presence.editing', { name: member.displayName })}
            >
              <Text style={styles.avatarText}>{member.displayName.slice(0, 1)}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.headerActions}>
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel={t('board.share')}
          testID="share-board"
        >
          <Text style={styles.signOut}>{shared ? t('board.shareCopied') : t('board.share')}</Text>
        </Pressable>
        <Pressable
          onPress={onOpenShopping}
          accessibilityRole="button"
          accessibilityLabel={t('shopping.title')}
          testID="open-shopping"
        >
          <Text style={styles.signOut}>{t('shopping.title')}</Text>
        </Pressable>
        <Pressable
          onPress={onOpenLibrary}
          accessibilityRole="button"
          accessibilityLabel={t('meal.library')}
          testID="open-library"
        >
          <Text style={styles.signOut}>{t('meal.library')}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void signOut(session.client)
          }}
          accessibilityRole="button"
          accessibilityLabel={t('auth.signOut')}
          testID="sign-out"
        >
          <Text style={styles.signOut}>{t('auth.signOut')}</Text>
        </Pressable>
      </View>
    </View>
  )

  const days = (
    <View testID="board">
      {board.map((day) => (
        <DayColumn
          key={day.date}
          day={day}
          isToday={day.date === today}
          locale={household?.locale ?? 'fi'}
          recentlyChanged={changedDays.has(day.date)}
          onAddLeftover={(id) => {
            setLeftoverFor(cookEventById(id))
          }}
          onUnplan={(id) => {
            setUnplanning(cookEventById(id))
          }}
        />
      ))}
    </View>
  )

  // Dropping is itself the decision — opening a sheet afterwards would undo
  // the point of the gesture — so the Meal's own servings are used and the
  // amount can be changed on the card afterwards.
  const planFromDrop = (item: BacklogItem, target: DropTarget): void => {
    if (weekPlanId === undefined) return
    plan({
      weekPlanId,
      mealId: item.mealId,
      backlogItemId: item.id,
      date: target.date,
      slotKey: target.slotKey,
      servingsCooked: item.servings,
    })
  }

  const shelf = (
    <BacklogShelf
      onDropOnBoard={planFromDrop}
      items={backlog}
      onAdd={() => {
        setPickerOpen(true)
      }}
      onPlan={(id) => {
        setPlanning(backlog.find((item) => item.id === id))
      }}
      onRemove={removeFromBacklog}
    />
  )

  // Rendered by both layouts. Leaving them out of the wide branch removed the
  // Meal picker, the plan sheet and every confirmation above the breakpoint.
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

      {leftoverFor !== undefined && (
        <PlanSheet
          visible
          forLeftover
          mealName={leftoverFor.mealName}
          defaultServings={leftoverFor.servingsCooked}
          parentDate={leftoverFor.date}
          parentSlotKey={leftoverFor.slotKey}
          board={board}
          slots={household?.slots ?? []}
          today={today}
          onSubmit={(choice) => {
            addLeftoverFor({
              cookEventId: leftoverFor.id,
              date: choice.date,
              slotKey: choice.slotKey,
            })
            setLeftoverFor(undefined)
          }}
          onDismiss={() => {
            setLeftoverFor(undefined)
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
          add(mealId)
          setPickerOpen(false)
        }}
        onDismiss={() => {
          setPickerOpen(false)
        }}
      />
    </>
  )

  // Above the breakpoint the same nodes are arranged as three panes: library →
  // backlog → board, left to right. Only the arrangement differs, so a change
  // to a card is a change in both.
  if (isWide) {
    return (
      <WideBoardLayout
        style={{ paddingTop: insets.top }}
        header={header}
        library={
          <MealLibraryScreen
            meals={meals}
            onSelect={(mealId) => {
              add(mealId)
            }}
            onAdd={onOpenLibrary}
          />
        }
        backlog={shelf}
        board={days}
        overlays={overlays}
      />
    )
  }

  return (
    <View style={styles.screen} testID="board-screen">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + tokens.space.md }]}
      >
        {header}
        <Text style={styles.title}>{t('board.thisWeek')}</Text>

        {days}
      </ScrollView>

      {hasFailed && (
        <Text style={styles.error} testID="backlog-add-error">
          {t('picker.addFailed')}
        </Text>
      )}

      {planFailed && (
        <Text style={styles.error} testID="plan-error">
          {t('plan.failed')}
        </Text>
      )}

      {leftoverFailed && (
        <Text style={styles.error} testID="leftover-error">
          {t('leftover.failed')}
        </Text>
      )}

      {unplanFailed && (
        <Text style={styles.error} testID="unplan-error">
          {t('unplan.failed')}
        </Text>
      )}

      {/* Docked below the board, visible at every scroll position. The wide
          layout returned earlier, so this is the phone flow. */}
      {shelf}

      {overlays}
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
