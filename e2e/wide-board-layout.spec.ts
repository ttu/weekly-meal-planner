import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  addToBacklog,
  asNewVisitor,
  createBoard,
  openSharedPage,
  planFirstBacklogItem,
  resetDatabase,
  weekDates,
} from './fixtures'

test.describe.configure({ mode: 'serial' })

const box = async (locator: Locator): Promise<{ x: number; y: number; w: number; h: number }> => {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('not on screen')
  return { x: b.x, y: b.y, w: b.width, h: b.height }
}

/**
 * The wide board is a grid: seven columns sharing one band per Slot. Found in
 * a visual pass: the "Today" line pushed today's Slots below everyone else's,
 * and a Leftover's × sat on top of its Meal's name.
 */
test.describe('the wide board lines up', () => {
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

  test("today's Slots sit in the same band as every other day's", async () => {
    const today = page.locator('[data-testid^="day-"]:has([data-testid="day-today-marker"])')
    await expect(today).toHaveCount(1)
    const other = page.locator('[data-testid^="day-2"]:not(:has([data-testid="day-today-marker"]))')

    for (const slot of ['slot-lunch', 'slot-dinner']) {
      const mine = await box(today.getByTestId(slot))
      const theirs = await box(other.first().getByTestId(slot))
      expect(Math.abs(mine.y - theirs.y)).toBeLessThan(1)
    }
  })

  test("a Leftover's × does not cover the name of its Meal", async () => {
    const monday = days[0]
    if (monday === undefined) throw new Error('no week')
    await addToBacklog(page, 'Chili con carne')
    await planFirstBacklogItem(page, monday, 'dinner')

    const column = page.getByTestId(`day-${monday}`)
    await column.getByTestId('card-add-leftover').first().click()
    const name = column.getByTestId('meal-card-leftover').getByText('Chili con carne')
    const remove = column.locator('[data-testid^="remove-leftover-"] >> text=×')
    await expect(name).toBeVisible()

    const text = await box(name)
    const cross = await box(remove)
    expect(text.x + text.w).toBeLessThanOrEqual(cross.x)
  })
})
