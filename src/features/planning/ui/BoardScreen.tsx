import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { signOut, useSession } from '@/features/household'
import { systemClock, type Clock } from '@/shared/time/clock'
import { DayColumn } from './DayColumn'
import { useWeekBoard } from './useWeekBoard'

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.surface },
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
  const { client } = useSession()
  const { board, householdName } = useWeekBoard(clock)
  const today = clock.now().toISOString().slice(0, 10)

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + tokens.space.md }]}
      testID="board-screen"
    >
      <View style={styles.headerRow}>
        <Text style={styles.household}>{householdName}</Text>
        <Pressable
          onPress={() => {
            void signOut(client)
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
  )
}
