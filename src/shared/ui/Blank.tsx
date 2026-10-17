import { StyleSheet, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'

/** The page's ground while something it cannot draw without is still on its
 *  way: fonts, the session, the Household. */
const sheets = themed((tokens) =>
  StyleSheet.create({ ground: { flex: 1, backgroundColor: tokens.color.surface } }),
)

export const Blank = (): React.JSX.Element => (
  <View style={useThemed(sheets).ground} testID="app-loading" />
)
