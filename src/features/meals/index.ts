export type {
  Meal,
  MealId,
  IngredientId,
  IngredientSlug,
  Servings,
  Quantity,
  HouseholdId,
} from './domain/types'
export { isCatalogueMeal } from './domain/types'
export { MealCard, type MealCardVariant } from './ui/MealCard'
export { LeftoverCard } from './ui/LeftoverCard'
export { MealPicker } from './ui/MealPicker'
export { useHouseholdMeals } from './ui/useHouseholdMeals'
export { matchesSearch } from './domain/search'
export { MealLibraryScreen } from './ui/MealLibraryScreen'
export { MealEditorScreen } from './ui/MealEditorScreen'
export { useSaveMeal, type SaveMeal, type EditorError } from './ui/useSaveMeal'
export { saveMeal, type SaveMealError } from './application/meals-data'
export {
  validateMealDraft,
  type MealDraft,
  type MealIngredientDraft,
  type MealDraftError,
} from './domain/meal-draft'
export { IngredientPicker } from './ui/IngredientPicker'
export { IngredientRow } from './ui/IngredientRow'
export { useIngredients } from './ui/useIngredients'
export { catalogueIngredients } from './domain/catalogue'
export { unitsFor, dimensionOf, defaultAmountFor, parseQuantity } from '@/shared/units'
export type { Ingredient, Dimension } from './domain/types'
export type { MealDetail } from './domain/types'
export {
  listMeals,
  getMeal,
  mealIndex,
  copyCatalogueMeal,
  deleteMeal,
} from './application/meals-data'
export { useMeal, useMealActions, type MealActions } from './ui/useMealActions'
