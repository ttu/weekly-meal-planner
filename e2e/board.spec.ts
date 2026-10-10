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
    await page.getByTestId('nav-shopping').first().click()
    await expect(page.getByTestId('shopping-screen')).toBeVisible()

    // Two counts in one line, each pluralised on its own number — a single
    // string pluralised on the first gave "7 to buy · 1 meals".
    await expect(page.getByTestId('shopping-summary')).toHaveText(/^\d+ still to buy · \d+ meals?$/)

    // count() does not retry, so wait for the list to arrive before counting.
    const lines = page.locator('[data-testid^="buy-"]')
    await expect(lines.first()).toBeVisible()
    const before = await lines.count()
    expect(before).toBeGreaterThan(0)

    // Onions are in several of those Meals. One Buy Line, not one per Meal —
    // this aggregation is the whole point of the screen.
    await expect(lines.filter({ hasText: /^onion/ })).toHaveCount(1)

    // Ticking keeps the row in place; the list must not reflow under a thumb.
    // The count in the heading is what moves, because in a shop the only
    // number worth having is how much further there is to go.
    await lines.first().click()
    await expect(lines).toHaveCount(before)
    await expect(page.getByTestId('shopping-summary')).toHaveText(
      new RegExp(`^${String(before - 1)} still to buy`),
    )

    // Once something is ticked it can be folded away, so a half-done shop is
    // not mostly scrolling past what is already in the trolley.
    await page.getByTestId('toggle-ticked').click()
    await expect(lines).toHaveCount(before - 1)
    await page.getByTestId('toggle-ticked').click()
    await expect(lines).toHaveCount(before)
  })

  test('a Buy Line says which Meals asked for it', async () => {
    // A Buy Line is keyed by Ingredient id, which is a uuid — the slug is
    // identity in the data, not in the DOM.
    const onion = page.locator('[data-testid^="buy-"]').filter({ hasText: /^onion/ })
    await expect(onion).toHaveCount(1)
    const id = (await onion.getAttribute('data-testid'))?.replace('buy-', '')
    if (id === undefined) throw new Error('No onion Buy Line')

    await page.getByTestId(`why-${id}`).click()
    const why = page.getByTestId(`provenance-${id}`)
    await expect(why).toBeVisible()
    await expect(why.getByText('Chili con carne')).toBeVisible()

    await page.getByTestId(`why-${id}`).click()
    await expect(why).toBeHidden()
  })

  test('an Extra can be added to the list by hand', async () => {
    await page.getByTestId('extra-input').fill('Bin bags')
    await page.getByTestId('extra-add').click()

    const extra = page.locator('[data-testid^="extra-"]').filter({ hasText: 'Bin bags' })
    await expect(extra).toHaveCount(1)

    await extra.click()
    await expect(extra).toHaveCount(1)
  })

  test('the whole list leaves as one prompt for an agent', async () => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('copy-prompt').click()

    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain('onion')
    expect(clipboard.length).toBeGreaterThan(40)
  })

  test('the Meal library lists the Catalogue', async () => {
    await page.goto('/meals')
    await expect(page.getByTestId('meal-library-screen')).toBeVisible()
    await expect(page.locator('[data-testid^="library-meal-"]').first()).toBeVisible()
  })
})
