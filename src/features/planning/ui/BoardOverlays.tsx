import type { ComponentProps } from 'react'
import { useTranslation, type Locale } from '@/shared/i18n'
import { ConfirmSheet } from '@/shared/ui/ConfirmSheet'
import { BoardMenu, ShareSheet, type Slot } from '@/features/household'
import { MealPicker, type MealId } from '@/features/meals'
import type { BoardDay } from '../domain/board'
import type { CookEventId } from '../domain/types'
import type { BoardSheets } from './useBoardSheets'
import type { PlanRequest } from './usePlanMeal'
import type { PlanningActions } from './usePlanningActions'
import { PlanSheet } from './PlanSheet'
import { ServingsSheet } from './ServingsSheet'

type Props = {
  readonly sheets: BoardSheets
  readonly board: readonly BoardDay[]
  readonly weekPlanId: string | undefined
  readonly today: string
  readonly locale: Locale
  readonly slots: readonly Slot[]
  readonly boardName: string
  readonly otherMembers: readonly string[]
  readonly meals: ComponentProps<typeof MealPicker>['meals']
  readonly planPending: boolean
  readonly plan: (request: PlanRequest) => void
  readonly add: (mealId: MealId) => void
  readonly actions: Pick<
    PlanningActions,
    'setServings' | 'removeFromBacklog' | 'removeLeftoverCard' | 'unplan'
  >
  readonly leftoverCountFor: (id: CookEventId) => number
  readonly shareUrl: string
  readonly shared: boolean
  readonly onShare: () => void
  readonly onCopyShareUrl: () => void
  readonly onOpenSettings: (() => void) | undefined
  readonly onLeave: () => void
  readonly onWriteOwnMeal: ((name?: string) => void) | undefined
}

/** Every sheet the board can raise, which is at most one at a time. */
export const BoardOverlays = ({
  sheets,
  board,
  weekPlanId,
  today,
  locale,
  slots,
  boardName,
  otherMembers,
  meals,
  planPending,
  plan,
  add,
  actions,
  leftoverCountFor,
  shareUrl,
  shared,
  onShare,
  onCopyShareUrl,
  onOpenSettings,
  onLeave,
  onWriteOwnMeal,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const {
    planning,
    setPlanning,
    isMenuOpen,
    setMenuOpen,
    editingServings,
    setEditingServings,
    removingBacklog,
    setRemovingBacklog,
    removingLeftover,
    setRemovingLeftover,
    unplanning,
    setUnplanning,
    isSharing,
    setSharing,
    isPickerOpen,
    setPickerOpen,
    pickerTarget,
    setPickerTarget,
  } = sheets

  return (
    <>
      {planning !== undefined && weekPlanId !== undefined && (
        <PlanSheet
          visible
          mealName={planning.mealName}
          addedByName={planning.addedByName}
          defaultServings={planning.servings}
          board={board}
          slots={slots}
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
          boardName={boardName}
          otherMembers={otherMembers}
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
            onLeave()
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
            actions.setServings(editingServings.id, servings)
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
            actions.removeFromBacklog(removingBacklog.id)
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
            actions.removeLeftoverCard(removingLeftover)
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
            actions.unplan(unplanning.id)
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
        onCopy={onCopyShareUrl}
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
}
