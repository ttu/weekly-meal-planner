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
export { loadMeals, type LoadMealsError } from './infrastructure/meal-repository'
export { MealPicker } from './ui/MealPicker'
export { useHouseholdMeals } from './ui/useHouseholdMeals'
export { matchesSearch } from './domain/search'
export { MealLibraryScreen } from './ui/MealLibraryScreen'
export { MealEditorScreen } from './ui/MealEditorScreen'
export { useSaveMeal, type SaveMeal, type EditorError } from './ui/useSaveMeal'
export { saveMealPhoto, type PhotoChange } from './application/save-meal-photo'
export {
  pickPhotoFromLibrary,
  type PickPhoto,
  type PickedImage,
} from './infrastructure/photo-picker'
export { saveMeal, type SaveMealError } from './application/save-meal'
export {
  validateMealDraft,
  type MealDraft,
  type MealIngredientDraft,
  type MealDraftError,
} from './domain/meal-draft'
export { IngredientPicker } from './ui/IngredientPicker'
export { IngredientRow } from './ui/IngredientRow'
export { useIngredients } from './ui/useIngredients'
export { loadIngredients, type LoadIngredientsError } from './infrastructure/ingredient-repository'
export { unitsFor, dimensionOf, defaultAmountFor, parseQuantity } from '@/shared/units'
export type { Ingredient, Dimension } from './domain/types'
export { loadMeal, type MealDetail, type LoadMealError } from './infrastructure/meal-repository'
export { copyCatalogueMeal, type CopyCatalogueMealError } from './application/copy-catalogue-meal'
export { deleteMeal, type DeleteMealError } from './application/delete-meal'
export { useMeal, useMealActions, type MealActions } from './ui/useMealActions'
