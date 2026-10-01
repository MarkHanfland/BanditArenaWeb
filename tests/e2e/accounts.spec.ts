import { expect, test } from '@playwright/test';
import { signInAsCloudAdmin, signInAsVenueAdmin } from '../helpers/auth';
import { mockCloudApi } from '../helpers/mockApis';
import { openMenuItem } from '../helpers/menuNav';

test('SW-052: cloud admin creates, edits, and deactivates a customer', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsCloudAdmin(page);

  await openMenuItem(page, 'business', 'menu-accounts');
  await expect(page.getByRole('heading', { name: 'Customers / Operators / Venues' })).toBeVisible();
  await expect(page.getByText('Bandit Lab Facilities')).toBeVisible();

  await page.getByTestId('accounts-name').fill('Nashville Pickup Co');
  await page.getByTestId('accounts-create').click();
  await expect(page.getByTestId('accounts-message')).toContainText(/Created Customer customer-/);
  await expect(page.getByText('Nashville Pickup Co')).toBeVisible();

  const createdRow = page.getByRole('row', { name: /Nashville Pickup Co/ });
  const customerId = (await createdRow.getByRole('cell').first().textContent())?.trim();
  expect(customerId).toBeTruthy();

  await page.getByTestId(`accounts-edit-${customerId}`).click();
  await page.getByTestId('accounts-edit-name').fill('Nashville Pickup LLC');
  await page.getByTestId('accounts-save').click();
  await expect(page.getByTestId('accounts-message')).toContainText(`Updated ${customerId}`);
  await expect(page.getByText('Nashville Pickup LLC')).toBeVisible();

  await page.getByTestId(`accounts-deactivate-${customerId}`).click();
  await expect(page.getByTestId('accounts-message')).toContainText(`Deactivated ${customerId}`);
  const updatedRow = page.getByRole('row', { name: /Nashville Pickup LLC/ });
  await expect(updatedRow.getByText('deactivated')).toBeVisible();
  await expect(page.getByTestId(`accounts-deactivate-${customerId}`)).toBeDisabled();
});

test('SW-052: cloud admin creates an operator and a venue owned by a customer', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsCloudAdmin(page);

  await openMenuItem(page, 'business', 'menu-accounts');
  await page.getByTestId('accounts-tab-operators').click();
  await page.getByTestId('accounts-name').fill('East Bank Operator');
  await page.getByTestId('accounts-create').click();
  await expect(page.getByTestId('accounts-message')).toContainText(/Created Operator tenant-/);
  await expect(page.getByText('East Bank Operator')).toBeVisible();

  await page.getByTestId('accounts-tab-venues').click();
  await expect(page.getByText('Bandit Arena Lab')).toBeVisible();
  await page.getByTestId('accounts-name').fill('Cockrill Bend');
  const owner = page.getByRole('combobox', { name: 'Venue owner (Customer)' });
  await expect(owner).toHaveText('Bandit Lab Facilities');
  await owner.click();
  await page.getByRole('option', { name: 'Bandit Lab Facilities' }).click();
  await page.getByTestId('accounts-create').click();
  await expect(page.getByTestId('accounts-message')).toContainText(/Created Venue venue-/);
  const venueRow = page.getByRole('row', { name: /Cockrill Bend/ });
  await expect(venueRow).toBeVisible();
  await expect(venueRow.getByText('Bandit Lab Facilities')).toBeVisible();
});

test('SW-052 / AUTH-010: venue admin does not see Customers / Operators / Venues', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);
  await expect(page.getByTestId('menu-group-toggle-business')).toHaveCount(0);
  await expect(page.getByTestId('menu-accounts')).toHaveCount(0);
});
