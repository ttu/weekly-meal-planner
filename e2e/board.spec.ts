import { expect, test, type Page } from '@playwright/test'
import {
  addToBacklog,
  asNewVisitor,
  createBoard,
  dragOnto,
  openSharedPage,
  planFirstBacklogItem,
  resetDatabase,
  weekDates,
} from './fixtures'

// One story, told in order, on one page: the board only exists in this
// browser's storage.
test.describe.configure({ mode: 'serial' })

test.describe('a family plans a week', () => {
  let page: Page
  let days: string[]

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    page = await openSharedPage(browser)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('a short board password is refused, and says why', async () => {
    await asNewVisitor(page)
    await page.getByTestId('start-board-name').fill('Koivisto')
    await page.getByTestId('start-your-name').fill('Aino')
    await page.getByTestId('start-password').fill('abc')
    await page.getByTestId('start-create').click()
    await expect(page.getByTestId('start-error')).toBeVisible()
  })

  test('starting a board needs no account', async () => {
    await createBoard(page)
    await expect(page.getByText('KOIVISTO')).toBeVisible()

    days = await weekDates(page)
    expect(days).toHaveLength(7)
  })

  test('a Meal can be planned on every day of the week', async () => {
    const meals = [
      'Chili con carne',
      'Spaghetti bolognese',
      'Chicken curry',
      'Tacos',
      'Pizza',
      'Salmon soup',
      'Lentil soup',
    ]

    for (const [index, meal] of meals.entries()) {
      const date = days[index]
      if (date === undefined) throw new Error('Expected seven days on the board')

      await addToBacklog(page, meal)
      await planFirstBacklogItem(page, date, 'dinner')

      await expect(
        page.locator(`[data-testid="day-${date}"] [data-testid="meal-card-planned"]`),
      ).toHaveCount(1)
    }

    for (const date of days) {
      await expect(
        page.locator(`[data-testid="day-${date}"] [data-testid="meal-card-planned"]`),
      ).toHaveCount(1)
    }

    await expect(page.getByTestId('backlog-empty')).toBeVisible()
  })

  test('a Backlog card can be dragged straight onto a day', async () => {
    await page.goto('/')
    await expect(page.getByTestId('wide-board-layout')).toBeVisible()

    await addToBacklog(page, 'Carbonara')
    const card = page.locator('[data-testid^="backlog-item-"]').first()
    await expect(card).toBeVisible()

    // Every day already holds a dinner, so the drop lands on a lunch Slot.
    const date = days[2]
    if (date === undefined) throw new Error('Expected seven days on the board')
    const slot = page.locator(`[data-testid="day-${date}"] [data-testid="slot-lunch"]`)

    await dragOnto(page, card, slot)

    await expect(slot.locator('[data-testid="meal-card-planned"]')).toBeVisible()
    await expect(page.getByTestId('backlog-empty')).toBeVisible()
  })

  test('the Shopping List adds up what the week needs', async () => {
    await page.getByTestId('open-shopping').click()
    await expect(page.getByTestId('shopping-screen')).toBeVisible()

    // count() does not retry, so wait for the list to arrive before counting.
    const lines = page.locator('[data-testid^="buy-"]')
    await expect(lines.first()).toBeVisible()
    const before = await lines.count()
    expect(before).toBeGreaterThan(0)

    // Onions are in several of those Meals. One Buy Line, not one per Meal —
    // this aggregation is the whole point of the screen.
    await expect(lines.filter({ hasText: /^onion/ })).toHaveCount(1)

    // Ticking keeps the row in place; the list must not reflow under a thumb.
    await lines.first().click()
    await expect(lines).toHaveCount(before)
  })

  test('the Meal library lists the Catalogue', async () => {
    await page.goto('/meals')
    await expect(page.getByTestId('meal-library-screen')).toBeVisible()
    await expect(page.locator('[data-testid^="library-meal-"]').first()).toBeVisible()
  })
})
