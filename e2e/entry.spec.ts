import { expect, test } from '@playwright/test'
import { DEMO_PASSWORD, fillBetaKey, resetDatabase, shareTokenFor } from './fixtures'

const OUT = '/tmp/vv10'

test('the two entry screens', async ({ browser }) => {
  test.setTimeout(400_000)
  resetDatabase()

  const phone = { width: 390, height: 844 }
  const aino = await browser.newContext({ viewport: phone })
  const page = await aino.newPage()

  await page.goto('/start')
  await expect(page.getByTestId('start-board-screen')).toBeVisible()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/01-start-empty.png` })

  await page.getByTestId('start-board-name').fill('Koivisto household')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/02-start-typing.png` })

  await page.getByTestId('start-your-name').fill('Dad')
  await page.getByTestId('start-password').fill(DEMO_PASSWORD)
  await page.getByTestId('start-password-show').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03-start-password-shown.png` })

  await fillBetaKey(page, 'start')
  await page.getByTestId('start-create').click()
  await expect(page.getByTestId('board-screen')).toBeVisible()

  // A second Member, so the join screen has faces to show.
  const token = shareTokenFor('Koivisto household')
  const mumContext = await browser.newContext({ viewport: phone })
  const mum = await mumContext.newPage()
  await mum.goto(`/join/${token}`)
  await expect(mum.getByTestId('join-board-screen')).toBeVisible()
  await mum.getByTestId('join-your-name').fill('Mum')
  await mum.getByTestId('join-password').fill(DEMO_PASSWORD)
  await fillBetaKey(mum, 'join')
  await mum.getByTestId('join-submit').click()
  await expect(mum.getByTestId('board-screen')).toBeVisible()

  // Now the third person sees who is already planning.
  const sanniContext = await browser.newContext({ viewport: phone })
  const sanni = await sanniContext.newPage()
  await sanni.goto(`/join/${token}`)
  await expect(sanni.getByTestId('join-board-screen')).toBeVisible()
  await expect(sanni.getByTestId('join-faces')).toBeVisible()
  await sanni.waitForTimeout(900)
  await sanni.screenshot({ path: `${OUT}/04-join.png` })

  await sanni.getByTestId('join-your-name').fill('Aino')
  await sanni.getByTestId('join-password').fill('not-the-password')
  await fillBetaKey(sanni, 'join')
  await sanni.getByTestId('join-submit').click()
  await expect(sanni.getByTestId('join-error')).toBeVisible()
  await sanni.waitForTimeout(600)
  await sanni.screenshot({ path: `${OUT}/05-join-wrong.png` })

  for (const c of [aino, mumContext, sanniContext]) await c.close()
})
