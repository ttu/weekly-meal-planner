import { useLocalSearchParams } from 'expo-router'
import { brand } from '@/shared/types/brand'
import { goBackTo } from '@/shared/navigation/go-back-to'
import { DEFAULT_SIZE, useSession } from '@/features/household'
import { MealEditorScreen, useIngredients, useSaveMeal } from '@/features/meals'

export default function NewMeal(): React.JSX.Element {
  const { save, isPending, error } = useSaveMeal()
  const { ingredients } = useIngredients()
  const { household } = useSession()
  const size = household?.size ?? DEFAULT_SIZE
  // Arrives from the picker, where someone searched for a Meal that is not
  // there yet. They have already typed its name once.
  const { name } = useLocalSearchParams<{ name?: string }>()

  return (
    // The editor reads its starting Servings once, when it mounts. Keyed on the
    // size so a Household that arrives after the first render still counts.
    <MealEditorScreen
      key={size}
      ingredients={ingredients}
      defaultServings={size}
      {...(name === undefined || name === ''
        ? {}
        : { initial: { name, servings: brand<number, 'Servings'>(size), ingredients: [] } })}
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
