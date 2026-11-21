import { Redirect, useLocalSearchParams } from 'expo-router'
import { brand } from '@/shared/types/brand'
import { Blank } from '@/shared/ui/Blank'
import { goBackTo } from '@/shared/navigation/go-back-to'
import { useBoardSession } from '@/features/household'
import { MealEditorScreen, useIngredients, useSaveMeal } from '@/features/meals'

export default function NewMeal(): React.JSX.Element {
  const { save, isPending, error } = useSaveMeal()
  const { ingredients } = useIngredients()
  const { household, checked: householdChecked } = useBoardSession()
  // Arrives from the picker, where someone searched for a Meal that is not
  // there yet. They have already typed its name once.
  const { name } = useLocalSearchParams<{ name?: string }>()

  // The editor reads its starting Servings once, when it mounts, so it waits
  // for the Household rather than starting at a guess and remounting.
  if (!householdChecked) return <Blank />
  if (household === undefined) return <Redirect href="/" />
  const size = brand<number, 'Servings'>(household.size)

  return (
    <MealEditorScreen
      ingredients={ingredients}
      defaultServings={size}
      {...(name === undefined || name === ''
        ? {}
        : { initial: { name, servings: size, ingredients: [] } })}
      isPending={isPending}
      error={error}
      onSave={(draft) => {
        save(draft, () => {
          goBackTo('/meals')
        })
      }}
      onCancel={() => {
        goBackTo('/meals')
      }}
    />
  )
}
