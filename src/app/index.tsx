import { router } from 'expo-router'
import { BoardScreen } from '@/features/planning'

export default function Index(): React.JSX.Element {
  return (
    <BoardScreen
      onOpenLibrary={() => {
        router.push('/meals')
      }}
      onOpenShopping={() => {
        router.push('/shopping')
      }}
    />
  )
}
