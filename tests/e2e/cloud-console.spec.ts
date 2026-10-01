import { expect, test } from '@playwright/test';
import { resolveE2eAdminUser } from '../helpers/auth';
import { mockCloudApi } from '../helpers/mockApis';
import { openMenuItem } from '../helpers/menuNav';

test('cloud console Start Session points to the treadmill and writes no session record (AUTH-010)', async ({ page }) => {
  let sessionWrites = 0;
  await mockCloudApi(page);
  await page.route('**/api/sessions', async (route) => {
    if (route.request().method() === 'POST') sessionWrites += 1;
    return route.fallback();
  });
  const admin = resolveE2eAdminUser('venueAdmin');
  await page.goto('/?e2eAuthBypass=true&e2eCloudConsole=true');
  await page.getByTestId('login-username').fill(admin.username);
  await page.getByTestId('login-password').fill(admin.password);
  await page.getByLabel('Role').click();
  await page.getByRole('option', { name: admin.label }).click();
  await page.getByTestId('login-submit').click();

  await openMenuItem(page, 'operations', 'menu-users');
  await expect(page.getByRole('heading', { name: 'Enrollment / Check-In' })).toBeVisible();
  await expect(page.getByText(/Sessions are started at the treadmill/)).toBeVisible();
  await page.getByTestId('start-session-user-demo-001').click();
  await expect(page.getByTestId('enrollment-message')).toContainText(
    'Start the session at the treadmill. The device records it in Session History.',
  );
  expect(sessionWrites).toBe(0);
});
