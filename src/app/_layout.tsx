import { useMemo } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { initI18n } from '@/shared/i18n'
import { detectDeviceLocale } from '@/shared/i18n/device-locale'

initI18n(detectDeviceLocale())

export default function RootLayout(): React.JSX.Element {
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
