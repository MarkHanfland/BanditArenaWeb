import { expect, test } from '@playwright/test';
import { signInAsVenueAdmin } from '../helpers/auth';
import { mockCloudApi, createCloudFixture } from '../helpers/mockApis';
import { expandAllMenuGroups, expandMenuGroup, openMenuItem } from '../helpers/menuNav';

test('offline local device collapses Local Device and shows header indicator only', async ({ page }) => {
  await mockCloudApi(page, createCloudFixture());
  // Registered after cloud mock so local reachability probes fail (FR-SW-UI-008).
  await page.route('**/config', (route) => {
    route.fulfill({ status: 503, contentType: 'text/plain', body: 'offline' });
  });

  await signInAsVenueAdmin(page);

  await expect(page.getByTestId('header-local-offline')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('menu-group-local')).toBeVisible();
  await expect(page.getByTestId('menu-local-offline')).toBeVisible();
  await expect(page.getByTestId('menu-group-toggle-local')).toHaveAttribute('aria-expanded', 'false');

  for (const menuId of [
    'menu-dashboard',
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

  await openMenuItem(page, 'operations', 'menu-users');
  await expect(page.getByRole('heading', { name: 'Enrollment / Check-In' })).toBeVisible();
});

test('venue admin can open cloud pillar pages from the sidebar', async ({ page }) => {
  await signInAsVenueAdmin(page);

  await expect(page.getByTestId('menu-group-toggle-local')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('menu-group-toggle-operations')).toHaveAttribute('aria-expanded', 'false');

  await openMenuItem(page, 'operations', 'menu-users');
  await expect(page.getByRole('heading', { name: 'Enrollment / Check-In' })).toBeVisible();

  await openMenuItem(page, 'device-fleet', 'menu-fleet');
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();
});

test('menu pillars are collapsible; only Local Device starts expanded', async ({ page }) => {
  await signInAsVenueAdmin(page);

  await expect(page.getByTestId('menu-group-toggle-local')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('menu-dashboard')).toBeVisible();

  for (const groupId of ['operations', 'device-fleet', 'content', 'business', 'analytics']) {
    await expect(page.getByTestId(`menu-group-toggle-${groupId}`)).toHaveAttribute('aria-expanded', 'false');
  }

  await expandMenuGroup(page, 'content');
  await expect(page.getByTestId('menu-media')).toBeVisible();
  await page.getByTestId('menu-group-toggle-content').click();
  await expect(page.getByTestId('menu-group-toggle-content')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('menu-media')).toHaveCount(0);

  await expandAllMenuGroups(page);
  await expect(page.getByTestId('menu-users')).toBeVisible();
  await expect(page.getByTestId('menu-billing')).toBeVisible();
  await expect(page.getByTestId('menu-sessions')).toBeVisible();
  await expect(page.getByTestId('menu-sessions')).toBeEnabled();
  await expect(page.getByTestId('menu-sessions')).toHaveAttribute('data-implemented', 'true');
  await expect(page.getByTestId('menu-group-administration')).toBeVisible();
  await expect(page.getByTestId('menu-audit')).toBeDisabled();
});
