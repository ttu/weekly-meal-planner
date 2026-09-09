import { router } from 'expo-router'
import { MealLibraryScreen, useHouseholdMeals } from '@/features/meals'

export default function Meals(): React.JSX.Element {
  const { meals } = useHouseholdMeals()

  return (
    <MealLibraryScreen
      meals={meals}
      onAdd={() => {
        router.push('/meals/new')
      }}
      onSelect={(id) => {
        router.push(`/meals/${id}`)
      }}
    />
  )
}
