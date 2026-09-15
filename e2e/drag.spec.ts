import { expect, test, type Page } from '@playwright/test'
import {
  addToBacklog,
  asNewVisitor,
  createBoard,
  dragOnto,
  openSharedPage,
  resetDatabase,
  weekDates,
} from './fixtures'

test.describe.configure({ mode: 'serial' })

test.describe('cards can be carried around the board', () => {
  let page: Page
  let days: string[]

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    page = await openSharedPage(browser)
    await asNewVisitor(page)
    await createBoard(page, { boardName: 'Raahaus' })
    days = await weekDates(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('the card stays visible the whole way from the Backlog to the board', async () => {
    await addToBacklog(page, 'Chili con carne')
    const card = page.locator('[data-testid^="backlog-item-"]').first()
    await expect(card).toBeVisible()

    const from = await card.boundingBox()
    const monday = days[0]
    if (from === null || monday === undefined) throw new Error('Nothing to drag')
    const slot = page.locator(`[data-testid="day-${monday}"] [data-testid="slot-dinner"]`)
    const to = await slot.boundingBox()
    if (to === null) throw new Error('No Slot to drop on')

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2)

    // Halfway across, over no pane in particular: the card used to be clipped
    // out of existence the moment it left the Backlog.
    const layer = page.getByTestId('drag-layer')
    await expect(layer).toBeVisible()
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2)
    await expect(layer).toBeVisible()

    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(
        from.x + ((to.x + to.width / 2 - from.x) * step) / 10,
        from.y + ((to.y + to.height / 2 - from.y) * step) / 10,
      )
    }
    await page.mouse.up()

    await expect(slot.locator('[data-testid="meal-card-planned"]')).toBeVisible()
    await expect(layer).toBeHidden()
  })

  test('a planned Meal can be carried to another day', async () => {
    const monday = days[0]
    const wednesday = days[2]
    if (monday === undefined || wednesday === undefined) throw new Error('No week')

    const card = page.locator(`[data-testid="day-${monday}"] [data-testid^="planned-"]`).first()
    const target = page.locator(`[data-testid="day-${wednesday}"] [data-testid="slot-lunch"]`)

    await dragOnto(page, card, target)

    await expect(target.locator('[data-testid="meal-card-planned"]')).toBeVisible()
    await expect(
      page.locator(`[data-testid="day-${monday}"] [data-testid="meal-card-planned"]`),
    ).toHaveCount(0)
  })

  test('dropping a planned Meal on the Backlog takes it off the week', async () => {
    const wednesday = days[2]
    if (wednesday === undefined) throw new Error('No week')

    const card = page.locator(`[data-testid="day-${wednesday}"] [data-testid^="planned-"]`).first()

    await dragOnto(page, card, page.getByTestId('backlog-shelf'))

    await expect(
      page.locator(`[data-testid="day-${wednesday}"] [data-testid="meal-card-planned"]`),
    ).toHaveCount(0)
    await expect(page.locator('[data-testid^="backlog-item-"]')).toHaveCount(1)
  })
})
