import { useMemo } from 'react'
import { useBoardSession } from '@/features/household'
import { catalogueIngredients } from '../domain/catalogue'
import type { Ingredient } from '../domain/types'

/** The Catalogue's Ingredients, named in the Household's Locale. */
export const useIngredients = (): { ingredients: readonly Ingredient[]; isLoading: boolean } => {
  const { household, checked } = useBoardSession()
  const locale = household?.locale
  const ingredients = useMemo(() => (locale ? catalogueIngredients(locale) : []), [locale])
  return { ingredients, isLoading: !checked }
}
