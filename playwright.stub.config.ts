import { defineConfig, devices } from '@playwright/test'

/**
 * Console tests on real cloud data. The console runs against the real BanditApiFunction app on the
 * canonical test dataset (BanditArenaCloud testData/fullDataset.js), served by that repository's
 * local stub. Nothing in these specs is a hand-written response.
 *
 *   npm run test:e2e:stub
 *
 * BANDIT_CLOUD_REPO points at the BanditArenaCloud checkout (default: a sibling directory).
 * `npm run test:e2e:live` is a different suite: it drives the deployed console with a real login.
 */
const cloud = process.env.BANDIT_CLOUD_REPO || '../BanditArenaCloud'

export default defineConfig({
  testDir: './tests/e2e-stub',
  tsconfig: './tsconfig.playwright.json',
  timeout: 60_000,
  retries: 0,
  workers: 1, // every test resets the one shared stub
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4179',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node ${cloud}/scripts/local-cloud-stub.mjs --port 3912 --dataset full`,
      url: 'http://127.0.0.1:3912/__stub/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 4179',
      url: 'http://127.0.0.1:4179',
      reuseExistingServer: false,
      timeout: 120_000,
      // An empty API address sends every call to the dev server's own origin, where the tests
      // forward it to the stub. The deployed address in the local .env files is overridden on purpose.
      env: { VITE_E2E_AUTH_BYPASS: 'true', VITE_CLOUD_API_URL: '', VITE_MAPBOX_ACCESS_TOKEN: '' },
    },
  ],
})
