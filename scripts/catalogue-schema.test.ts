import { validateCatalogue, ingredientSchema, mealSchema } from './catalogue-schema'
import ingredientData from '../data/catalogue/ingredients.json'
import mealData from '../data/catalogue/meals.json'
import { z } from 'zod'

const ingredients = z.array(ingredientSchema).parse(ingredientData)
const meals = z.array(mealSchema).parse(mealData)

describe('the shipped Catalogue', () => {
  it('parses', () => {
    expect(ingredients.length).toBeGreaterThan(0)
    expect(meals.length).toBeGreaterThan(0)
  })

  // A Meal naming a slug that does not exist would produce an Ingredient-less
  // Meal in production and a silently short Shopping List.
  it('is internally consistent', () => {
    expect(validateCatalogue(ingredients, meals)).toEqual([])
  })

  // A Catalogue Meal missing one Locale is invisible to half the app (ADR 0009).
  it('carries both Locales for every Meal and Ingredient', () => {
    for (const meal of meals) {
      expect(meal.names.fi.length).toBeGreaterThan(0)
      expect(meal.names.en.length).toBeGreaterThan(0)
    }
    for (const ingredient of ingredients) {
      expect(ingredient.names.fi.length).toBeGreaterThan(0)
      expect(ingredient.names.en.length).toBeGreaterThan(0)
    }
  })
})

describe('validateCatalogue', () => {
  it('rejects a Meal naming an unknown Ingredient', () => {
    const problems = validateCatalogue(ingredients, [
      {
        names: { fi: 'Testi', en: 'Test' },
        servings: 4,
        ingredients: [{ slug: 'unobtanium', quantity: 1, unit: 'g' }],
      },
    ])
    expect(problems.some((p) => p.includes('unobtanium'))).toBe(true)
  })

  // Litres of minced beef is a Meal the Shopping List cannot aggregate.
  it('rejects an Ingredient measured in the wrong dimension', () => {
    const problems = validateCatalogue(ingredients, [
      {
        names: { fi: 'Testi', en: 'Test' },
        servings: 4,
        ingredients: [{ slug: 'minced-beef', quantity: 1, unit: 'l' }],
      },
    ])
    expect(problems.some((p) => p.includes('minced-beef'))).toBe(true)
  })
})
