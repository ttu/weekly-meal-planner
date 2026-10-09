import { useLocalSearchParams } from 'expo-router'
import { brand } from '@/shared/types/brand'
import { goBackTo } from '@/shared/navigation/go-back-to'
import { MealEditorScreen, useIngredients, useSaveMeal } from '@/features/meals'

export default function NewMeal(): React.JSX.Element {
  const { save, isPending, error } = useSaveMeal()
  const { ingredients } = useIngredients()
  // Arrives from the picker, where someone searched for a Meal that is not
  // there yet. They have already typed its name once.
  const { name } = useLocalSearchParams<{ name?: string }>()

  return (
    <MealEditorScreen
      ingredients={ingredients}
      {...(name === undefined || name === ''
        ? {}
        : { initial: { name, servings: brand<number, 'Servings'>(4), ingredients: [] } })}
      isPending={isPending}
      error={error}
      onSave={(draft, photo) => {
        save({ ...draft, photo }, () => {
          goBackTo('/meals')
        })
      }}
      onCancel={() => {
        goBackTo('/meals')
      }}
    />
  )
}
