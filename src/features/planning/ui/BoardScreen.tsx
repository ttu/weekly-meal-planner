import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { systemClock, type Clock } from '@/shared/time/clock'
import { DayColumn } from './DayColumn'
import { useWeekBoard } from './useWeekBoard'

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.surface },
  content: { paddingHorizontal: tokens.space.md, paddingBottom: tokens.space.xl },
  household: { ...tokens.type.label, color: tokens.color.textMuted, textTransform: 'uppercase' },
  title: { ...tokens.type.display, color: tokens.color.textPrimary, marginBottom: tokens.space.md },
})

type Props = { readonly clock?: Clock }

export const BoardScreen = ({ clock = systemClock }: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { board, householdName } = useWeekBoard(clock)
  const today = clock.now().toISOString().slice(0, 10)

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + tokens.space.md }]}
      testID="board-screen"
    >
      <Text style={styles.household}>{householdName}</Text>
      <Text style={styles.title}>{t('board.thisWeek')}</Text>

      <View testID="board">
        {board.map((day) => (
          <DayColumn key={day.date} day={day} isToday={day.date === today} />
        ))}
      </View>
    </ScrollView>
  )
}
