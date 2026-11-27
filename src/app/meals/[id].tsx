import { useLocalSearchParams } from 'expo-router'
import { goBackTo } from '@/shared/navigation/go-back-to'
import { usePlannedCount } from '@/features/planning'
import {
  MealEditorScreen,
  isCatalogueMeal,
  useIngredients,
  useMeal,
  useMealActions,
  useSaveMeal,
  type MealId,
} from '@/features/meals'

export default function EditMeal(): React.JSX.Element | null {
  const params = useLocalSearchParams<{ id: MealId }>()
  const { meal } = useMeal(params.id)
  const { ingredients } = useIngredients()
  const { save, isPending, error } = useSaveMeal()
  const { copy, remove } = useMealActions()
  // Deleting a Meal cascades to its Cook Events, in every week, and their
  // Leftovers. The confirmation names that consequence rather than letting it be discovered.
  const plannedCount = usePlannedCount(params.id)

  if (meal === undefined) return null

  // A Catalogue Meal is read-only through the client; the editor offers to copy
  // it instead (ADR 0005).
  return (
    <MealEditorScreen
      defaultServings={meal.servings}
      initial={{ name: meal.name, servings: meal.servings, ingredients: meal.ingredients }}
      ingredients={ingredients}
      isPending={isPending}
      error={error}
      isReadOnly={isCatalogueMeal(meal)}
      plannedCount={plannedCount}
      onCopy={() => {
        copy(meal.id)
        goBackTo('/meals')
      }}
      onDelete={() => {
        remove(meal.id, () => {
          goBackTo('/meals')
        })
      }}
      onSave={(draft) => {
        save({ ...draft, id: meal.id }, () => {
          goBackTo('/meals')
        })
      }}
      onCancel={() => {
        goBackTo('/meals')
      }}
    />
  )
}
