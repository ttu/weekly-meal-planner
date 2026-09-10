import { useEffect, useMemo, useState } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View } from 'react-native'
import { readAppEnv } from '@/shared/env'
import { initI18n, setLocale } from '@/shared/i18n'
import { detectDeviceLocale } from '@/shared/i18n/device-locale'
import { isOk } from '@/shared/types/result'
import { tokens } from '@/shared/theme/tokens'
import {
  createSupabaseClient,
  loadHousehold,
  loadMember,
  SessionProvider,
  NoHouseholdScreen,
  SignInScreen,
  useAuthSession,
  type Household,
  type Member,
} from '@/features/household'

initI18n(detectDeviceLocale())

export default function RootLayout(): React.JSX.Element {
  const queryClient = useMemo(() => new QueryClient(), [])
  const client = useMemo(() => createSupabaseClient(readAppEnv()), [])
  const { userId, isLoading } = useAuthSession(client)
  const [household, setHousehold] = useState<Household | undefined>(undefined)
  const [member, setMember] = useState<Member | undefined>(undefined)
  const [householdChecked, setHouseholdChecked] = useState(false)

  useEffect(() => {
    if (userId === undefined) {
      setHousehold(undefined)
      setMember(undefined)
      setHouseholdChecked(false)
      return
    }
    void loadHousehold(client).then(async (result) => {
      setHouseholdChecked(true)
      if (!isOk(result)) return
      setHousehold(result.value)
      // The Household's Locale overrides the device guess (ADR 0009).
      await setLocale(result.value.locale)

      const memberResult = await loadMember(client, userId)
      if (isOk(memberResult)) setMember(memberResult.value)
    })
  }, [client, userId])

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider client={client} household={household} member={member} userId={userId}>
          {isLoading ? (
            <View
              style={{ flex: 1, backgroundColor: tokens.color.surface }}
              testID="auth-loading"
            />
          ) : userId === undefined ? (
            <SignInScreen client={client} />
          ) : householdChecked && household === undefined ? (
            <NoHouseholdScreen client={client} />
          ) : (
            <Stack screenOptions={{ headerShown: false }} />
          )}
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
