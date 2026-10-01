import { expect, test } from '@playwright/test';
import { signInAsVenueAdmin } from '../helpers/auth';
import { createCloudFixture, mockConsoleApis } from '../helpers/mockApis';
import { openMenuItem } from '../helpers/menuNav';

test('an ineligible Player is refused before the device session starts', async ({ page }) => {
  const fixture = createCloudFixture();
  fixture.users.push({
    userId: 'user-short',
    name: 'Short Player',
    email: 'short.player@example.com',
    enrollmentState: 'active',
    ageAttested: true,
    dateOfBirth: '1990-01-01',
    safetyProfile: { heightCm: 120, weightKg: 50, strideCm: 50 },
  });
  let starts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/session/start')) starts += 1;
  });
  await mockConsoleApis(page, fixture);
  await signInAsVenueAdmin(page);
  await expect(page.getByTestId('header-media-select')).toHaveValue(/Alpine Trail/);
  await openMenuItem(page, 'operations', 'menu-users');
  await page.getByTestId('start-session-user-short').click();
  await expect(page.getByTestId('enrollment-message')).toContainText('Height is outside this model');
  expect(starts).toBe(0);
});
