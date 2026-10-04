import { useMemo } from 'react'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { View } from 'react-native'
import InstrumentSans from '../../assets/fonts/InstrumentSans-Variable.ttf'
import InstrumentSerif from '../../assets/fonts/InstrumentSerif-Regular.ttf'
import { readAppEnv } from '@/shared/env'
import { initI18n } from '@/shared/i18n'
import { detectDeviceLocale } from '@/shared/i18n/device-locale'
import { ThemeProvider, useTheme } from '@/shared/theme/theme'
import {
  createSupabaseClient,
  SessionProvider,
  useAuthSession,
  useHouseholdSession,
  type AppSupabaseClient,
} from '@/features/household'

initI18n(detectDeviceLocale())

const Blank = (): React.JSX.Element => {
  const theme = useTheme()

  return <View style={{ flex: 1, backgroundColor: theme.color.surface }} testID="app-loading" />
}

/**
 * Inside the QueryClientProvider so the Household can be a query, and every
 * route renders: gating here would make /start and /join unreachable, which is
 * exactly who needs them.
 */
const AppSession = ({ client }: { readonly client: AppSupabaseClient }): React.JSX.Element => {
  const { userId, email, pendingEmail, isLoading } = useAuthSession(client)
  const { household, member, checked } = useHouseholdSession(client, userId)

  if (isLoading) return <Blank />

  return (
    <SessionProvider
      client={client}
      household={household}
      member={member}
      userId={userId}
      email={email}
      pendingEmail={pendingEmail}
      householdChecked={checked}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </SessionProvider>
  )
}

const App = (): React.JSX.Element => {
  const theme = useTheme()
  // Held before first paint so text never swaps face mid-read.
  const [fontsLoaded] = useFonts({
    'InstrumentSerif-Regular': InstrumentSerif,
    'InstrumentSans-Variable': InstrumentSans,
  })
  const queryClient = useMemo(() => new QueryClient(), [])
  const client = useMemo(() => createSupabaseClient(readAppEnv()), [])

  return (
    // The ground the whole app sits on. Screens that cap their own width —
    // the forms, the Shopping List — would otherwise show the browser's
    // default grey either side of their column.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.color.surface }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {fontsLoaded ? <AppSession client={client} /> : <Blank />}
        </QueryClientProvider>
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
