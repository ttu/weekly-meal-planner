import { RefreshControl } from 'react-native'
import { useTheme } from '@/shared/theme/theme'

/**
 * A ScrollView's `refreshControl`, or undefined when there is nothing to
 * refresh. The web has no pull gesture: see pullToRefresh.web.tsx.
 */
export const usePullToRefresh = (
  refreshing: boolean,
  onRefresh: (() => void) | undefined,
): React.JSX.Element | undefined => {
  const theme = useTheme()
  if (onRefresh === undefined) return undefined
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={theme.color.action}
      colors={[theme.color.action]}
    />
  )
}
