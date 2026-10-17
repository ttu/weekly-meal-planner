import { useLocalSearchParams } from 'expo-router'
import { goBackTo } from '@/shared/navigation/go-back-to'
import { useWeekBoard } from '@/features/planning'
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
  const { board } = useWeekBoard()
  const { save, isPending, error } = useSaveMeal()
  const { copy, remove } = useMealActions()

  if (meal === undefined) return null

  // Deleting a Meal cascades to its Cook Events and their Leftovers. The
  // confirmation names that consequence rather than letting it be discovered.
  const plannedCount = board
    .flatMap((day) => day.slots)
    .flatMap((slot) => slot.cards)
    .filter((card) => card.kind === 'cook-event' && card.cookEvent.mealId === meal.id).length

  // A Catalogue Meal is read-only through the client; the editor offers to copy
  // it instead (ADR 0005).
  return (
    <MealEditorScreen
      defaultServings={meal.servings}
      initial={{ name: meal.name, servings: meal.servings, ingredients: meal.ingredients }}
      photoUrl={meal.photoUrl}
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
      onSave={(draft, photo) => {
        save({ ...draft, id: meal.id, photo, existingPhotoPath: meal.photoPath }, () => {
          goBackTo('/meals')
        })
      }}
      onCancel={() => {
        goBackTo('/meals')
      }}
    />
  )
}
