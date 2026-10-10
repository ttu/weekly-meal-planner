import { router } from 'expo-router'
import { useEffect } from 'react'
import { DEMO_ACCOUNTS, SignInScreen, useSession } from '@/features/household'

export default function SignIn(): React.JSX.Element {
  const { client, userId } = useSession()

  useEffect(() => {
    if (userId !== undefined) router.replace('/')
  }, [userId])

  // `__DEV__` is false in an exported build, so the seeded logins exist only
  // on a developer's machine — the same place the accounts themselves do.
  return (
    <SignInScreen
      client={client}
      {...(__DEV__ ? { demoAccounts: DEMO_ACCOUNTS } : {})}
      onBack={() => {
        router.replace('/start')
      }}
    />
  )
}
