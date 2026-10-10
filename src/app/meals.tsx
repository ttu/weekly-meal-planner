import { router } from 'expo-router'
import { MealLibraryScreen, useHouseholdMeals } from '@/features/meals'
import { goBackTo } from '@/shared/navigation/go-back-to'
import { AppNav } from '@/shared/ui/AppNav'

export default function Meals(): React.JSX.Element {
  const { meals } = useHouseholdMeals()

  return (
    <>
      <MealLibraryScreen
        meals={meals}
        onAdd={() => {
          router.push('/meals/new')
        }}
        onSelect={(id) => {
          router.push(`/meals/${id}`)
        }}
        onBack={() => {
          goBackTo('/')
        }}
      />
      <AppNav
        active="meals"
        onGo={(destination) => {
          if (destination === 'week') goBackTo('/')
          if (destination === 'shopping') router.replace('/shopping')
        }}
      />
    </>
  )
}
