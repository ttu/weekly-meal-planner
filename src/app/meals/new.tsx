import { goBackTo } from '@/shared/navigation/go-back-to'
import { MealEditorScreen, useIngredients, useSaveMeal } from '@/features/meals'

export default function NewMeal(): React.JSX.Element {
  const { save, isPending, error } = useSaveMeal()
  const { ingredients } = useIngredients()

  return (
    <MealEditorScreen
      ingredients={ingredients}
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
