import { brand } from '@/shared/types/brand'
import { isStoredPhoto, mealPhotoPath, photoExtension } from './photo'
import type { HouseholdId, MealId } from './types'

const HOUSEHOLD = brand<string, 'HouseholdId'>('11111111-1111-1111-1111-111111111111')
const MEAL = brand<string, 'MealId'>('22222222-2222-2222-2222-222222222222')

describe('isStoredPhoto', () => {
  it('treats a path as ours to sign', () => {
    expect(isStoredPhoto(`${HOUSEHOLD}/${MEAL}.jpg`)).toBe(true)
  })

  it('leaves a Catalogue Meal’s absolute URL alone', () => {
    expect(isStoredPhoto('https://example.test/chili.jpg')).toBe(false)
    expect(isStoredPhoto('HTTP://example.test/chili.jpg')).toBe(false)
  })
})

describe('photoExtension', () => {
  it('maps the types the bucket accepts', () => {
    expect(photoExtension('image/png')).toBe('png')
    expect(photoExtension('image/HEIC')).toBe('heic')
  })

  // A camera that reports something unexpected still gets a usable name.
  it('falls back rather than producing a file with no extension', () => {
    expect(photoExtension('application/octet-stream')).toBe('jpg')
  })
})

describe('mealPhotoPath', () => {
  it('puts the Household first, because that is what the policy checks', () => {
    expect(mealPhotoPath(HOUSEHOLD as HouseholdId, MEAL as MealId, 'image/jpeg')).toBe(
      `${HOUSEHOLD}/${MEAL}.jpg`,
    )
  })
})
