import { router } from 'expo-router'
import { EnterInviteScreen } from '@/features/household'

export default function EnterInvite(): React.JSX.Element {
  return (
    <EnterInviteScreen
      onBack={() => {
        router.back()
      }}
      onOpen={(token) => {
        router.replace(`/join/${token}`)
      }}
    />
  )
}
