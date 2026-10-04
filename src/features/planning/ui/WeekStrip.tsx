import { Pressable, StyleSheet, Text, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { formatStripDay } from '../domain/format-day'
import type { Locale } from '@/shared/i18n'

/**
 * Seven days across the top of the phone board. Today is a filled sage pill; a
 * day with something planned carries a dot, so the shape of the week is legible
 * before any scrolling. Tapping jumps to that day.
 */
type Props = {
  readonly dates: readonly string[]
  readonly today: string
  readonly locale: Locale
  readonly plannedDates: ReadonlySet<string>
  readonly onSelect?: ((date: string) => void) | undefined
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    strip: { flexDirection: 'row', gap: 6 },
    day: {
      flex: 1,
      alignItems: 'center',
      gap: 5,
      paddingVertical: tokens.space.sm,
      borderRadius: 12,
    },
    dayToday: { backgroundColor: tokens.color.affirm },
    weekday: {
      fontFamily: tokens.type.labelSmall.fontFamily,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.9,
      color: tokens.color.textSupport,
      textTransform: 'uppercase',
    },
    weekdayToday: { color: tokens.color.onActionMuted },
    date: {
      fontFamily: tokens.type.mealName.fontFamily,
      fontSize: 17,
      fontWeight: '600',
      color: tokens.color.textPrimary,
    },
    dateToday: { color: tokens.color.onAction },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
    dotPlanned: { backgroundColor: tokens.color.textDone },
    dotToday: { backgroundColor: tokens.color.onAction },
  }),
)

export const WeekStrip = ({
  dates,
  today,
  locale,
  plannedDates,
  onSelect,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)

  return (
    <View style={styles.strip} testID="week-strip">
      {dates.map((date) => {
        const { weekday, day } = formatStripDay(date, locale)
        const isToday = date === today
        const hasPlan = plannedDates.has(date)

        return (
          <Pressable
            key={date}
            style={[styles.day, isToday && styles.dayToday]}
            onPress={() => onSelect?.(date)}
            accessibilityRole="button"
            accessibilityLabel={`${weekday} ${day}`}
            testID={`strip-${date}`}
          >
            <Text style={[styles.weekday, isToday && styles.weekdayToday]}>{weekday}</Text>
            <Text style={[styles.date, isToday && styles.dateToday]}>{day}</Text>
            <View
              style={[
                styles.dot,
                hasPlan && styles.dotPlanned,
                hasPlan && isToday && styles.dotToday,
              ]}
            />
          </Pressable>
        )
      })}
    </View>
  )
}
