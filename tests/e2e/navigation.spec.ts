import { expect, test } from '@playwright/test';
import { getTestAdministratorUser } from '../helpers/testCredentials';

async function signInAsVenueAdmin(page) {
  const admin = getTestAdministratorUser('venueAdmin');

  await page.goto('/?e2eAuthBypass=true');
  await page.getByTestId('login-username').fill(admin.username);
  await page.getByTestId('login-password').fill(admin.password);
  await page.getByLabel('Role').click();
  await page.getByRole('option', { name: admin.label }).click();
  await page.getByTestId('login-submit').click();
}

test('shows device offline state on dashboard when local API is unreachable', async ({ page }) => {
  await page.route('**/config', (route) => {
    route.fulfill({ status: 503, contentType: 'text/plain', body: 'offline' });
  });

  await signInAsVenueAdmin(page);

  await expect(page.getByText('Local treadmill is offline')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Device unavailable')).toBeVisible();
});

test('venue admin can open cloud management pages from the sidebar', async ({ page }) => {
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-users').click();
  await expect(page.getByRole('heading', { name: 'User Profile & Enrollment' })).toBeVisible();

  await page.getByTestId('menu-fleet').click();
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();
});
