import { expect, test } from '@playwright/test'
import { boardScreen, newDevice } from './fixtures'

test('the development demo board fills, and its links open it as each Member', async ({
  browser,
}) => {
  const aino = await newDevice(browser)
  await aino.page.goto('/start')
  await aino.page.getByTestId('demo-board-seed').click()
  const sanniLink = aino.page.getByTestId('demo-link-Sanni')
  await expect(sanniLink).toBeVisible()
  const href = await sanniLink.getAttribute('href')
  expect(href).toContain('/join#')

  await aino.page.getByTestId('demo-board-open').click()
  await expect(boardScreen(aino.page)).toBeVisible()
  await expect(aino.page.locator('[data-testid^="planned-"]')).toHaveCount(4)

  const sanni = await newDevice(browser)
  await sanni.page.goto(href ?? '')
  await sanni.page.getByTestId('join-submit').click()
  await expect(boardScreen(sanni.page)).toBeVisible()
  await expect(sanni.page.locator('[data-testid^="planned-"]')).toHaveCount(4)

  await aino.context.close()
  await sanni.context.close()
})
