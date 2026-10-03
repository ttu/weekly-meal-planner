import { expect, test, type Page } from '@playwright/test'
import { createEmailUser, openSharedPage, resetDatabase } from './fixtures'

test.describe.configure({ mode: 'serial' })

const EMAIL = 'aino@example.test'
const PASSWORD = 'kaalikaari-salasana'

/**
 * The other way in. Anonymous boards are the main path (ADR 0010); email is
 * for the person who wants their seat to survive clearing browser data.
 */
test.describe('signing in with an email', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    await createEmailUser(EMAIL, PASSWORD)
    page = await openSharedPage(browser)
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
    })
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('the start screen offers it, without asking for it first', async () => {
    await page.goto('/start')
    await page.getByTestId('start-sign-in-instead').click()
    await expect(page.getByTestId('sign-in-screen')).toBeVisible()
  })

  test('a wrong password is refused, and says so', async () => {
    await page.getByTestId('sign-in-email').fill(EMAIL)
    await page.getByTestId('sign-in-password').fill('not-the-password')
    await page.getByTestId('sign-in-submit').click()

    await expect(page.getByTestId('sign-in-error')).toBeVisible()
    await expect(page.getByTestId('sign-in-screen')).toBeVisible()
  })

  // An account is not a board: signing in with an email nobody has put on a
  // household lands on the empty state, not on somebody else's week.
  test('the right password gets in, to no board of its own', async () => {
    await page.getByTestId('sign-in-password').fill(PASSWORD)
    await page.getByTestId('sign-in-submit').click()

    await expect(page.getByTestId('no-household-screen')).toBeVisible()
  })

  test('signing out goes back to the start', async () => {
    await page.getByTestId('no-household-sign-out').click()
    // `.last()`: the router's stack still holds the /start this journey began
    // on, underneath the one it has just come back to.
    await expect(page.getByTestId('start-board-screen').last()).toBeVisible()
  })

  // Already signed in, /sign-in has nothing to ask.
  test('the sign-in screen is not offered to someone already signed in', async () => {
    await page.getByTestId('start-sign-in-instead').last().click()
    await page.getByTestId('sign-in-email').fill(EMAIL)
    await page.getByTestId('sign-in-password').fill(PASSWORD)
    await page.getByTestId('sign-in-submit').click()
    await expect(page.getByTestId('no-household-screen')).toBeVisible()

    await page.goto('/sign-in')
    await expect(page.getByTestId('sign-in-screen')).toBeHidden()
  })
})
