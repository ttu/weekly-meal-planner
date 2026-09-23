import { expect, test, type Page } from '@playwright/test'
import {
  DEMO_PASSWORD,
  asNewVisitor,
  createBoard,
  openSharedPage,
  resetDatabase,
  shareTokenFor,
  weekDates,
} from './fixtures'

const OUT = '/tmp/vv'

test.describe.configure({ mode: 'serial' })

const join = async (page: Page, token: string, name: string): Promise<void> => {
  await page.goto(`/join/${token}`)
  await expect(page.getByTestId('join-board-screen')).toBeVisible()
  await page.getByTestId('join-your-name').fill(name)
  await page.getByTestId('join-password').fill(DEMO_PASSWORD)
  await page.getByTestId('join-submit').click()
  await expect(
    page.getByTestId('board-screen').or(page.getByTestId('wide-board-layout')),
  ).toBeVisible()
  // eslint-disable-next-line no-console
  console.log(`${name} joined`)
}

const addFromLibrary = async (page: Page, meal: string): Promise<void> => {
  const pane = page.getByTestId('pane-library')
  await pane.getByTestId('library-search').fill(meal)
  await pane.locator('[data-testid^="library-meal-"]').first().click()
  await pane.getByTestId('library-search').fill('')
}

test('a family of four plans a week together', async ({ browser }) => {
  test.setTimeout(600_000)
  resetDatabase()

  const aino = await openSharedPage(browser)
  await asNewVisitor(aino)
  await createBoard(aino, { boardName: 'Koivisto', yourName: 'Aino' })
  const days = await weekDates(aino)
  const token = shareTokenFor('Koivisto')

  const mum = await openSharedPage(browser)
  const dad = await openSharedPage(browser)
  const sanni = await openSharedPage(browser)
  await join(mum, token, 'Mum')
  await join(dad, token, 'Dad')
  await join(sanni, token, 'Sanni')

  // Everyone throws in what they want this week.
  await addFromLibrary(aino, 'Chili con carne')
  await addFromLibrary(aino, 'Salmon soup')
  await addFromLibrary(mum, 'Chicken curry')
  await addFromLibrary(mum, 'Tacos')
  await addFromLibrary(dad, 'Pizza')
  await addFromLibrary(dad, 'Carbonara')
  await addFromLibrary(sanni, 'Lentil soup')
  await addFromLibrary(sanni, 'Shakshuka')

  await aino.reload()
  await expect(aino.getByTestId('wide-board-layout')).toBeVisible()
  await aino.waitForTimeout(1500)
  await aino.screenshot({ path: `${OUT}/01-backlog-wide.png` })

  const count = await aino.locator('[data-testid^="backlog-item-"]').count()
  // eslint-disable-next-line no-console
  console.log('BACKLOG COUNT', count)

  // Aino plans the week from the Backlog.
  for (let i = 0; i < 7; i += 1) {
    const date = days[i]
    if (date === undefined) break
    const card = aino.locator('[data-testid^="backlog-item-"]').first()
    if ((await card.count()) === 0) break
    await card.click()
    await expect(aino.getByTestId('plan-sheet')).toBeVisible()
    await aino.getByTestId(`plan-day-${date}`).click()
    await aino.getByTestId('plan-slot-dinner').click()
    await aino.getByTestId('plan-submit').click()
    await expect(aino.getByTestId('plan-sheet')).toBeHidden()
  }

  await aino.waitForTimeout(1200)
  await aino.screenshot({ path: `${OUT}/02-week-planned-wide.png` })

  // Everyone else sees the same week.
  await dad.reload()
  await dad.waitForTimeout(1500)
  await dad.screenshot({ path: `${OUT}/03-dad-sees-week.png` })

  // Phone view of the same board.
  await sanni.setViewportSize({ width: 390, height: 844 })
  await sanni.reload()
  await expect(sanni.getByTestId('board-screen')).toBeVisible()
  await sanni.waitForTimeout(1200)
  await sanni.screenshot({ path: `${OUT}/04-phone-board.png` })
  await sanni.screenshot({ path: `${OUT}/05-phone-board-full.png`, fullPage: true })

  // Shopping list, wide and phone.
  await aino.goto('/shopping')
  await expect(aino.getByTestId('shopping-screen')).toBeVisible()
  await aino.waitForTimeout(1500)
  await aino.screenshot({ path: `${OUT}/06-shopping-wide.png`, fullPage: true })

  const lines = await aino
    .locator('[data-testid^="buy-"]')
    .evaluateAll((nodes) => nodes.map((n) => n.textContent))
  // eslint-disable-next-line no-console
  console.log('BUY LINES', JSON.stringify(lines, null, 0))

  await sanni.goto('/shopping')
  await sanni.waitForTimeout(1500)
  await sanni.screenshot({ path: `${OUT}/07-shopping-phone.png`, fullPage: true })

  // Meal library on a phone.
  await sanni.goto('/meals')
  await sanni.waitForTimeout(1200)
  await sanni.screenshot({ path: `${OUT}/08-library-phone.png` })

  for (const page of [aino, mum, dad, sanni]) await page.close()
})
