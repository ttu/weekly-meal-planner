import { useMemo } from 'react'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import { QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'
import { Blank } from '@/shared/ui/Blank'
import InstrumentSans from '../../assets/fonts/InstrumentSans-Variable.ttf'
import InstrumentSerif from '../../assets/fonts/InstrumentSerif-Regular.ttf'
import { readRelayUrl } from '@/shared/env'
import { DEFAULT_LOCALE, initI18n } from '@/shared/i18n'
import { createQueryClient } from '@/shared/net/queryClient'
import { createPlatformNetworkSource } from '@/shared/net/platformNetworkSource'
import { NetworkSourceProvider } from '@/shared/net/NetworkSourceContext'
import { createAppStateSource, useQueryLifecycle } from '@/shared/net/useQueryLifecycle'
import { ThemeProvider, themed, useThemed } from '@/shared/theme/theme'
import { SelectedWeekProvider } from '@/features/planning'
import { useBoardSession } from '@/features/household'
import { platformDeps, SyncProvider } from '@/features/sync'

initI18n(DEFAULT_LOCALE)

const sheets = themed((tokens) =>
  StyleSheet.create({ root: { flex: 1, backgroundColor: tokens.color.surface } }),
)

/**
 * Every route renders: gating here would make /start and /join unreachable,
 * which is exactly who needs them.
 */
const AppSession = (): React.JSX.Element => {
  const { checked } = useBoardSession()

  if (!checked) return <Blank />

  return (
    // Above the Stack: the board and the Shopping List are two views of one
    // week and must be looking at the same one.
    <SelectedWeekProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SelectedWeekProvider>
  )
}

const App = (): React.JSX.Element => {
  const styles = useThemed(sheets)
  // Held before first paint so text never swaps face mid-read.
  const [fontsLoaded] = useFonts({
    'InstrumentSerif-Regular': InstrumentSerif,
    'InstrumentSans-Variable': InstrumentSans,
  })
  const queryClient = useMemo(() => createQueryClient(), [])
  const network = useMemo(() => createPlatformNetworkSource(), [])
  const appState = useMemo(() => createAppStateSource(), [])
  useQueryLifecycle(network, appState)
  const syncDeps = useMemo(() => platformDeps(readRelayUrl()), [])

  return (
    // The ground the whole app sits on. Screens that cap their own width —
    // the forms, the Shopping List — would otherwise show the browser's
    // default grey either side of their column.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NetworkSourceProvider source={network}>
          <QueryClientProvider client={queryClient}>
            {fontsLoaded ? (
              <SyncProvider deps={syncDeps}>
                <AppSession />
              </SyncProvider>
            ) : (
              <Blank />
            )}
          </QueryClientProvider>
        </NetworkSourceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

export default function RootLayout(): React.JSX.Element {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  )
}
