/**
 * Opens the local console in a visible browser and signs in a test login.
 * The browser stays open until this process is stopped.
 */
import { chromium } from '@playwright/test'

const baseUrl = process.env.BANDIT_LOCAL_URL || 'http://localhost:5173'
const username = process.env.BANDIT_E2E_USERNAME || 'test-venue-admin'
const password = process.env.BANDIT_E2E_PASSWORD || ''
const bypass = process.env.BANDIT_E2E_BYPASS === '1'
const role = process.env.BANDIT_E2E_ROLE || 'venue-admin'

async function launch() {
  try {
    return await chromium.launch({ headless: false, channel: 'chrome' })
  } catch {
    return chromium.launch({ headless: false })
  }
}

const browser = await launch()
const page = await browser.newPage()

if (bypass) {
  const url = `${baseUrl}/?e2eAuthBypass=true&e2eUser=${encodeURIComponent(username)}&e2eRole=${encodeURIComponent(role)}`
  await page.goto(url)
  console.log(`Opened the local mock console as ${username} (${role}).`)
} else {
  await page.goto(baseUrl)
  await page.locator('input[name="username"]').fill(username)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Sign out' }).waitFor({ timeout: 30000 })
  console.log(`Signed in to the local console as ${username}.`)
}

console.log('The browser stays open until you stop this script.')
await new Promise(() => {})
