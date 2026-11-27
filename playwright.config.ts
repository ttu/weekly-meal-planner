import { defineConfig, devices } from '@playwright/test'
import { RELAY_PORT, WEB_PORT } from './e2e/ports'

const BASE_URL = `http://127.0.0.1:${String(WEB_PORT)}`

/**
 * Drives the real app in a browser against the real relay code, served from
 * memory by `e2e/global-setup.ts`. Nothing in the app is mocked: these tests
 * exist to catch what unit tests cannot — a screen that renders a raw
 * translation key, a tap that lands on the wrong Slot, a change that never
 * reaches the other Member's browser.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI === undefined ? [['list']] : [['github'], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm exec expo start --web --port ${String(WEB_PORT)}`,
    env: { EXPO_PUBLIC_RELAY_URL: `http://127.0.0.1:${String(RELAY_PORT)}`, CI: '1' },
    url: BASE_URL,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
