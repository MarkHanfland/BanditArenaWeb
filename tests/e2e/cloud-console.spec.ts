import { expect, test } from '@playwright/test';
import { getTestAdministratorUser } from '../helpers/testCredentials';
import { mockCloudApi } from '../helpers/mockApis';
import { openMenuItem } from '../helpers/menuNav';

test('cloud console Start Session creates a record and does not claim the belt started', async ({ page }) => {
  await mockCloudApi(page);
  const admin = getTestAdministratorUser('venueAdmin');
  await page.goto('/?e2eAuthBypass=true&e2eCloudConsole=true');
  await page.getByTestId('login-username').fill(admin.username);
  await page.getByTestId('login-password').fill(admin.password);
  await page.getByLabel('Role').click();
  await page.getByRole('option', { name: admin.label }).click();
  await page.getByTestId('login-submit').click();

  await openMenuItem(page, 'operations', 'menu-users');
  await expect(page.getByRole('heading', { name: 'Enrollment / Check-In' })).toBeVisible();
  await expect(page.getByText(/Creating a cloud session record does not start the treadmill/)).toBeVisible();
  await page.getByTestId('start-session-user-demo-001').click();
  await expect(page.getByTestId('enrollment-message')).toContainText(
    'Cloud session record session-new created. This does not start the treadmill.',
  );
});
