import { router } from 'expo-router'
import { useEffect } from 'react'
import { SignInScreen, useSession } from '@/features/household'

export default function SignIn(): React.JSX.Element {
  const { client, userId } = useSession()

  useEffect(() => {
    if (userId !== undefined) router.replace('/')
  }, [userId])

  return <SignInScreen client={client} />
}
