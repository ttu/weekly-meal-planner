import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { useState } from 'react'
import { signOut, useSession } from '@/features/household'
import { MealPicker, useHouseholdMeals } from '@/features/meals'
import { systemClock, type Clock } from '@/shared/time/clock'
import { BacklogShelf } from './BacklogShelf'
import { DayColumn } from './DayColumn'
import { useWeekBoard } from './useWeekBoard'
import { useAddToBacklog } from './useAddToBacklog'
import { usePlanMeal } from './usePlanMeal'
import { PlanSheet } from './PlanSheet'
import type { BacklogItem } from '../domain/types'

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
  household: { ...tokens.type.label, color: tokens.color.textMuted, textTransform: 'uppercase' },
  signOut: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
  title: { ...tokens.type.display, color: tokens.color.textPrimary, marginBottom: tokens.space.md },
})

type Props = { readonly clock?: Clock }

export const BoardScreen = ({ clock = systemClock }: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const session = useSession()
  const household = session.household
  const { board, backlog, weekPlanId, householdName } = useWeekBoard(clock)
  const { meals } = useHouseholdMeals()
  const { add, hasFailed } = useAddToBacklog(clock)
  const { plan, hasFailed: planFailed } = usePlanMeal(clock)
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [planning, setPlanning] = useState<BacklogItem | undefined>(undefined)
  const today = clock.now().toISOString().slice(0, 10)

  return (
    <View style={styles.screen} testID="board-screen">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + tokens.space.md }]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.household}>{householdName}</Text>
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
        <Text style={styles.title}>{t('board.thisWeek')}</Text>

        <View testID="board">
          {board.map((day) => (
            <DayColumn key={day.date} day={day} isToday={day.date === today} />
          ))}
        </View>
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

      {/* Docked below the board, visible at every scroll position. */}
      <BacklogShelf
        items={backlog}
        onAdd={() => {
          setPickerOpen(true)
        }}
        onPlan={(id) => {
          setPlanning(backlog.find((item) => item.id === id))
        }}
      />

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
    </View>
  )
}
