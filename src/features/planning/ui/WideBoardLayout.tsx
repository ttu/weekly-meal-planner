import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'

/**
 * Three panes, one gesture direction: library → backlog → board, left to right.
 * The panes are the same components the phone layout uses; only the arrangement
 * differs, so a change to a card is a change in both.
 *
 * The width must sit on a plain View, not the ScrollView: on web a ScrollView
 * sizes itself to its content, which made the board — the pane that matters
 * most — the narrowest of the three.
 */
const sheets = themed((tokens) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: tokens.color.surface },
    panes: { flex: 1, flexDirection: 'row', minHeight: 0 },
    libraryPane: {
      width: 284,
      borderRightWidth: 1,
      borderRightColor: tokens.color.cardBorder,
      backgroundColor: tokens.color.surfacePane,
    },
    backlogPane: {
      width: 250,
      borderRightWidth: 1,
      borderRightColor: tokens.color.cardBorder,
      backgroundColor: tokens.color.surface,
    },
    boardPane: { flex: 1, minWidth: 320, backgroundColor: tokens.color.surface },
    /** Seven columns, sized by the pane rather than by their contents. */
    grid: { flex: 1, flexDirection: 'row', minHeight: 0 },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.space.md,
      borderTopWidth: 1,
      borderTopColor: tokens.color.cardBorder,
      backgroundColor: tokens.color.surfacePane,
      paddingVertical: 10,
      paddingHorizontal: tokens.space.md,
    },
    hint: { ...tokens.type.meta, color: tokens.color.textSupport, flexShrink: 1 },
  }),
)

type Props = {
  /** The same header the phone layout shows. Without it, sign-out, sharing and
   *  every other destination are unreachable above the breakpoint. */
  readonly header: React.ReactNode
  readonly library: React.ReactNode
  readonly backlog: React.ReactNode
  /** The seven day columns. Laid out as a row here, not scrolled: the week is
   *  the unit of the wide board and must be visible at once. */
  readonly board: React.ReactNode
  /** Which week, and the way to another one. Above the board rather than in
   *  the bar, so the bar reads the same on every destination. */
  readonly weekHeading?: React.ReactNode
  readonly overlays?: React.ReactNode
  readonly style?: ViewStyle | undefined
}

export const WideBoardLayout = ({
  header,
  library,
  backlog,
  board,
  weekHeading,
  overlays,
  style,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={[styles.page, style]} testID="wide-board-layout">
      {header}
      <View style={styles.panes}>
        <View style={styles.libraryPane} testID="pane-library">
          {library}
        </View>
        <View style={styles.backlogPane} testID="pane-backlog">
          {backlog}
        </View>
        <View style={styles.boardPane} testID="pane-board">
          {weekHeading}
          <View style={styles.grid}>{board}</View>
          <View style={styles.footer}>
            <Text style={styles.hint}>{t('board.dropHint')}</Text>
          </View>
        </View>
      </View>
      {overlays}
    </View>
  )
}
