import { expect, test, type Page } from '@playwright/test'
import {
  DEMO_PASSWORD,
  addToBacklog,
  asNewVisitor,
  createBoard,
  openSharedPage,
  planFirstBacklogItem,
  resetDatabase,
  shareTokenFor,
  weekDates,
} from './fixtures'

test.describe.configure({ mode: 'serial' })

/**
 * Two Members, two browsers, no reload. Realtime and presence were only ever
 * verified by hand with two phones and airplane mode; this is the part of
 * that a machine can keep checking.
 */
test.describe('two Members planning at the same time', () => {
  let aino: Page
  let mum: Page
  let days: string[]

  const monday = (): string => {
    const first = days[0]
    if (first === undefined) throw new Error('No week')
    return first
  }

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    aino = await openSharedPage(browser)
    await asNewVisitor(aino)
    await createBoard(aino, { boardName: 'Koivisto', yourName: 'Aino' })
    days = await weekDates(aino)

    mum = await openSharedPage(browser)
    await mum.goto(`/join/${shareTokenFor('Koivisto')}`)
    await mum.getByTestId('join-your-name').fill('Mum')
    await mum.getByTestId('join-password').fill(DEMO_PASSWORD)
    await mum.getByTestId('join-submit').click()
    await expect(mum.getByTestId('wide-board-layout')).toBeVisible()
  })

  test.afterAll(async () => {
    await aino.close()
    await mum.close()
  })

  test('each sees the other on the board', async () => {
    await expect(aino.getByTestId('presence')).toBeVisible()
    await expect(mum.getByTestId('presence')).toBeVisible()
  })

  test('a Meal one Member wants appears on the other screen without a reload', async () => {
    await addToBacklog(aino, 'Chili con carne')
    await expect(mum.getByTestId('backlog-shelf').getByText('Chili con carne')).toBeVisible()
  })

  test('planning it lands on the other board too', async () => {
    await planFirstBacklogItem(aino, monday(), 'dinner')

    await expect(
      mum.locator(`[data-testid="day-${monday()}"] [data-testid="meal-card-planned"]`),
    ).toHaveCount(1)
  })

  test('and unplanning takes it off both', async () => {
    await aino.locator(`[data-testid="day-${monday()}"] [data-testid="card-unplan"]`).click()
    await aino.getByTestId('confirm-yes').click()

    await expect(
      mum.locator(`[data-testid="day-${monday()}"] [data-testid="meal-card-planned"]`),
    ).toHaveCount(0)
  })

  test('a Member who leaves stops being shown as present', async () => {
    await mum.close()
    await expect(aino.getByTestId('presence').locator('text=M')).toHaveCount(0, {
      timeout: 30_000,
    })
  })
})
