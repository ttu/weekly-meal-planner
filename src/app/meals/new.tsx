import { router } from 'expo-router'
import { MealEditorScreen, useSaveMeal } from '@/features/meals'

export default function NewMeal(): React.JSX.Element {
  const { save, isPending, error } = useSaveMeal()

  return (
    <MealEditorScreen
      isPending={isPending}
      error={error}
      onSave={(draft) => {
        save(draft, () => {
          router.back()
        })
      }}
      onCancel={() => {
        router.back()
      }}
    />
  )
}
