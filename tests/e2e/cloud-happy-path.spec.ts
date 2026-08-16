import { expect, test } from '@playwright/test';
import { signInAsVenueAdmin } from '../helpers/auth';
import { createCloudFixture, mockCloudApi, mockConsoleApis } from '../helpers/mockApis';

test('enrollment happy path: list users and add user', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-users').click();
  await expect(page.getByText('Alex Runner')).toBeVisible();
  await page.getByTestId('add-user').click();
  await page.getByTestId('add-user-name').fill('New Demo User');
  await page.getByTestId('add-user-email').fill('new.demo@example.com');
  await expect(page.getByTestId('add-user-submit')).toBeDisabled();
  await page.getByTestId('add-user-age').check();
  await page.getByTestId('add-user-submit').click();
  await expect(page.getByText('Created New Demo User')).toBeVisible();
});

test('enrollment activate then start session for a pending user', async ({ page }) => {
  const fixture = createCloudFixture();
  await mockConsoleApis(page, fixture);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-users').click();
  await expect(page.getByText('Jordan Pending')).toBeVisible();
  await page.getByTestId('activate-user-demo-002').click();
  await expect(page.getByTestId('enrollment-message')).toContainText('Jordan Pending is now active');

  await page.getByTestId('start-session-user-demo-002').click();
  await expect(page.getByTestId('enrollment-message')).toContainText('Device session started for Jordan Pending');
});

test('enrollment suspend blocks a later cloud session start', async ({ page }) => {
  const fixture = createCloudFixture();
  await mockCloudApi(page, fixture);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-users').click();
  await page.getByTestId('suspend-user-demo-001').click();
  await expect(page.getByTestId('enrollment-message')).toContainText('Alex Runner is now suspended');
  await page.getByTestId('start-session-user-demo-001').click();
  await expect(page.getByTestId('enrollment-message')).toContainText('Session blocked: enrollment not active');
});

test('session start on the device console starts the local session for an active user', async ({ page }) => {
  await mockConsoleApis(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-users').click();
  await expect(page.getByText('Alex Runner')).toBeVisible();
  await page.getByTestId('start-session-user-demo-001').click();
  await expect(page.getByTestId('enrollment-message')).toContainText('Device session started for Alex Runner');
});

test('session start is blocked by the license gate for a non-active user', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-users').click();
  await expect(page.getByText('Jordan Pending')).toBeVisible();
  await page.getByTestId('start-session-user-demo-002').click();
  await expect(page.getByText('Session blocked: enrollment not active')).toBeVisible();
});

test('content publish flow adds a VR title', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-content').click();
  await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible();
  await page.getByTestId('publish-content').click();
  await page.getByLabel('Title').fill('Desert Dash');
  await page.getByLabel('Description').fill('A demo VR trail');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Published Desert Dash')).toBeVisible();
});

test('fleet register flow provisions a device', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-fleet').click();
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();
  await page.getByTestId('register-device').click();
  await page.getByTestId('register-compute-serial').fill('BA-COMPUTE-E2E-001');
  await page.getByTestId('register-device-submit').click();
  await expect(page.getByText(/Provisioned instance-new \(SN BA-COMPUTE-E2E-001\)/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One-time device credentials' })).toBeVisible();
  await page.getByTestId('credentials-dismiss').click();
});

test('fleet activate flow activates a provisioned device', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-fleet').click();
  await page.getByTestId('activate-i-provisioned').click();
  await expect(page.getByText('Activated i-provisioned')).toBeVisible();
});

test('reservation book flow confirms a slot and sets the next player', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-reservations').click();
  await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible();
  await page.getByTestId('book-slot-001').click();
  await expect(page.getByText(/Booked slot-001 for Alex Runner/)).toBeVisible();
  await expect(page.getByText(/Set as next player/)).toBeVisible();
});

test('staff assign role records a venue operator', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-staff').click();
  await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible();
  await page.getByTestId('staff-principal').fill('op@example.com');
  await page.getByTestId('staff-assign').click();
  await expect(page.getByTestId('staff-message')).toContainText('Assigned bandit-operator to op@example.com');
  await expect(page.getByRole('cell', { name: 'op@example.com' })).toBeVisible();
});

test('billing issue and revoke license', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-billing').click();
  await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
  await page.getByTestId('issue-license').click();
  await page.getByTestId('issue-license-submit').click();
  await expect(page.getByTestId('billing-message')).toContainText('Issued lic-new-2');
  await page.getByTestId('revoke-lic-demo-001').click();
  await expect(page.getByTestId('billing-message')).toContainText('Revoked lic-demo-001');
});

test('analytics page shows summary cards', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-usage').click();
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('Sessions (7d)')).toBeVisible();
  await expect(page.getByTestId('analytics-sessions')).toHaveText('5');
  await expect(page.getByTestId('analytics-trend')).toContainText('1 → 2 → 3');
});

test('maintenance records an event for the selected device', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-maintenance').click();
  await expect(page.getByRole('heading', { name: 'Maintenance' })).toBeVisible();
  await page.getByTestId('record-maintenance').click();
  await page.getByLabel('Description').fill('Belt inspection');
  await page.getByTestId('maintenance-submit').click();
  await expect(page.getByText('Belt inspection')).toBeVisible();
});
