import { useEffect, useMemo, useState } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { readAppEnv } from '@/shared/env'
import { initI18n, setLocale } from '@/shared/i18n'
import { detectDeviceLocale } from '@/shared/i18n/device-locale'
import { isOk } from '@/shared/types/result'
import {
  createSupabaseClient,
  loadHousehold,
  SessionProvider,
  type Household,
} from '@/features/household'

initI18n(detectDeviceLocale())

export default function RootLayout(): React.JSX.Element {
  const queryClient = useMemo(() => new QueryClient(), [])
  const client = useMemo(() => createSupabaseClient(readAppEnv()), [])
  const [household, setHousehold] = useState<Household | undefined>(undefined)

  useEffect(() => {
    void loadHousehold(client).then(async (result) => {
      if (!isOk(result)) return
      setHousehold(result.value)
      // The Household's Locale overrides the device guess (ADR 0009).
      await setLocale(result.value.locale)
    })
  }, [client])

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider client={client} household={household} memberId={undefined}>
          <Stack screenOptions={{ headerShown: false }} />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
