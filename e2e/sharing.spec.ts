import { expect, test, type Browser, type Page } from '@playwright/test'
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
 * The second person. A board nobody else can reach is a single-player app, and
 * the link plus the password is the whole of the sharing story (ADR 0010).
 */
test.describe('a second Member joins the board', () => {
  let aino: Page
  let mum: Page
  let token: string
  let days: string[]

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    aino = await openSharedPage(browser)
    await asNewVisitor(aino)
    await createBoard(aino, { boardName: 'Koivisto', yourName: 'Aino' })
    days = await weekDates(aino)
    token = shareTokenFor('Koivisto')

    // A different browser entirely: a share link arrives on someone else's
    // phone, not in the tab that made the board.
    mum = await openSharedPage(browser)
  })

  test.afterAll(async () => {
    await aino.close()
    await mum.close()
  })

  test('the link alone is not enough', async () => {
    await mum.goto(`/join/${token}`)
    await expect(mum.getByTestId('join-board-screen')).toBeVisible()

    await mum.getByTestId('join-your-name').fill('Mum')
    await mum.getByTestId('join-password').fill('not-the-password')
    await mum.getByTestId('join-submit').click()

    await expect(mum.getByTestId('join-error')).toBeVisible()
    await expect(mum.getByTestId('join-board-screen')).toBeVisible()
  })

  test('the link and the password together let someone in', async () => {
    await mum.getByTestId('join-password').fill(DEMO_PASSWORD)
    await mum.getByTestId('join-submit').click()

    await expect(
      mum.getByTestId('board-screen').or(mum.getByTestId('wide-board-layout')),
    ).toBeVisible()
    await expect(mum.getByText('Koivisto')).toBeVisible()
  })

  // Who wanted a Meal is half the reason a shared board beats a list on the
  // fridge, so a joiner arrives under their own name, not as "Member".
  test('a joiner is known by the name they gave', async () => {
    const pane = mum.getByTestId('pane-library')
    await pane.getByTestId('library-search').fill('Tacos')
    await pane.locator('[data-testid^="library-meal-"]').first().click()

    await expect(mum.getByTestId('backlog-shelf').getByText('Mum')).toBeVisible()
  })

  test('both Members see the same week', async () => {
    const monday = days[0]
    if (monday === undefined) throw new Error('No week')

    await addToBacklog(aino, 'Chili con carne')
    await planFirstBacklogItem(aino, monday, 'dinner')

    await mum.reload()
    await expect(
      mum.locator(`[data-testid="day-${monday}"] [data-testid="meal-card-planned"]`),
    ).toHaveCount(1)
  })

  test('a link that matches no board is refused the same way as a wrong password', async ({
    page,
  }) => {
    await page.goto('/join/a-token-that-does-not-exist')
    await expect(page.getByTestId('join-board-screen')).toBeVisible()

    await page.getByTestId('join-your-name').fill('Nobody')
    await page.getByTestId('join-password').fill(DEMO_PASSWORD)
    await page.getByTestId('join-submit').click()

    // The same message as a wrong password: the board's existence must not be
    // discoverable by trying links.
    await expect(page.getByTestId('join-error')).toBeVisible()
  })
})

/**
 * The invite that did not arrive as a tappable link — read out, forwarded as
 * text, or opened on the wrong phone. The start screen's "Join a board" has
 * to lead somewhere that takes a paste.
 */
test.describe('an invite pasted by hand', () => {
  test('the start screen leads to a field that takes the link', async ({ page }) => {
    resetDatabase()
    const owner = await openSharedPage(page.context().browser() as Browser)
    await asNewVisitor(owner)
    await createBoard(owner, { boardName: 'Koivisto', yourName: 'Aino' })
    const token = shareTokenFor('Koivisto')
    await owner.close()

    await page.goto('/start')
    await page.getByTestId('start-join-instead').click()
    await expect(page.getByTestId('enter-invite-screen')).toBeVisible()

    // What a chat client hands over: the whole link, with a stray full stop.
    await page.getByTestId('invite-link').fill(`http://localhost:8081/join/${token}.`)
    await page.getByTestId('invite-open').click()

    await expect(page.getByTestId('join-board-screen')).toBeVisible()
    await expect(page.getByText('Koivisto')).toBeVisible()

    await page.getByTestId('join-your-name').fill('Mum')
    await page.getByTestId('join-password').fill(DEMO_PASSWORD)
    await page.getByTestId('join-submit').click()
    await expect(
      page.getByTestId('board-screen').or(page.getByTestId('wide-board-layout')),
    ).toBeVisible()
  })

  test('a paste with no link in it is refused before anyone is asked for a password', async ({
    page,
  }) => {
    await page.goto('/join')
    await expect(page.getByTestId('enter-invite-screen')).toBeVisible()

    await page.getByTestId('invite-link').fill('ask dad for the link')
    await page.getByTestId('invite-open').click()

    await expect(page.getByTestId('invite-error')).toBeVisible()
    await expect(page.getByTestId('enter-invite-screen')).toBeVisible()
  })
})
