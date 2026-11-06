import { defineConfig, devices } from '@playwright/test'

/**
 * Live console checks. Not part of `npm run test:e2e`.
 * Uses only the dedicated test login and Level 5 venues.
 *
 *   $env:BANDIT_E2E_PASSWORD = '<test-venue-admin password>'
 *   npm run test:e2e:live
 */
export default defineConfig({
  testDir: './tests/e2e-live',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BANDIT_E2E_BASE_URL || 'https://console.banditarena.com',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
