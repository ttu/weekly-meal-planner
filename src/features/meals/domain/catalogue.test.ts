import { catalogueIngredients, catalogueMeals } from './catalogue'

describe('the shipped Catalogue', () => {
  it('names Ingredients in the Locale asked for, keyed by slug', () => {
    const fi = catalogueIngredients('fi')
    const en = catalogueIngredients('en')
    expect(fi.find((i) => i.slug === 'onion')?.name).toBe('sipuli')
    expect(en.find((i) => i.slug === 'onion')?.name).toBe('onion')
    expect([...fi.map((i) => i.id)].sort((a, b) => a.localeCompare(b))).toEqual(
      [...en.map((i) => i.id)].sort((a, b) => a.localeCompare(b)),
    )
  })

  it('has Meals with stable, unique ids in both Locales', () => {
    const fi = catalogueMeals('fi')
    const en = catalogueMeals('en')
    expect(new Set(en.map((m) => m.id)).size).toBe(en.length)
    expect(fi.map((m) => m.id)).toEqual(en.map((m) => m.id))
    expect(en[0]?.id).toMatch(/^catalogue-[a-z0-9-]+$/)
  })
})
