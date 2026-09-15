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

  // At phone width, because "Add leftovers" lives on the phone day column —
  // the wide column has no way to create one yet.
  test('a Leftover can be carried to another Slot, and removed with its ×', async () => {
    const wednesday = days[2]
    const friday = days[4]
    if (wednesday === undefined || friday === undefined) throw new Error('No week')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await expect(page.getByTestId('board-screen')).toBeVisible()

    // Give Wednesday's Meal a second sitting on Friday lunch.
    await page
      .locator(`[data-testid="day-${wednesday}"] [data-testid^="add-leftover-"]`)
      .first()
      .click()
    await expect(page.getByTestId('plan-sheet')).toBeVisible()
    await page.getByTestId(`plan-day-${friday}`).click()
    await page.getByTestId('plan-slot-lunch').click()
    await page.getByTestId('plan-submit').click()
    await expect(page.getByTestId('plan-sheet')).toBeHidden()

    // Not a `leftover-` prefix: that also matches the × beside the card.
    const onFriday = page.locator(
      `[data-testid="day-${friday}"] [data-testid="meal-card-leftover"]`,
    )
    await expect(onFriday).toHaveCount(1)
    await onFriday.first().scrollIntoViewIfNeeded()

    // Carry it from lunch to dinner on the same day.
    const dinner = page.locator(`[data-testid="day-${friday}"] [data-testid="slot-dinner"]`)
    await dragOnto(page, onFriday.first(), dinner)

    await expect(dinner.locator('[data-testid="meal-card-leftover"]')).toBeVisible()

    // And take it off the board with the × beside it.
    await page
      .locator(`[data-testid="day-${friday}"] [data-testid^="remove-leftover-"]`)
      .first()
      .click()
    await expect(
      page.locator(`[data-testid="day-${friday}"] [data-testid="meal-card-leftover"]`),
    ).toHaveCount(0)
  })

  // The pan gesture owns the pointer, so there is no second finger to scroll
  // with: without this, a card can only ever be dropped on a day that was
  // already on screen when the drag began.
  test('holding a card at the edge scrolls the board under it', async () => {
    await addToBacklog(page, 'Tacos')
    const card = page.locator('[data-testid^="backlog-item-"]').first()
    await expect(card).toBeVisible()

    const scrollTop = (): Promise<number> =>
      page.evaluate(() =>
        Math.max(...[...document.querySelectorAll('*')].map((node) => node.scrollTop)),
      )

    const before = await scrollTop()
    const box = await card.boundingBox()
    const shelf = await page.getByTestId('backlog-shelf').boundingBox()
    if (box === null || shelf === null) throw new Error('Nothing to drag')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 20)

    // Hold just above the shelf — the bottom edge of the board — and let the
    // week come to us.
    await page.mouse.move(box.x + box.width / 2, shelf.y - 40)
    await page.waitForTimeout(900)
    const during = await scrollTop()
    await page.mouse.up()

    expect(during).toBeGreaterThan(before)

    await page.setViewportSize({ width: 1400, height: 900 })
    await page.reload()
    await expect(page.getByTestId('wide-board-layout')).toBeVisible()
  })

  test('dropping a planned Meal on the Backlog takes it off the week', async () => {
    const wednesday = days[2]
    if (wednesday === undefined) throw new Error('No week')

    const planned = page.locator(
      `[data-testid="day-${wednesday}"] [data-testid="meal-card-planned"]`,
    )
    await expect(planned).toHaveCount(1)
    const inBacklog = page.locator('[data-testid^="backlog-item-"]')
    const before = await inBacklog.count()

    const card = page.locator(`[data-testid="day-${wednesday}"] [data-testid^="planned-"]`).first()
    await dragOnto(page, card, page.getByTestId('backlog-shelf'))

    await expect(planned).toHaveCount(0)
    await expect(inBacklog).toHaveCount(before + 1)
  })
})
