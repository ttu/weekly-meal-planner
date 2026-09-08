import { StyleSheet } from 'react-native'
import { tokens } from '@/shared/theme/tokens'

/** Shared shell for every card variant. The surface treatment differs per
 *  variant and lives with that variant; the box metrics are common. */
export const cardStyles = StyleSheet.create({
  base: { borderRadius: 10, padding: tokens.space.md, gap: tokens.space.xs },
  row: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'center' },
  name: { ...tokens.type.mealName, color: tokens.color.textPrimary, flexShrink: 1 },
  support: { ...tokens.type.body, color: tokens.color.textMuted },
  initial: { ...tokens.type.display, fontSize: 20, color: tokens.color.textMuted, width: 46 },
  chip: { width: 46, height: 46, borderRadius: 6 },
})
