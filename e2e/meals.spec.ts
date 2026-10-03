import { expect, test, type Page } from '@playwright/test'
import { asNewVisitor, createBoard, openSharedPage, resetDatabase, weekDates } from './fixtures'

test.describe.configure({ mode: 'serial' })

/**
 * A family's own Meals. The Catalogue is a starting point, not the point: what
 * a household actually cooks is what it writes down itself.
 */
test.describe('a household writes down its own Meals', () => {
  let page: Page
  let days: string[]

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    page = await openSharedPage(browser)
    await asNewVisitor(page)
    await createBoard(page, { boardName: 'Koivisto' })
    days = await weekDates(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('a Meal needs a name', async () => {
    await page.goto('/meals/new')
    await expect(page.getByTestId('meal-editor-screen')).toBeVisible()

    await page.getByTestId('editor-save').click()
    await expect(page.getByTestId('editor-error')).toBeVisible()
  })

  test('a new Meal is written with its Ingredients and appears in the library', async () => {
    await page.getByTestId('editor-name').fill('Mummon lihapullat')

    await page.getByTestId('editor-servings-up').click()
    await expect(page.getByTestId('editor-servings')).toHaveText('5')

    await page.getByTestId('editor-add-ingredient').click()
    await expect(page.getByTestId('ingredient-picker')).toBeVisible()
    await page.getByTestId('ingredient-search').fill('onion')
    await page.getByTestId('ingredient-option-onion').click()
    await expect(page.getByTestId('ingredient-row-onion')).toBeVisible()
    // A count Ingredient starts at one of it, which is usually the answer.
    await expect(page.getByTestId('ingredient-quantity-onion')).toHaveValue('1')
    await page.getByTestId('ingredient-quantity-onion').fill('3')

    // A mass one does not: "1 g of potato" was the old default and nobody
    // cooks that.
    await page.getByTestId('editor-add-ingredient').click()
    await page.getByTestId('ingredient-search').fill('potato')
    await page.getByTestId('ingredient-option-potato').click()
    await expect(page.getByTestId('ingredient-quantity-potato')).toHaveValue('200')
    await expect(
      page.getByTestId('ingredient-row-potato').getByText('g', { exact: true }),
    ).toBeVisible()

    await page.getByTestId('editor-save').click()

    await expect(page.getByTestId('meal-library-screen')).toBeVisible()
    await expect(page.getByText('Mummon lihapullat')).toBeVisible()
    await expect(page.getByText('Serves 5')).toBeVisible()
  })

  test('a Catalogue Meal cannot be edited until it is copied', async () => {
    await page.goto('/meals')
    await expect(page.getByTestId('meal-library-screen')).toBeVisible()
    await page.getByTestId('library-search').fill('Shakshuka')
    await page.locator('[data-testid^="library-meal-"]').first().click()

    await expect(page.getByTestId('meal-editor-screen')).toBeVisible()
    await expect(page.getByTestId('editor-read-only')).toBeVisible()

    await page.getByTestId('editor-copy').click()
    await expect(page.getByTestId('meal-library-screen')).toBeVisible()

    // Now there are two: the Catalogue's, and ours.
    await page.getByTestId('library-search').fill('Shakshuka')
    await expect(page.locator('[data-testid^="library-meal-"]')).toHaveCount(2)
  })

  test("the household's own Meal reaches the Shopping List", async () => {
    const monday = days[0]
    if (monday === undefined) throw new Error('No week')

    await page.goto('/')
    await expect(page.getByTestId('wide-board-layout')).toBeVisible()

    const library = page.getByTestId('pane-library')
    await library.getByTestId('library-search').fill('Mummon')
    await library.locator('[data-testid^="library-meal-"]').first().click()

    await page.locator('[data-testid^="backlog-item-"]').first().click()
    await expect(page.getByTestId('plan-sheet')).toBeVisible()
    await page.getByTestId(`plan-day-${monday}`).click()
    await page.getByTestId('plan-slot-dinner').click()
    await page.getByTestId('plan-submit').click()
    await expect(page.getByTestId('plan-sheet')).toBeHidden()

    await page.goto('/shopping')
    await expect(page.getByTestId('shopping-screen')).toBeVisible()
    await expect(page.locator('[data-testid^="buy-"]').filter({ hasText: /^onion/ })).toHaveCount(1)
  })

  test('a Meal the household wrote can be deleted', async () => {
    await page.goto('/meals')
    await page.getByTestId('library-search').fill('Mummon')
    await page.locator('[data-testid^="library-meal-"]').first().click()

    await expect(page.getByTestId('meal-editor-screen')).toBeVisible()
    await page.getByTestId('editor-delete').click()
    await expect(page.getByTestId('confirm-sheet')).toBeVisible()
    await page.getByTestId('confirm-yes').click()

    await expect(page.getByTestId('meal-library-screen')).toBeVisible()
    await page.getByTestId('library-search').fill('Mummon')
    await expect(page.locator('[data-testid^="library-meal-"]')).toHaveCount(0)
  })
})
