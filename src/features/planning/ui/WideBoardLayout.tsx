import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native'
import { tokens } from '@/shared/theme/tokens'

/**
 * The width must sit on a plain View, not the ScrollView: on web a ScrollView
 * sizes itself to its content, which made the board — the pane that matters
 * most — the narrowest of the three.
 */
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.color.surface },
  header: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.rule,
  },
  panes: { flex: 1, flexDirection: 'row' },
  libraryPane: {
    width: 320,
    borderRightWidth: 1,
    borderRightColor: tokens.color.rule,
    backgroundColor: tokens.color.surface,
  },
  backlogPane: {
    width: 260,
    borderRightWidth: 1,
    borderRightColor: tokens.color.rule,
    backgroundColor: tokens.color.surfaceSunken,
  },
  boardPane: { flex: 1, minWidth: 320, backgroundColor: tokens.color.surface },
  scroll: { flex: 1 },
})

type Props = {
  /** The same header the phone layout shows. Without it, sign-out, sharing and
   *  every other destination are unreachable above the breakpoint. */
  readonly header: React.ReactNode
  readonly library: React.ReactNode
  readonly backlog: React.ReactNode
  readonly board: React.ReactNode
  readonly style?: ViewStyle | undefined
}

/**
 * Three panes, one gesture direction: library → backlog → board, left to right.
 * The panes are the same components the phone layout uses; only the arrangement
 * differs, so a change to a card is a change in both.
 */
export const WideBoardLayout = ({
  header,
  library,
  backlog,
  board,
  style,
}: Props): React.JSX.Element => (
  <View style={[styles.page, style]} testID="wide-board-layout">
    <View style={styles.header}>{header}</View>
    <View style={styles.panes}>
      <View style={styles.libraryPane} testID="pane-library">
        <ScrollView style={styles.scroll}>{library}</ScrollView>
      </View>
      <View style={styles.backlogPane} testID="pane-backlog">
        <ScrollView style={styles.scroll}>{backlog}</ScrollView>
      </View>
      <View style={styles.boardPane} testID="pane-board">
        <ScrollView style={styles.scroll}>{board}</ScrollView>
      </View>
    </View>
  </View>
)
