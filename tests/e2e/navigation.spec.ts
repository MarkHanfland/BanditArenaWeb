import { expect, test } from '@playwright/test';
import { signInAsVenueAdmin } from '../helpers/auth';
import { mockCloudApi, createCloudFixture } from '../helpers/mockApis';

test('offline local device hides Local Device submenu and shows header indicator only', async ({ page }) => {
  await mockCloudApi(page, createCloudFixture());
  // Registered after cloud mock so local reachability probes fail (FR-SW-UI-008).
  await page.route('**/config', (route) => {
    route.fulfill({ status: 503, contentType: 'text/plain', body: 'offline' });
  });

  await signInAsVenueAdmin(page);

  await expect(page.getByTestId('header-local-offline')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('menu-group-local')).toBeVisible();
  await expect(page.getByTestId('menu-local-offline')).toBeVisible();

  for (const menuId of [
    'menu-dashboard',
    'menu-user',
    'menu-treadmill',
    'menu-services',
    'menu-events',
    'menu-config',
  ]) {
    await expect(page.getByTestId(menuId)).toHaveCount(0);
  }

  await expect(page.getByTestId('device-status-bar')).toHaveCount(0);
  await expect(page.getByText('Local treadmill is offline')).toHaveCount(0);
  await expect(page.getByText(/blocked by browser CORS/i)).toHaveCount(0);

  await page.getByTestId('menu-users').click();
  await expect(page.getByRole('heading', { name: 'User Profile & Enrollment' })).toBeVisible();
});

test('venue admin can open cloud management pages from the sidebar', async ({ page }) => {
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-users').click();
  await expect(page.getByRole('heading', { name: 'User Profile & Enrollment' })).toBeVisible();

  await page.getByTestId('menu-fleet').click();
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();
});
